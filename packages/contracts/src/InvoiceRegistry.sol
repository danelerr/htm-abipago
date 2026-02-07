// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IInvoiceRegistry} from "./interfaces/IInvoiceRegistry.sol";

/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║              AbiPago — InvoiceRegistry                         ║
 * ╠══════════════════════════════════════════════════════════════════╣
 * ║  On-chain invoice creation and lifecycle management.           ║
 * ║                                                                ║
 * ║  Merchants create invoices → payers settle via PayRouter →     ║
 * ║  PayRouter calls markSettled() to close the loop.              ║
 * ║                                                                ║
 * ║  ENS Integration:                                              ║
 * ║  - Merchant creates invoice with data matching their ENS       ║
 * ║    Payment Profile (pay.receiver, pay.token, pay.chainId)      ║
 * ║  - invoiceId can be stored as ENS text record on a subname    ║
 * ║    e.g., inv-00042.cafeteria.eth → text("invoiceId") = 0x...  ║
 * ║                                                                ║
 * ║  Privacy consideration (Uniswap bounty narrative):             ║
 * ║  - On-chain invoices reduce reliance on centralized backends   ║
 * ║  - No PII stored on-chain (only hashed references)             ║
 * ║  - Batch settlement via PayRouter blurs 1:1 payment patterns   ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */
contract InvoiceRegistry is IInvoiceRegistry {
    /* ─── State ────────────────────────────────────────────────── */

    address public owner;

    /// @notice invoiceId => InvoiceData
    mapping(bytes32 => InvoiceData) internal _invoices;

    /// @notice merchant address => auto-incrementing nonce
    mapping(address => uint256) public override merchantNonce;

    /// @notice Authorized PayRouter contracts that can mark invoices settled.
    mapping(address => bool) public authorizedRouters;

    /// @notice Total invoices created (for stats / frontend).
    uint256 public totalInvoices;

    /* ─── Errors ───────────────────────────────────────────────── */

    error Unauthorized();
    error ZeroAddress();
    error ZeroAmount();
    error InvoiceNotFound();
    error InvoiceNotActive();
    error NotMerchant();
    error DeadlineInPast();

    /* ─── Constructor ──────────────────────────────────────────── */

    constructor() {
        owner = msg.sender;
    }

    /* ─── Modifiers ────────────────────────────────────────────── */

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier onlyAuthorizedRouter() {
        if (!authorizedRouters[msg.sender]) revert Unauthorized();
        _;
    }

    /* ═══════════════════════════════════════════════════════════════
     *  CORE: Create Invoice
     * ═══════════════════════════════════════════════════════════════ */

    /// @inheritdoc IInvoiceRegistry
    function createInvoice(
        address receiver,
        address tokenOut,
        uint256 amountOut,
        uint256 deadline,
        bytes32 ref,
        string calldata memo
    ) external override returns (bytes32 invoiceId) {
        if (receiver == address(0)) revert ZeroAddress();
        if (tokenOut == address(0)) revert ZeroAddress();
        if (amountOut == 0) revert ZeroAmount();
        if (deadline != 0 && deadline <= block.timestamp) revert DeadlineInPast();

        uint256 nonce = merchantNonce[msg.sender]++;

        invoiceId = _computeInvoiceId(msg.sender, receiver, tokenOut, amountOut, deadline, ref, nonce);

        _invoices[invoiceId] = InvoiceData({
            merchant: msg.sender,
            receiver: receiver,
            tokenOut: tokenOut,
            amountOut: amountOut,
            deadline: deadline,
            ref: ref,
            nonce: nonce,
            memo: memo,
            createdAt: block.timestamp,
            status: InvoiceStatus.Active,
            settlementTx: bytes32(0)
        });

        totalInvoices++;

        emit InvoiceCreated(
            invoiceId,
            msg.sender,
            receiver,
            tokenOut,
            amountOut,
            deadline,
            ref,
            nonce,
            memo
        );
    }

    /* ═══════════════════════════════════════════════════════════════
     *  CORE: Cancel Invoice
     * ═══════════════════════════════════════════════════════════════ */

    /// @inheritdoc IInvoiceRegistry
    function cancelInvoice(bytes32 invoiceId) external override {
        InvoiceData storage inv = _invoices[invoiceId];
        if (inv.merchant == address(0)) revert InvoiceNotFound();
        if (inv.merchant != msg.sender) revert NotMerchant();
        if (inv.status != InvoiceStatus.Active) revert InvoiceNotActive();

        inv.status = InvoiceStatus.Cancelled;
        emit InvoiceCancelled(invoiceId, msg.sender);
    }

    /* ═══════════════════════════════════════════════════════════════
     *  CORE: Mark Settled (called by PayRouter)
     * ═══════════════════════════════════════════════════════════════ */

    /// @inheritdoc IInvoiceRegistry
    function markSettled(bytes32 invoiceId, bytes32 settlementRef) external override onlyAuthorizedRouter {
        InvoiceData storage inv = _invoices[invoiceId];
        if (inv.merchant == address(0)) revert InvoiceNotFound();
        if (inv.status != InvoiceStatus.Active) revert InvoiceNotActive();

        inv.status = InvoiceStatus.Settled;
        inv.settlementTx = settlementRef;
        emit InvoiceSettled(invoiceId, settlementRef);
    }

    /* ═══════════════════════════════════════════════════════════════
     *  VIEW FUNCTIONS
     * ═══════════════════════════════════════════════════════════════ */

    /// @inheritdoc IInvoiceRegistry
    function getInvoice(bytes32 invoiceId) external view override returns (InvoiceData memory) {
        return _invoices[invoiceId];
    }

    /// @inheritdoc IInvoiceRegistry
    function getStatus(bytes32 invoiceId) external view override returns (InvoiceStatus) {
        InvoiceData storage inv = _invoices[invoiceId];
        if (inv.merchant == address(0)) return InvoiceStatus.None;

        // Dynamic expiry check
        if (inv.status == InvoiceStatus.Active && inv.deadline != 0 && block.timestamp > inv.deadline) {
            return InvoiceStatus.Expired;
        }

        return inv.status;
    }

    /// @notice Compute invoice ID off-chain (deterministic).
    function computeInvoiceId(
        address merchant,
        address receiver,
        address tokenOut,
        uint256 amountOut,
        uint256 deadline,
        bytes32 ref,
        uint256 nonce
    ) external pure returns (bytes32) {
        return _computeInvoiceId(merchant, receiver, tokenOut, amountOut, deadline, ref, nonce);
    }

    /* ═══════════════════════════════════════════════════════════════
     *  ADMIN
     * ═══════════════════════════════════════════════════════════════ */

    /// @notice Authorize or deauthorize a PayRouter to mark invoices settled.
    function setAuthorizedRouter(address router, bool authorized) external onlyOwner {
        if (router == address(0)) revert ZeroAddress();
        authorizedRouters[router] = authorized;
        emit PayRouterUpdated(router, authorized);
    }

    /// @notice Transfer ownership.
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        owner = newOwner;
    }

    /* ═══════════════════════════════════════════════════════════════
     *  INTERNAL
     * ═══════════════════════════════════════════════════════════════ */

    function _computeInvoiceId(
        address merchant,
        address receiver,
        address tokenOut,
        uint256 amountOut,
        uint256 deadline,
        bytes32 ref,
        uint256 nonce
    ) internal pure returns (bytes32) {
        return keccak256(
            abi.encode(merchant, receiver, tokenOut, amountOut, deadline, ref, nonce)
        );
    }
}
