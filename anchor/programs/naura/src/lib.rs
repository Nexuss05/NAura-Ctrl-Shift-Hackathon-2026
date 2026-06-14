//! Naura — afforestation funding escrow protocol (Anchor / Solana, native SOL)
//!
//! Purpose: under the control of an authorized agent, release escrowed native SOL from many
//! contributors to a reforestation beneficiary in milestones, gated by an NDVI progress threshold,
//! a budget cap, a protocol fee, and a global pause switch. Supports proportional refunds after
//! cancellation, terminal close with rent reclaim, and an admin emergency rescue.
//!
//! Safety: no floats; NDVI is i64 x1000; amounts are u64; all add/sub use checked_* (overflow ->
//! MathOverflow); the vault is a program-owned PDA, release/refund/rescue mutate lamports directly,
//! and the vault always keeps its rent-exempt reserve.

use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer as system_transfer, Transfer as SystemTransfer};

declare_id!("6WngBHVPBX2y27UxP6epeY1LkkYR7afM4MiYoCCa13MF");

/// Max protocol fee in basis points: 1000 = 10%.
pub const MAX_FEE_BPS: u16 = 1000;
/// Basis-points denominator.
pub const BPS_DENOMINATOR: u128 = 10_000;

#[program]
pub mod naura {
    use super::*;

    // ===================== Global config =====================

    /// Initialize the global Config (seeds=["config"]). The caller becomes admin.
    pub fn initialize_config(
        ctx: Context<InitializeConfig>,
        fee_bps: u16,
        fee_treasury: Pubkey,
    ) -> Result<()> {
        require!(fee_bps <= MAX_FEE_BPS, NauraError::InvalidFeeBps);

        let config = &mut ctx.accounts.config;
        config.admin = ctx.accounts.admin.key();
        config.fee_bps = fee_bps;
        config.fee_treasury = fee_treasury;
        config.paused = false;
        config.bump = ctx.bumps.config;

        emit!(ConfigInitialized {
            admin: config.admin,
            fee_bps,
            fee_treasury,
        });
        Ok(())
    }

    /// Update fee_bps / fee_treasury / admin (admin only). None means "leave unchanged".
    pub fn update_config(
        ctx: Context<UpdateConfig>,
        fee_bps: Option<u16>,
        fee_treasury: Option<Pubkey>,
        new_admin: Option<Pubkey>,
    ) -> Result<()> {
        let config = &mut ctx.accounts.config;
        if let Some(f) = fee_bps {
            require!(f <= MAX_FEE_BPS, NauraError::InvalidFeeBps);
            config.fee_bps = f;
        }
        if let Some(t) = fee_treasury {
            config.fee_treasury = t;
        }
        if let Some(a) = new_admin {
            config.admin = a;
        }

        emit!(ConfigUpdated {
            admin: config.admin,
            fee_bps: config.fee_bps,
            fee_treasury: config.fee_treasury,
        });
        Ok(())
    }

    /// Set the global pause switch (admin only).
    pub fn set_paused(ctx: Context<SetPaused>, paused: bool) -> Result<()> {
        ctx.accounts.config.paused = paused;
        emit!(PausedSet { paused });
        Ok(())
    }

    // ===================== Project lifecycle =====================

    /// Create a project: init Project + Vault (both PDAs), status=Active. funder is the initiator & payer.
    pub fn create_project(
        ctx: Context<CreateProject>,
        project_id: u64,
        country_code: [u8; 2],
        budget: u64,
        recommendation_hash: [u8; 32],
        ndvi_threshold: i64,
        agent_authority: Pubkey,
    ) -> Result<()> {
        require!(!ctx.accounts.config.paused, NauraError::Paused);
        require!(budget > 0, NauraError::InvalidAmount);

        let now = Clock::get()?.unix_timestamp;
        let project = &mut ctx.accounts.project;
        project.funder = ctx.accounts.funder.key();
        project.agent_authority = agent_authority;
        project.beneficiary = Pubkey::default();
        project.project_id = project_id;
        project.country_code = country_code;
        project.budget = budget;
        project.total_funded = 0;
        project.released = 0;
        project.recommendation_hash = recommendation_hash;
        project.ndvi_threshold = ndvi_threshold;
        project.last_ndvi_delta = 0;
        project.created_at = now;
        project.updated_at = now;
        project.status = ProjectStatus::Active;
        project.bump = ctx.bumps.project;
        project.vault_bump = ctx.bumps.vault;

        emit!(ProjectCreated {
            project: project.key(),
            funder: project.funder,
            agent_authority,
            budget,
            country_code,
            recommendation_hash,
            ndvi_threshold,
        });
        Ok(())
    }

