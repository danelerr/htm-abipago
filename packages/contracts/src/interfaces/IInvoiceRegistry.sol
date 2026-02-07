// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IInvoiceRegistry — Interface for on-chain invoice creation and tracking.
 * @notice Merchants create invoices on-chain. PayRouter marks them as settled.
 *         Complements ENS Payment Profile by providing verifiable invoice state.
 *
 * ENS Integration:
 *   - Merchant's ENS text records define payment profile (pay.receiver, pay.token, etc.)
 *   - InvoiceRegistry stores individual invoice data on-chain
 *   - Optional: invoice subnames (inv-00042.cafeteria.eth) can point to invoiceId
 */
interface IInvoiceRegistry {
    /* ─── Enums ────────────────────────────────────────────────── */

    enum InvoiceStatus {
        None,       // Does not exist
        Active,     // Created, awaiting payment
        Settled,    // Paid via PayRouter
        Cancelled,  // Cancelled by merchant
        Expired     // Past deadline (checked dynamically)
    }

    /* ─── Structs ──────────────────────────────────────────────── */

    /// @notice On-chain invoice record.
    struct InvoiceData {
        address merchant;       // Creator / ENS owner (msg.sender on create)
        address receiver;       // Payment receiver (from ENS pay.receiver)
        address tokenOut;       // Desired token (from ENS pay.token)
        uint256 amountOut;      // Amount in token decimals
        uint256 deadline;       // Expiry timestamp (0 = no expiry)
        bytes32 ref;            // Human-readable reference hash (keccak256("coffee42"))
        uint256 nonce;          // Auto-incremented per merchant
        string  memo;           // Optional memo (e.g., "Café Sánchez - Order #42")
        uint256 createdAt;      // Block timestamp of creation
        InvoiceStatus status;   // Current status
        bytes32 settlementTx;   // Set by PayRouter after settlement (optional ref)
    }

    /* ─── Events ───────────────────────────────────────────────── */

    /// @notice Emitted when a new invoice is created.
    event InvoiceCreated(
        bytes32 indexed invoiceId,
        address indexed merchant,
        address indexed receiver,
        address tokenOut,
        uint256 amountOut,
        uint256 deadline,
        bytes32 ref,
        uint256 nonce,
        string  memo
    );

    /// @notice Emitted when an invoice is cancelled by the merchant.
    event InvoiceCancelled(bytes32 indexed invoiceId, address indexed merchant);

    /// @notice Emitted when an invoice is marked as settled.
    event InvoiceSettled(bytes32 indexed invoiceId, bytes32 settlementRef);

    /// @notice Emitted when a PayRouter is authorized/deauthorized.
    event PayRouterUpdated(address indexed router, bool authorized);

    /* ─── Functions ────────────────────────────────────────────── */

    /// @notice Create a new invoice. Returns the unique invoiceId.
    function createInvoice(
        address receiver,
        address tokenOut,
        uint256 amountOut,
        uint256 deadline,
        bytes32 ref,
        string calldata memo
    ) external returns (bytes32 invoiceId);

    /// @notice Cancel an active invoice (only merchant/creator).
    function cancelInvoice(bytes32 invoiceId) external;

    /// @notice Mark an invoice as settled (only authorized PayRouter).
    function markSettled(bytes32 invoiceId, bytes32 settlementRef) external;

    /// @notice Get full invoice data.
    function getInvoice(bytes32 invoiceId) external view returns (InvoiceData memory);

    /// @notice Get current effective status (considers deadline for expiry).
    function getStatus(bytes32 invoiceId) external view returns (InvoiceStatus);

    /// @notice Get merchant's invoice count (for nonce tracking).
    function merchantNonce(address merchant) external view returns (uint256);
}
