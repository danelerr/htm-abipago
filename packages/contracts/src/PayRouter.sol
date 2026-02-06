// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "./interfaces/IERC20.sol";
import {IPayRouter} from "./interfaces/IPayRouter.sol";
import {IUniversalRouter} from "./interfaces/IUniversalRouter.sol";

/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║                     AbiPago — PayRouter                        ║
 * ╠══════════════════════════════════════════════════════════════════╣
 * ║  Settlement contract deployed on the DESTINATION chain.        ║
 * ║                                                                ║
 * ║  Flow:                                                         ║
 * ║  1. LI.FI bridges funds to this chain                          ║
 * ║  2. Caller (or LI.FI contract call) invokes settle()           ║
 * ║  3. If tokenIn == tokenOut → direct transfer to merchant       ║
 * ║  4. If tokenIn != tokenOut → swap via Uniswap V4, then pay    ║
 * ║  5. Emits PaymentExecuted event (on-chain receipt)             ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * Bounties targeted:
 *   • Uniswap Foundation — V4 swap integration
 *   • LI.FI — cross-chain Composer endpoint
 *   • ENS — payment profile resolution (off-chain, but ref stored here)
 */
contract PayRouter is IPayRouter {
    /* ─── State ────────────────────────────────────────────────── */

    address public owner;
    IUniversalRouter public universalRouter;

    /// @notice Tracks settled invoice hashes to prevent replay.
    mapping(bytes32 => bool) public settled;

    /* ─── Errors ───────────────────────────────────────────────── */

    error InvoiceExpired();
    error AlreadySettled();
    error InsufficientInput();
    error SwapOutputInsufficient();
    error TransferFailed();
    error Unauthorized();
    error ZeroAddress();

    /* ─── Constructor ──────────────────────────────────────────── */

    /// @param _universalRouter Address of Uniswap's Universal Router on this chain.
    ///        See deployments: https://docs.uniswap.org/contracts/v4/deployments
    constructor(address _universalRouter) {
        if (_universalRouter == address(0)) revert ZeroAddress();
        owner = msg.sender;
        universalRouter = IUniversalRouter(_universalRouter);
    }

    /* ─── Modifiers ────────────────────────────────────────────── */

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    /* ═══════════════════════════════════════════════════════════════
     *  CORE: settle()
     * ═══════════════════════════════════════════════════════════════ */

    /// @inheritdoc IPayRouter
    function settle(
        Invoice calldata invoice,
        address tokenIn,
        uint256 amountIn,
        bytes calldata swapData
    ) external override {
        _validateInvoice(invoice);

        bytes32 invoiceId = _invoiceId(invoice);
        if (settled[invoiceId]) revert AlreadySettled();
        settled[invoiceId] = true;

        // Pull tokenIn from caller
        _safeTransferFrom(tokenIn, msg.sender, address(this), amountIn);

        if (tokenIn == invoice.tokenOut) {
            // ── Direct payment (no swap needed) ──────────────────
            if (amountIn < invoice.amountOut) revert InsufficientInput();
            _safeTransfer(invoice.tokenOut, invoice.receiver, invoice.amountOut);

            // Refund dust
            uint256 dust = amountIn - invoice.amountOut;
            if (dust > 0) {
                _safeTransfer(tokenIn, msg.sender, dust);
            }
        } else {
            // ── Swap via Uniswap V4 then pay ─────────────────────
            _swapAndPay(tokenIn, amountIn, invoice, swapData);
        }

        emit PaymentExecuted(
            invoice.ref,
            invoice.receiver,
            msg.sender,
            tokenIn,
            amountIn,
            invoice.tokenOut,
            invoice.amountOut,
            block.timestamp
        );
    }

    /* ═══════════════════════════════════════════════════════════════
     *  CORE: settleBatch()
     * ═══════════════════════════════════════════════════════════════ */

    /// @inheritdoc IPayRouter
    function settleBatch(
        Invoice[] calldata invoices,
        address tokenIn,
        uint256 amountIn,
        bytes calldata swapData
    ) external override {
        // Pull total tokenIn once
        _safeTransferFrom(tokenIn, msg.sender, address(this), amountIn);

        uint256 totalRequired;
        for (uint256 i; i < invoices.length; ++i) {
            totalRequired += invoices[i].amountOut;
        }

        // If swap is needed, execute it first to convert all tokenIn → tokenOut
        bool needsSwap = invoices.length > 0 && tokenIn != invoices[0].tokenOut;
        if (needsSwap && swapData.length > 0) {
            IERC20(tokenIn).approve(address(universalRouter), amountIn);
            // Decode and execute Universal Router commands
            (bytes memory commands, bytes[] memory inputs, uint256 deadline) =
                abi.decode(swapData, (bytes, bytes[], uint256));
            universalRouter.execute(commands, inputs, deadline);
        }

        // Distribute to each receiver
        for (uint256 i; i < invoices.length; ++i) {
            Invoice calldata inv = invoices[i];
            _validateInvoice(inv);

            bytes32 invoiceId = _invoiceId(inv);
            if (settled[invoiceId]) revert AlreadySettled();
            settled[invoiceId] = true;

            if (!needsSwap) {
                _safeTransfer(tokenIn, inv.receiver, inv.amountOut);
            } else {
                _safeTransfer(inv.tokenOut, inv.receiver, inv.amountOut);
            }

            emit PaymentExecuted(
                inv.ref,
                inv.receiver,
                msg.sender,
                tokenIn,
                inv.amountOut, // approximate per-invoice input
                inv.tokenOut,
                inv.amountOut,
                block.timestamp
            );
        }

        emit BatchSettled(invoices.length, block.timestamp);
    }

    /* ═══════════════════════════════════════════════════════════════
     *  INTERNAL: Swap logic (Uniswap V4 via Universal Router)
     * ═══════════════════════════════════════════════════════════════ */

    /**
     * @dev Approve Universal Router, execute V4 swap, verify output, pay merchant.
     *
     * The `swapData` should be ABI-encoded as:
     *   abi.encode(bytes commands, bytes[] inputs, uint256 deadline)
     *
     * For a V4_SWAP (command 0x10), the input encodes:
     *   - actions: packed bytes of action IDs
     *       0x06 = SWAP_EXACT_IN_SINGLE
     *       0x0c = SETTLE_ALL
     *       0x09 = TAKE_ALL
     *   - params[]: ABI-encoded params for each action
     *
     * Example construction (off-chain):
     * ```
     * const actions = ethers.solidityPacked(
     *   ['uint8', 'uint8', 'uint8'],
     *   [0x06, 0x0c, 0x09]
     * );
     * const swapParam = ethers.AbiCoder.defaultAbiCoder().encode(
     *   ['tuple(...)'], [exactInputSingleParams]
     * );
     * const settleParam = ethers.AbiCoder.defaultAbiCoder().encode(
     *   ['address', 'uint256'], [tokenIn, maxAmount]
     * );
     * const takeParam = ethers.AbiCoder.defaultAbiCoder().encode(
     *   ['address', 'uint256'], [tokenOut, minAmount]
     * );
     * const v4Input = ethers.AbiCoder.defaultAbiCoder().encode(
     *   ['bytes', 'bytes[]'],
     *   [actions, [swapParam, settleParam, takeParam]]
     * );
     * const commands = '0x10'; // V4_SWAP
     * const swapData = ethers.AbiCoder.defaultAbiCoder().encode(
     *   ['bytes', 'bytes[]', 'uint256'],
     *   [commands, [v4Input], deadline]
     * );
     * ```
     */
    function _swapAndPay(
        address tokenIn,
        uint256 amountIn,
        Invoice calldata invoice,
        bytes calldata swapData
    ) internal {
        // Approve Universal Router to spend tokenIn
        IERC20(tokenIn).approve(address(universalRouter), amountIn);

        if (swapData.length > 0) {
            // Decode the pre-built Universal Router calldata
            (bytes memory commands, bytes[] memory inputs, uint256 deadline) =
                abi.decode(swapData, (bytes, bytes[], uint256));

            universalRouter.execute(commands, inputs, deadline);
        }

        // After swap, check we have enough tokenOut
        uint256 balance = IERC20(invoice.tokenOut).balanceOf(address(this));
        if (balance < invoice.amountOut) revert SwapOutputInsufficient();

        // Pay merchant
        _safeTransfer(invoice.tokenOut, invoice.receiver, invoice.amountOut);

        // Refund any excess tokenOut to caller
        uint256 excess = IERC20(invoice.tokenOut).balanceOf(address(this));
        if (excess > 0) {
            _safeTransfer(invoice.tokenOut, msg.sender, excess);
        }

        // Refund any remaining tokenIn to caller
        uint256 remainingIn = IERC20(tokenIn).balanceOf(address(this));
        if (remainingIn > 0) {
            _safeTransfer(tokenIn, msg.sender, remainingIn);
        }
    }

    /* ═══════════════════════════════════════════════════════════════
     *  INTERNAL HELPERS
     * ═══════════════════════════════════════════════════════════════ */

    function _validateInvoice(Invoice calldata inv) internal view {
        if (inv.receiver == address(0)) revert ZeroAddress();
        if (inv.deadline != 0 && block.timestamp > inv.deadline) revert InvoiceExpired();
    }

    function _invoiceId(Invoice calldata inv) internal pure returns (bytes32) {
        return keccak256(abi.encode(inv.receiver, inv.tokenOut, inv.amountOut, inv.ref, inv.nonce));
    }

    function _safeTransfer(address token, address to, uint256 amount) internal {
        bool ok = IERC20(token).transfer(to, amount);
        if (!ok) revert TransferFailed();
    }

    function _safeTransferFrom(address token, address from, address to, uint256 amount) internal {
        bool ok = IERC20(token).transferFrom(from, to, amount);
        if (!ok) revert TransferFailed();
    }

    /* ═══════════════════════════════════════════════════════════════
     *  ADMIN
     * ═══════════════════════════════════════════════════════════════ */

    /// @notice Update Universal Router address (e.g., after Uniswap upgrade).
    function setUniversalRouter(address _router) external onlyOwner {
        if (_router == address(0)) revert ZeroAddress();
        universalRouter = IUniversalRouter(_router);
    }

    /// @notice Transfer ownership.
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        owner = newOwner;
    }

    /// @notice Emergency rescue of stuck tokens.
    function rescue(address token, address to, uint256 amount) external onlyOwner {
        _safeTransfer(token, to, amount);
    }

    /// @notice Allow contract to receive ETH (for potential native-token swaps).
    receive() external payable {}
}