    /// Fund: anyone can contribute. Transfers `amount` into the vault via system transfer,
    /// init_if_needed the contributor's Contribution and accumulates it, and bumps total_funded.
    pub fn fund_project(ctx: Context<FundProject>, amount: u64) -> Result<()> {
        require!(!ctx.accounts.config.paused, NauraError::Paused);
        require!(
            ctx.accounts.project.status == ProjectStatus::Active,
            NauraError::InvalidStatus
        );
        require!(amount > 0, NauraError::InvalidAmount);
        // Funding cap: total_funded + amount must not exceed budget. Otherwise anyone could keep
        // sending lamports to a full/Completed project, stranding excess in the vault (close fails
        // with VaultNotEmpty) and breaking the "release-all -> auto-complete -> close" loop.
        require!(
            ctx.accounts
                .project
                .total_funded
                .checked_add(amount)
                .ok_or(NauraError::MathOverflow)?
                <= ctx.accounts.project.budget,
            NauraError::ExceedsBudget
        );

        // Contributor-signed transfer: contributor -> vault (native SOL).
        system_transfer(
            CpiContext::new(
                ctx.accounts.system_program.key(),
                SystemTransfer {
                    from: ctx.accounts.contributor.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                },
            ),
            amount,
        )?;

        // Record/accumulate this contributor's Contribution (init_if_needed: set contributor/bump once).
        let contribution = &mut ctx.accounts.contribution;
        if contribution.contributor == Pubkey::default() {
            contribution.contributor = ctx.accounts.contributor.key();
            contribution.refunded = false;
            contribution.bump = ctx.bumps.contribution;
        }
        contribution.amount = contribution
            .amount
            .checked_add(amount)
            .ok_or(NauraError::MathOverflow)?;

        let project = &mut ctx.accounts.project;
        project.total_funded = project
            .total_funded
            .checked_add(amount)
            .ok_or(NauraError::MathOverflow)?;
        project.updated_at = Clock::get()?.unix_timestamp;

        emit!(FundsDeposited {
            project: project.key(),
            contributor: ctx.accounts.contributor.key(),
            amount,
            total_funded: project.total_funded,
        });
        Ok(())
    }

    /// Set the beneficiary (agent_authority only, Active and not paused).
    pub fn set_beneficiary(ctx: Context<SetBeneficiary>, beneficiary: Pubkey) -> Result<()> {
        require!(!ctx.accounts.config.paused, NauraError::Paused);
        require!(
            ctx.accounts.project.status == ProjectStatus::Active,
            NauraError::InvalidStatus
        );
        require!(beneficiary != Pubkey::default(), NauraError::InvalidBeneficiary);

        let project = &mut ctx.accounts.project;
        project.beneficiary = beneficiary;
        project.updated_at = Clock::get()?.unix_timestamp;

        emit!(BeneficiarySet {
            project: project.key(),
            beneficiary,
        });
        Ok(())
    }

