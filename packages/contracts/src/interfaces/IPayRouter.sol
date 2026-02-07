// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IPayRouter — Public interface for AbiPago's payment settlement contract.
 * @notice Deployed on the DESTINATION chain. Settles invoices for merchants.
 *
 * Three settlement modes:
 *   1. settle()           — Caller provides tokens via transferFrom.
 *   2. settleFromBridge() — Tokens already at contract (LI.FI contractCall).
 *   3. settleNative()     — Caller sends native ETH (auto-wrapped to WETH).
 *
 * If tokenIn != tokenOut, an on-chain swap is executed via Uniswap V4
 * (Universal Router) before transferring to the merchant.
 */
interface IPayRouter {
    /* ─── Structs ──────────────────────────────────────────────── */

    /// @notice Represents an invoice to be settled on-chain.
    struct Invoice {
        address receiver;       // Merchant wallet (from ENS pay.receiver)
        address tokenOut;       // Token merchant wants (from ENS pay.token)
        uint256 amountOut;      // Exact amount in token decimals merchant expects
        uint256 deadline;       // block.timestamp limit (0 = no expiry)
        bytes32 ref;            // Unique payment reference (keccak256 of "coffee42" etc.)
        uint256 nonce;          // Replay protection — unique per invoice
    }

    /// @notice Configuration for protocol fee (optional).
    struct FeeConfig {
        address feeRecipient;   // Where protocol fees go (address(0) = no fee)
        uint16  feeBps;         // Fee in basis points (max 100 = 1%)
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
        uint256 fee,
        uint256 timestamp
    );

    /// @notice Emitted when a batch settlement is executed.
    event BatchSettled(uint256 count, uint256 timestamp);

    /// @notice Emitted when a bridge settlement is executed (LI.FI contractCall).
    event BridgeSettlement(
        bytes32 indexed ref,
        address indexed receiver,
        address bridgeToken,
        uint256 bridgeAmount,
        address tokenOut,
        uint256 amountOut,
        uint256 timestamp
    );

    /// @notice Emitted when protocol fee config is updated.
    event FeeConfigUpdated(address feeRecipient, uint16 feeBps);

    /// @notice Emitted when Universal Router address is updated.
    event UniversalRouterUpdated(address indexed newRouter);

    /// @notice Emitted when ownership is transferred.
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    /* ─── Functions ────────────────────────────────────────────── */

    /// @notice Settle a single invoice. Caller provides tokenIn via approve+transferFrom.
    ///         If tokenIn == tokenOut → direct transfer.
    ///         If tokenIn != tokenOut → swap via Uniswap V4 first.
    /// @param invoice   The invoice to settle.
    /// @param tokenIn   The token being provided (from user's wallet).
    /// @param amountIn  The amount of tokenIn being provided.
    /// @param swapData  ABI-encoded swap params for Universal Router (empty if no swap).
    function settle(
        Invoice calldata invoice,
        address tokenIn,
        uint256 amountIn,
        bytes calldata swapData
    ) external;

    /// @notice Settle an invoice with tokens already at this contract.
    ///         Used by LI.FI Composer's contractCall feature: LI.FI bridges tokens
    ///         to this contract, then calls this function.
    /// @param invoice     The invoice to settle.
    /// @param tokenIn     The bridged token already at this contract.
    /// @param minAmountIn Minimum expected bridged amount (slippage protection).
    /// @param swapData    ABI-encoded swap params for Universal Router (empty if no swap).
    function settleFromBridge(
        Invoice calldata invoice,
        address tokenIn,
        uint256 minAmountIn,
        bytes calldata swapData
    ) external;

    /// @notice Settle an invoice with native ETH. Wraps ETH → WETH automatically.
    ///         If merchant wants WETH → direct transfer.
    ///         If merchant wants another token → WETH is swapped via Uniswap V4.
    /// @param invoice   The invoice to settle.
    /// @param swapData  ABI-encoded swap params for Universal Router (empty if WETH).
    function settleNative(
        Invoice calldata invoice,
        bytes calldata swapData
    ) external payable;

    /// @notice Settle multiple invoices in one transaction (privacy batch).
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
