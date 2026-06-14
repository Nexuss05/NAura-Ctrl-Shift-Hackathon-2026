// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title NauraEscrow
/// @notice User-controlled, milestone-based reforestation escrow (EVM port of the Naura program).
///         Donors fund a project in ETH; the project's authority — a human, no AI — releases funds to a
///         beneficiary organization in milestones, each gated by an NDVI threshold and the budget cap.
///         A protocol fee is taken on release. A project can be cancelled before any release, after which
///         each contributor can withdraw their full contribution. The owner can pause and, while paused,
///         perform an emergency withdrawal.
/// @dev NDVI is represented as an integer scaled by 1000 (no floats), matching the Solana program.
contract NauraEscrow is Ownable, ReentrancyGuard {
    // ----------------------------------------------------------------- config
    uint16 public feeBps; // protocol fee in basis points (10000 = 100%)
    address public feeTreasury; // receives the fee on each release
    bool public paused; // global pause for create / fund / release

    uint16 public constant MAX_FEE_BPS = 1000; // hard cap: 10%
    int256 public constant MAX_NDVI = 1000; // NDVI 1.0 x 1000

    enum Status {
        Active,
        Completed,
        Cancelled
    }

    struct Project {
        address funder; // creator
        address authority; // may set the beneficiary + release (the user)
        address beneficiary; // org receiving released funds
        uint256 budget; // funding cap (wei)
        uint256 totalFunded; // total escrowed (wei)
        uint256 released; // total released gross, fee included (wei)
        int256 ndviThreshold; // NDVI x 1000 required to release
        bytes32 planHash; // hash of the user's plan (audit anchor)
        bytes2 countryCode; // ISO-3166-1 alpha-2
        Status status;
    }

    uint256 public nextProjectId;
    mapping(uint256 => Project) private _projects;
    /// @notice id => contributor => amount escrowed (wei), used for refunds on cancellation.
    mapping(uint256 => mapping(address => uint256)) public contributions;

    // ----------------------------------------------------------------- errors
    error EscrowPaused();
    error NotPaused();
    error NotAuthority();
    error InvalidBudget();
    error InvalidAmount();
    error InvalidNdviThreshold();
    error InvalidFeeBps();
    error ZeroAddress();
    error BeneficiaryIsTreasury();
    error ProjectNotActive();
    error ProjectNotCancelled();
    error BeneficiaryNotSet();
    error ExceedsBudget();
    error NdviThresholdNotMet();
    error InsufficientEscrow();
    error AlreadyReleased();
    error NothingToRefund();
    error NothingToWithdraw();
    error TransferFailed();

    // ----------------------------------------------------------------- events
    event ConfigUpdated(uint16 feeBps, address feeTreasury);
    event PausedSet(bool paused);
    event ProjectCreated(
        uint256 indexed id,
        address indexed funder,
        address authority,
        uint256 budget,
        int256 ndviThreshold,
        bytes2 countryCode,
        bytes32 planHash
    );
    event Funded(uint256 indexed id, address indexed contributor, uint256 amount, uint256 totalFunded);
    event BeneficiarySet(uint256 indexed id, address indexed beneficiary);
    event Released(uint256 indexed id, address indexed beneficiary, uint256 amount, uint256 fee, int256 ndvi, uint256 released);
    event Completed(uint256 indexed id);
    event Cancelled(uint256 indexed id);
    event Refunded(uint256 indexed id, address indexed contributor, uint256 amount);
    event EmergencyWithdrawn(uint256 indexed id, address indexed to, uint256 amount);

    constructor(uint16 _feeBps, address _feeTreasury) Ownable(msg.sender) {
        if (_feeBps > MAX_FEE_BPS) revert InvalidFeeBps();
        if (_feeTreasury == address(0)) revert ZeroAddress();
        feeBps = _feeBps;
        feeTreasury = _feeTreasury;
        emit ConfigUpdated(_feeBps, _feeTreasury);
    }

    modifier whenNotPaused() {
        if (paused) revert EscrowPaused();
        _;
    }

    // ------------------------------------------------------------------ admin
    function setConfig(uint16 _feeBps, address _feeTreasury) external onlyOwner {
        if (_feeBps > MAX_FEE_BPS) revert InvalidFeeBps();
        if (_feeTreasury == address(0)) revert ZeroAddress();
        feeBps = _feeBps;
        feeTreasury = _feeTreasury;
        emit ConfigUpdated(_feeBps, _feeTreasury);
    }

    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit PausedSet(_paused);
    }

    // -------------------------------------------------------------- lifecycle
    /// @notice Create a project. The caller is the funder; `authority` is who may release (the user).
    function createProject(
        bytes2 countryCode,
        uint256 budget,
        bytes32 planHash,
        int256 ndviThreshold,
        address authority
    ) external whenNotPaused returns (uint256 id) {
        if (budget == 0) revert InvalidBudget();
        if (ndviThreshold < 0 || ndviThreshold > MAX_NDVI) revert InvalidNdviThreshold();
        if (authority == address(0)) revert ZeroAddress();

        id = nextProjectId++;
        Project storage p = _projects[id];
        p.funder = msg.sender;
        p.authority = authority;
        p.budget = budget;
        p.ndviThreshold = ndviThreshold;
        p.planHash = planHash;
        p.countryCode = countryCode;
        p.status = Status.Active;

        emit ProjectCreated(id, msg.sender, authority, budget, ndviThreshold, countryCode, planHash);
    }

    /// @notice Escrow ETH into a project, up to its budget. Anyone can contribute (multi-party funding).
    function fundProject(uint256 id) external payable whenNotPaused nonReentrant {
        Project storage p = _projects[id];
        if (p.status != Status.Active) revert ProjectNotActive();
        if (msg.value == 0) revert InvalidAmount();
        if (p.totalFunded + msg.value > p.budget) revert ExceedsBudget();

        p.totalFunded += msg.value;
        contributions[id][msg.sender] += msg.value;
        emit Funded(id, msg.sender, msg.value, p.totalFunded);
    }

    /// @notice Set the beneficiary org. Only the project authority. Cannot equal the fee treasury.
    function setBeneficiary(uint256 id, address beneficiary) external {
        Project storage p = _projects[id];
        if (msg.sender != p.authority) revert NotAuthority();
        if (p.status != Status.Active) revert ProjectNotActive();
        if (beneficiary == address(0)) revert ZeroAddress();
        if (beneficiary == feeTreasury) revert BeneficiaryIsTreasury();
        p.beneficiary = beneficiary;
        emit BeneficiarySet(id, beneficiary);
    }

    /// @notice Release a milestone amount to the beneficiary, gated by the NDVI threshold and escrow.
    ///         The authority (the user) decides whether and when to call this — there is no AI.
    /// @param ndvi The current NDVI reading (x1000); must be >= the project's threshold.
    function release(uint256 id, uint256 amount, int256 ndvi) external whenNotPaused nonReentrant {
        Project storage p = _projects[id];
        if (msg.sender != p.authority) revert NotAuthority();
        if (p.status != Status.Active) revert ProjectNotActive();
        if (p.beneficiary == address(0)) revert BeneficiaryNotSet();
        if (amount == 0) revert InvalidAmount();
        if (ndvi < p.ndviThreshold) revert NdviThresholdNotMet();
        if (p.released + amount > p.totalFunded) revert InsufficientEscrow();

        uint256 fee = (amount * feeBps) / 10000;
        uint256 net = amount - fee;
        p.released += amount; // effects before interactions

        if (fee > 0) _send(feeTreasury, fee);
        _send(p.beneficiary, net);

        emit Released(id, p.beneficiary, amount, fee, ndvi, p.released);

        if (p.released >= p.budget) {
            p.status = Status.Completed;
            emit Completed(id);
        }
    }

    /// @notice Cancel a project before any release. Authority or owner. Enables refunds.
    function cancelProject(uint256 id) external {
        Project storage p = _projects[id];
        if (msg.sender != p.authority && msg.sender != owner()) revert NotAuthority();
        if (p.status != Status.Active) revert ProjectNotActive();
        if (p.released != 0) revert AlreadyReleased();
        p.status = Status.Cancelled;
        emit Cancelled(id);
    }

    /// @notice After cancellation, each contributor withdraws their full contribution.
    function refund(uint256 id) external nonReentrant {
        Project storage p = _projects[id];
        if (p.status != Status.Cancelled) revert ProjectNotCancelled();
        uint256 amount = contributions[id][msg.sender];
        if (amount == 0) revert NothingToRefund();
        contributions[id][msg.sender] = 0;
        p.totalFunded -= amount;
        _send(msg.sender, amount);
        emit Refunded(id, msg.sender, amount);
    }

    /// @notice Owner can sweep a project's remaining escrow while the contract is paused.
    function emergencyWithdraw(uint256 id, address to) external onlyOwner nonReentrant {
        if (!paused) revert NotPaused();
        if (to == address(0)) revert ZeroAddress();
        Project storage p = _projects[id];
        uint256 remaining = p.totalFunded - p.released;
        if (remaining == 0) revert NothingToWithdraw();
        p.released = p.totalFunded;
        p.status = Status.Cancelled;
        _send(to, remaining);
        emit EmergencyWithdrawn(id, to, remaining);
    }

    // ------------------------------------------------------------------ views
    function getProject(uint256 id) external view returns (Project memory) {
        return _projects[id];
    }

    // --------------------------------------------------------------- internal
    function _send(address to, uint256 amount) private {
        (bool ok, ) = payable(to).call{value: amount}("");
        if (!ok) revert TransferFailed();
    }
}