    /// Release: agent_authority only. After the full validation chain, split off the fee and move
    /// lamports directly to the beneficiary and fee_treasury.
    pub fn release(ctx: Context<Release>, amount: u64, ndvi_delta: i64) -> Result<()> {
        require!(!ctx.accounts.config.paused, NauraError::Paused);
        require!(
            ctx.accounts.project.status == ProjectStatus::Active,
            NauraError::InvalidStatus
        );
        require!(amount > 0, NauraError::InvalidAmount);

        // Beneficiary must be set, and the passed account must match the registered address.
        require!(
            ctx.accounts.project.beneficiary != Pubkey::default(),
            NauraError::BeneficiaryNotSet
        );
        require_keys_eq!(
            ctx.accounts.beneficiary.key(),
            ctx.accounts.project.beneficiary,
            NauraError::InvalidBeneficiary
        );
        // Beneficiary and fee_treasury must not be the same account: otherwise the "read-then-write"
        // lamport updates below would have the second write overwrite the first with a stale snapshot,
        // losing the beneficiary's amount.
        require_keys_neq!(
            ctx.accounts.beneficiary.key(),
            ctx.accounts.fee_treasury.key(),
            NauraError::InvalidBeneficiary
        );

        // Impact threshold + budget cap.
        require!(
            ndvi_delta >= ctx.accounts.project.ndvi_threshold,
            NauraError::ImpactTooLow
        );
        let new_released = ctx
            .accounts
            .project
            .released
            .checked_add(amount)
            .ok_or(NauraError::MathOverflow)?;
        require!(
            new_released <= ctx.accounts.project.budget,
            NauraError::ExceedsBudget
        );

        // The vault must remain rent-exempt after the debit.
        let vault_ai = ctx.accounts.vault.to_account_info();
        let reserve = Rent::get()?.minimum_balance(vault_ai.data_len());
        let cur_vault = vault_ai.lamports();
        require!(
            cur_vault.checked_sub(amount).ok_or(NauraError::MathOverflow)? >= reserve,
            NauraError::InsufficientVaultFunds
        );

        // Protocol fee (basis points), no floats, checked.
        let fee = ((amount as u128)
            .checked_mul(ctx.accounts.config.fee_bps as u128)
            .ok_or(NauraError::MathOverflow)?
            / BPS_DENOMINATOR) as u64;
        let to_beneficiary = amount.checked_sub(fee).ok_or(NauraError::MathOverflow)?;

        // Direct lamport mutation: vault -= amount; beneficiary += amount-fee; fee_treasury += fee.
        let bene_ai = ctx.accounts.beneficiary.to_account_info();
        let treasury_ai = ctx.accounts.fee_treasury.to_account_info();
        let cur_bene = bene_ai.lamports();
        let cur_treasury = treasury_ai.lamports();
        **vault_ai.try_borrow_mut_lamports()? =
            cur_vault.checked_sub(amount).ok_or(NauraError::MathOverflow)?;
        **bene_ai.try_borrow_mut_lamports()? = cur_bene
            .checked_add(to_beneficiary)
            .ok_or(NauraError::MathOverflow)?;
        **treasury_ai.try_borrow_mut_lamports()? =
            cur_treasury.checked_add(fee).ok_or(NauraError::MathOverflow)?;

        let now = Clock::get()?.unix_timestamp;
        let project = &mut ctx.accounts.project;
        project.released = new_released;
        project.last_ndvi_delta = ndvi_delta;
        project.updated_at = now;
        if project.released == project.budget {
            project.status = ProjectStatus::Completed; // auto-complete once fully released
        }

        emit!(FundsReleased {
            project: project.key(),
            beneficiary: project.beneficiary,
            amount,
            fee,
            ndvi_delta,
            released_total: project.released,
            status: project.status,
        });
        Ok(())
    }

    /// Cancel a project (funder or admin only): Active -> Cancelled, entering refund-only mode.
    pub fn cancel_project(ctx: Context<CancelProject>) -> Result<()> {
        let authority = ctx.accounts.authority.key();
        require!(
            authority == ctx.accounts.project.funder || authority == ctx.accounts.config.admin,
            NauraError::Unauthorized
        );
        require!(
            ctx.accounts.project.status == ProjectStatus::Active,
            NauraError::InvalidStatus
        );

        let project = &mut ctx.accounts.project;
        project.status = ProjectStatus::Cancelled;
        project.updated_at = Clock::get()?.unix_timestamp;

        emit!(ProjectCancelled {
            project: project.key(),
            authority,
        });
        Ok(())
    }

    /// Refund (when Cancelled): return the contributor's proportional share of the vault funds not
    /// yet released. Permissionless: anyone can trigger it, but funds only go to the recorded contributor.
    pub fn refund(ctx: Context<Refund>) -> Result<()> {
        require!(
            ctx.accounts.project.status == ProjectStatus::Cancelled,
            NauraError::InvalidStatus
        );
        require!(!ctx.accounts.contribution.refunded, NauraError::AlreadyRefunded);

        let project = &ctx.accounts.project;
        require!(project.total_funded > 0, NauraError::NothingToRefund);

        // refundable = amount * (total_funded - released) / total_funded (u128 to avoid overflow).
        let remaining = project
            .total_funded
            .checked_sub(project.released)
            .ok_or(NauraError::MathOverflow)?;
        let refundable = ((ctx.accounts.contribution.amount as u128)
            .checked_mul(remaining as u128)
            .ok_or(NauraError::MathOverflow)?
            / project.total_funded as u128) as u64;
        require!(refundable > 0, NauraError::NothingToRefund);

        // The vault must remain rent-exempt after the debit.
        let vault_ai = ctx.accounts.vault.to_account_info();
        let reserve = Rent::get()?.minimum_balance(vault_ai.data_len());
        let cur_vault = vault_ai.lamports();
        require!(
            cur_vault.checked_sub(refundable).ok_or(NauraError::MathOverflow)? >= reserve,
            NauraError::InsufficientVaultFunds
        );

        // Direct lamports: vault -> contributor.
        let contributor_ai = ctx.accounts.contributor.to_account_info();
        let cur_contrib = contributor_ai.lamports();
        **vault_ai.try_borrow_mut_lamports()? =
            cur_vault.checked_sub(refundable).ok_or(NauraError::MathOverflow)?;
        **contributor_ai.try_borrow_mut_lamports()? = cur_contrib
            .checked_add(refundable)
            .ok_or(NauraError::MathOverflow)?;

        ctx.accounts.contribution.refunded = true;

        emit!(FundsRefunded {
            project: ctx.accounts.project.key(),
            contributor: ctx.accounts.contributor.key(),
            amount: refundable,
        });
        Ok(())
    }

