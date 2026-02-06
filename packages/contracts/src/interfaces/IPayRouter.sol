// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IPayRouter — Public interface for AbiPago's payment settlement contract.
 */
interface IPayRouter {
    /* ─── Structs ──────────────────────────────────────────────── */

    /// @notice Represents an invoice to be settled on-chain.
    struct Invoice {
        address receiver;   // Merchant wallet (from ENS pay.receiver)
        address tokenOut;   // Token merchant wants (from ENS pay.token)
        uint256 amountOut;  // Exact amount in token decimals merchant expects
        uint256 deadline;   // block.timestamp limit (0 = no expiry)
        bytes32 ref;        // Unique payment reference (keccak256 of "coffee42" etc.)
        uint256 nonce;      // Replay protection — should be unique per invoice
    }

    /* ─── Events ───────────────────────────────────────────────── */

    /// @notice Emitted when a payment is successfully settled.
    event PaymentExecuted(
        bytes32 indexed ref,
        address indexed receiver,
        address indexed payer,
        address tokenIn,
        uint256 amountIn,
        address tokenOut,
        uint256 amountOut,
        uint256 timestamp
    );

    /// @notice Emitted when a batch settlement is executed.
    event BatchSettled(uint256 count, uint256 timestamp);

    /* ─── Functions ────────────────────────────────────────────── */

    /// @notice Settle a single invoice. If tokenIn == tokenOut, direct transfer.
    ///         If tokenIn != tokenOut, performs a swap via Uniswap V4 first.
    /// @param invoice   The invoice to settle.
    /// @param tokenIn   The token being provided (from LI.FI bridge output).
    /// @param amountIn  The amount of tokenIn being provided.
    /// @param swapData  ABI-encoded swap params for Universal Router (empty if no swap needed).
    function settle(
        Invoice calldata invoice,
        address tokenIn,
        uint256 amountIn,
        bytes calldata swapData
    ) external;

    /// @notice Settle multiple invoices in one transaction.
    /// @param invoices  Array of invoices.
    /// @param tokenIn   Common input token for all.
    /// @param amountIn  Total amount of tokenIn provided.
    /// @param swapData  Encoded swap data (empty if direct).
    function settleBatch(
        Invoice[] calldata invoices,
        address tokenIn,
        uint256 amountIn,
        bytes calldata swapData
    ) external;
}
