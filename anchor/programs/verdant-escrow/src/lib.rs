use anchor_lang::prelude::*;

declare_id!("Verdant111111111111111111111111111111111111");

#[program]
pub mod verdant_escrow {
    use super::*;

    /// Inizializza l'account di Escrow associato ad un progetto di riforestazione.
    pub fn initialize_escrow(
        ctx: Context<InitializeEscrow>,
        project_id: String,
        ndvi_threshold_scaled: u64, // E.g. 52 rappresenta 0.52
        coordinator: Pubkey,
        treasurer: Pubkey,
    ) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow_account;
        
        // Controlla la lunghezza dell'ID progetto per evitare overflow
        require!(project_id.len() <= 32, EscrowError::ProjectIdTooLong);

        escrow.project_id = project_id;
        escrow.ndvi_threshold = ndvi_threshold_scaled;
        escrow.coordinator = coordinator;
        escrow.treasurer = treasurer;
        escrow.total_deposited = 0;
        escrow.total_released = 0;
        escrow.bump = ctx.bumps.escrow_account;

        msg!("Escrow initialized for project: {}. Threshold: {}. Coordinator: {}", 
             escrow.project_id, escrow.ndvi_threshold, escrow.coordinator);
        Ok(())
    }

    /// Deposita lamports nell'escrow del progetto.
    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow_account;
        
        // Esegue il trasferimento di lamports dal contributor al PDA di Escrow
        let ix = anchor_lang::solana_program::system_instruction::transfer(
            &ctx.accounts.contributor.key(),
            &escrow.key(),
            amount,
        );
        anchor_lang::solana_program::program::invoke(
            &ix,
            &[
                ctx.accounts.contributor.to_account_info(),
                escrow.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;

        escrow.total_deposited = escrow.total_deposited.checked_add(amount)
            .ok_or(EscrowError::MathOverflow)?;

        msg!("Deposited {} lamports into project escrow.", amount);
        Ok(())
    }

    /// Rilascia i fondi condizionati all'impatto misurato (NDVI delta).
    /// Questa istruzione può essere firmata solo dall'agente tesoriere autorizzato.
    pub fn release_funds(ctx: Context<ReleaseFunds>, ndvi_delta_scaled: u64) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow_account;
        
        // Verifica che l'agente tesoriere firmatario corrisponda a quello registrato
        require_keys_eq!(ctx.accounts.treasurer.key(), escrow.treasurer, EscrowError::UnauthorizedSigner);

        // Verifica che la variazione di NDVI soddisfi o superi la soglia programmata
        msg!("Auditing NDVI delta: {} (Threshold: {})", ndvi_delta_scaled, escrow.ndvi_threshold);
        require!(ndvi_delta_scaled >= escrow.ndvi_threshold, EscrowError::ThresholdNotMet);

        // Calcola il saldo disponibile dell'account
        let balance = escrow.to_account_info().lamports();
        
        // Rilascia una percentuale proporzionale (es. 40% del saldo rimanente)
        let amount_to_release = balance.checked_mul(40).ok_or(EscrowError::MathOverflow)? / 100;
        require!(amount_to_release > 0, EscrowError::InsufficientFunds);

        // Trasferisce i lamports dal PDA all'account coordinatore
        **escrow.to_account_info().try_borrow_mut_lamports()? = balance
            .checked_sub(amount_to_release)
            .ok_or(EscrowError::MathOverflow)?;
            
        **ctx.accounts.coordinator.try_borrow_mut_lamports()? = ctx.accounts.coordinator.lamports()
            .checked_add(amount_to_release)
            .ok_or(EscrowError::MathOverflow)?;

        escrow.total_released = escrow.total_released.checked_add(amount_to_release)
            .ok_or(EscrowError::MathOverflow)?;

        // Emette l'evento di verifica onchain
        emit!(ImpactVerified {
            project_id: escrow.project_id.clone(),
            ndvi_delta: ndvi_delta_scaled,
            released_amount: amount_to_release,
            timestamp: Clock::get()?.unix_timestamp,
        });

        msg!("Impact verified successfully! Released {} lamports to coordinator: {}", 
             amount_to_release, escrow.coordinator);
        Ok(())
    }
}

// Strutture di validazione degli account

#[derive(Accounts)]
#[instruction(project_id: String)]
pub struct InitializeEscrow<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    // PDA derivato dall'ID progetto
    #[account(
        init,
        payer = authority,
        space = 8 + 36 + 8 + 8 + 8 + 32 + 32 + 1,
        seeds = [b"escrow", project_id.as_bytes()],
        bump
    )]
    pub escrow_account: Account<'info, EscrowAccount>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub contributor: Signer<'info>,

    #[account(
        mut,
        seeds = [b"escrow", escrow_account.project_id.as_bytes()],
        bump = escrow_account.bump
    )]
    pub escrow_account: Account<'info, EscrowAccount>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ReleaseFunds<'info> {
    #[account(mut)]
    pub treasurer: Signer<'info>, // L'agente tesoriere che firma la transazione

    #[account(
        mut,
        seeds = [b"escrow", escrow_account.project_id.as_bytes()],
        bump = escrow_account.bump
    )]
    pub escrow_account: Account<'info, EscrowAccount>,

    /// Check che corrisponda al coordinatore salvato nell'escrow
    #[account(mut, address = escrow_account.coordinator)]
    /// CHECK: Validated in instructions or attributes
    pub coordinator: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

// Stato dell'Escrow
#[account]
pub struct EscrowAccount {
    pub project_id: String,     // Max 32 caratteri
    pub ndvi_threshold: u64,    // Soglia NDVI scalata
    pub total_deposited: u64,   // Lamports totali depositati
    pub total_released: u64,    // Lamports totali rilasciati
    pub coordinator: Pubkey,    // Destinatario dei fondi (ONG)
    pub treasurer: Pubkey,      // Agente IA autorizzato a rilasciare
    pub bump: u8,
}

// Codici di errore personalizzati
#[error_code]
pub enum EscrowError {
    #[msg("Project ID cannot exceed 32 characters.")]
    ProjectIdTooLong,
    #[msg("Authorized treasurer signature is missing or invalid.")]
    UnauthorizedSigner,
    #[msg("Scanned NDVI delta does not meet the required threshold.")]
    ThresholdNotMet,
    #[msg("Math overflow during calculations.")]
    MathOverflow,
    #[msg("Insufficient balance in the project escrow vault.")]
    InsufficientFunds,
}

// Evento di Proof-of-Impact
#[event]
pub struct ImpactVerified {
    pub project_id: String,
    pub ndvi_delta: u64,
    pub released_amount: u64,
    pub timestamp: i64,
}