    /// Close a project (Completed/Cancelled and the vault holds only its rent reserve): close
    /// project + vault, returning rent to the funder.
    pub fn close_project(ctx: Context<CloseProject>) -> Result<()> {
        let authority = ctx.accounts.authority.key();
        require!(
            authority == ctx.accounts.project.funder || authority == ctx.accounts.config.admin,
            NauraError::Unauthorized
        );
        require!(
            ctx.accounts.project.status == ProjectStatus::Completed
                || ctx.accounts.project.status == ProjectStatus::Cancelled,
            NauraError::InvalidStatus
        );

        // The vault's non-rent balance must be 0 (otherwise funds remain; closing is disallowed).
        let vault_ai = ctx.accounts.vault.to_account_info();
        let reserve = Rent::get()?.minimum_balance(vault_ai.data_len());
        require!(vault_ai.lamports() <= reserve, NauraError::VaultNotEmpty);
        // The project and vault accounts are closed by the #[account(close = funder)] constraint at
        // the end of the instruction, returning rent to the funder.

        emit!(ProjectClosed {
            project: ctx.accounts.project.key(),
            funder: ctx.accounts.funder.key(),
        });
        Ok(())
    }

    /// Emergency withdraw (admin only, and only while globally paused): move the vault's above-rent
    /// balance to a recipient.
    pub fn emergency_withdraw(ctx: Context<EmergencyWithdraw>) -> Result<()> {
        require!(ctx.accounts.config.paused, NauraError::InvalidStatus);

        let vault_ai = ctx.accounts.vault.to_account_info();
        let reserve = Rent::get()?.minimum_balance(vault_ai.data_len());
        let cur_vault = vault_ai.lamports();
        let withdrawable = cur_vault.saturating_sub(reserve);
        require!(withdrawable > 0, NauraError::InsufficientVaultFunds);

        let recipient_ai = ctx.accounts.recipient.to_account_info();
        let cur_recipient = recipient_ai.lamports();
        **vault_ai.try_borrow_mut_lamports()? =
            cur_vault.checked_sub(withdrawable).ok_or(NauraError::MathOverflow)?;
        **recipient_ai.try_borrow_mut_lamports()? = cur_recipient
            .checked_add(withdrawable)
            .ok_or(NauraError::MathOverflow)?;

        emit!(EmergencyWithdrawn {
            project: ctx.accounts.project.key(),
            recipient: ctx.accounts.recipient.key(),
            amount: withdrawable,
        });
        Ok(())
    }
}

// ============================================================================
// Account contexts
// ============================================================================

#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(
        init,
        payer = admin,
        space = 8 + Config::INIT_SPACE,
        seeds = [b"config"],
        bump
    )]
    pub config: Account<'info, Config>,

    #[account(mut)]
    pub admin: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    #[account(mut, seeds = [b"config"], bump = config.bump, has_one = admin @ NauraError::NotAdmin)]
    pub config: Account<'info, Config>,

    pub admin: Signer<'info>,
}

#[derive(Accounts)]
pub struct SetPaused<'info> {
    #[account(mut, seeds = [b"config"], bump = config.bump, has_one = admin @ NauraError::NotAdmin)]
    pub config: Account<'info, Config>,

    pub admin: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(project_id: u64)]
pub struct CreateProject<'info> {
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,

    #[account(
        init,
        payer = funder,
        space = 8 + Project::INIT_SPACE,
        seeds = [b"project", funder.key().as_ref(), project_id.to_le_bytes().as_ref()],
        bump
    )]
    pub project: Account<'info, Project>,

    /// Escrow vault: a program-owned empty account (8-byte discriminator) holding native SOL.
    #[account(
        init,
        payer = funder,
        space = 8 + Vault::INIT_SPACE,
        seeds = [b"vault", project.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, Vault>,

    #[account(mut)]
    pub funder: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct FundProject<'info> {
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,

    #[account(mut, seeds = [b"project", project.funder.as_ref(), project.project_id.to_le_bytes().as_ref()], bump = project.bump)]
    pub project: Account<'info, Project>,

    #[account(mut, seeds = [b"vault", project.key().as_ref()], bump = project.vault_bump)]
    pub vault: Account<'info, Vault>,

    #[account(
        init_if_needed,
        payer = contributor,
        space = 8 + Contribution::INIT_SPACE,
        seeds = [b"contribution", project.key().as_ref(), contributor.key().as_ref()],
        bump
    )]
    pub contribution: Account<'info, Contribution>,

    #[account(mut)]
    pub contributor: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetBeneficiary<'info> {
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,

    #[account(
        mut,
        seeds = [b"project", project.funder.as_ref(), project.project_id.to_le_bytes().as_ref()],
        bump = project.bump,
        has_one = agent_authority @ NauraError::Unauthorized
    )]
    pub project: Account<'info, Project>,

    pub agent_authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct Release<'info> {
    #[account(seeds = [b"config"], bump = config.bump, has_one = fee_treasury)]
    pub config: Account<'info, Config>,

    #[account(
        mut,
        seeds = [b"project", project.funder.as_ref(), project.project_id.to_le_bytes().as_ref()],
        bump = project.bump,
        has_one = agent_authority @ NauraError::Unauthorized
    )]
    pub project: Account<'info, Project>,

    #[account(mut, seeds = [b"vault", project.key().as_ref()], bump = project.vault_bump)]
    pub vault: Account<'info, Vault>,

    pub agent_authority: Signer<'info>,

    /// CHECK: beneficiary wallet receiving native SOL; verified == project.beneficiary in the handler.
    #[account(mut)]
    pub beneficiary: SystemAccount<'info>,

    /// Protocol fee recipient; must == config.fee_treasury (enforced by has_one).
    #[account(mut)]
    pub fee_treasury: SystemAccount<'info>,
}

#[derive(Accounts)]
pub struct CancelProject<'info> {
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,

    #[account(
        mut,
        seeds = [b"project", project.funder.as_ref(), project.project_id.to_le_bytes().as_ref()],
        bump = project.bump
    )]
    pub project: Account<'info, Project>,

    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct Refund<'info> {
    #[account(
        mut,
        seeds = [b"project", project.funder.as_ref(), project.project_id.to_le_bytes().as_ref()],
        bump = project.bump
    )]
    pub project: Account<'info, Project>,

    #[account(mut, seeds = [b"vault", project.key().as_ref()], bump = project.vault_bump)]
    pub vault: Account<'info, Vault>,

    #[account(
        mut,
        seeds = [b"contribution", project.key().as_ref(), contributor.key().as_ref()],
        bump = contribution.bump,
        has_one = contributor
    )]
    pub contribution: Account<'info, Contribution>,

    /// Refund destination wallet; must == contribution.contributor (enforced by has_one).
    #[account(mut)]
    pub contributor: SystemAccount<'info>,

    /// Permissionless: anyone can pay the fee to trigger the refund.
    pub payer: Signer<'info>,
}

#[derive(Accounts)]
pub struct CloseProject<'info> {
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,

    #[account(
        mut,
        seeds = [b"project", project.funder.as_ref(), project.project_id.to_le_bytes().as_ref()],
        bump = project.bump,
        has_one = funder,
        close = funder
    )]
    pub project: Account<'info, Project>,

    #[account(
        mut,
        seeds = [b"vault", project.key().as_ref()],
        bump = project.vault_bump,
        close = funder
    )]
    pub vault: Account<'info, Vault>,

    /// Rent reclaim destination; must == project.funder.
    #[account(mut)]
    pub funder: SystemAccount<'info>,

    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct EmergencyWithdraw<'info> {
    #[account(seeds = [b"config"], bump = config.bump, has_one = admin @ NauraError::NotAdmin)]
    pub config: Account<'info, Config>,

    #[account(
        seeds = [b"project", project.funder.as_ref(), project.project_id.to_le_bytes().as_ref()],
        bump = project.bump
    )]
    pub project: Account<'info, Project>,

    #[account(mut, seeds = [b"vault", project.key().as_ref()], bump = project.vault_bump)]
    pub vault: Account<'info, Vault>,

    pub admin: Signer<'info>,

    /// Rescue destination (chosen by admin).
    #[account(mut)]
    pub recipient: SystemAccount<'info>,
}

// ============================================================================
// State
// ============================================================================

#[account]
#[derive(InitSpace)]
pub struct Config {
    pub admin: Pubkey,
    pub fee_bps: u16,
    pub fee_treasury: Pubkey,
    pub paused: bool,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Project {
    pub funder: Pubkey,
    pub agent_authority: Pubkey,
    pub beneficiary: Pubkey,
    pub project_id: u64,
    pub country_code: [u8; 2],
    pub budget: u64,
    pub total_funded: u64,
    pub released: u64,
    pub recommendation_hash: [u8; 32],
    pub ndvi_threshold: i64,
    pub last_ndvi_delta: i64,
    pub created_at: i64,
    pub updated_at: i64,
    pub status: ProjectStatus,
    pub bump: u8,
    pub vault_bump: u8,
}

/// Program-owned vault: empty account that only holds lamports.
#[account]
#[derive(InitSpace)]
pub struct Vault {}

#[account]
#[derive(InitSpace)]
pub struct Contribution {
    pub contributor: Pubkey,
    pub amount: u64,
    pub refunded: bool,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
pub enum ProjectStatus {
    Active,
    Completed,
    Cancelled,
}

// ============================================================================
// Events
// ============================================================================

#[event]
pub struct ConfigInitialized {
    pub admin: Pubkey,
    pub fee_bps: u16,
    pub fee_treasury: Pubkey,
}

#[event]
pub struct ConfigUpdated {
    pub admin: Pubkey,
    pub fee_bps: u16,
    pub fee_treasury: Pubkey,
}

#[event]
pub struct PausedSet {
    pub paused: bool,
}

#[event]
pub struct ProjectCreated {
    pub project: Pubkey,
    pub funder: Pubkey,
    pub agent_authority: Pubkey,
    pub budget: u64,
    pub country_code: [u8; 2],
    pub recommendation_hash: [u8; 32],
    pub ndvi_threshold: i64,
}

#[event]
pub struct FundsDeposited {
    pub project: Pubkey,
    pub contributor: Pubkey,
    pub amount: u64,
    pub total_funded: u64,
}

#[event]
pub struct BeneficiarySet {
    pub project: Pubkey,
    pub beneficiary: Pubkey,
}

#[event]
pub struct FundsReleased {
    pub project: Pubkey,
    pub beneficiary: Pubkey,
    pub amount: u64,
    pub fee: u64,
    pub ndvi_delta: i64,
    pub released_total: u64,
    pub status: ProjectStatus,
}

#[event]
pub struct ProjectCancelled {
    pub project: Pubkey,
    pub authority: Pubkey,
}

#[event]
pub struct FundsRefunded {
    pub project: Pubkey,
    pub contributor: Pubkey,
    pub amount: u64,
}

#[event]
pub struct ProjectClosed {
    pub project: Pubkey,
    pub funder: Pubkey,
}

#[event]
pub struct EmergencyWithdrawn {
    pub project: Pubkey,
    pub recipient: Pubkey,
    pub amount: u64,
}

// ============================================================================
// Error codes
// ============================================================================

#[error_code]
pub enum NauraError {
    #[msg("Signer is not authorized for this action")]
    Unauthorized,
    #[msg("Signer is not the protocol admin")]
    NotAdmin,
    #[msg("Protocol is paused")]
    Paused,
    #[msg("Invalid project status for this action")]
    InvalidStatus,
    #[msg("Release would exceed the project budget")]
    ExceedsBudget,
    #[msg("NDVI delta is below the required threshold")]
    ImpactTooLow,
    #[msg("Beneficiary has not been set")]
    BeneficiaryNotSet,
    #[msg("Beneficiary account does not match or is invalid")]
    InvalidBeneficiary,
    #[msg("Vault has insufficient funds above the rent reserve")]
    InsufficientVaultFunds,
    #[msg("Amount must be greater than zero")]
    InvalidAmount,
    #[msg("This contribution has already been refunded")]
    AlreadyRefunded,
    #[msg("Nothing available to refund")]
    NothingToRefund,
    #[msg("Arithmetic overflow")]
    MathOverflow,
    #[msg("Fee basis points exceed the allowed maximum")]
    InvalidFeeBps,
    #[msg("Vault still holds escrowed funds")]
    VaultNotEmpty,
}
