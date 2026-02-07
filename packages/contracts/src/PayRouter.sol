// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// ── Official OpenZeppelin ──────────────────────────────────────
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// ── Official Uniswap V4 ───────────────────────────────────────
import {IUniversalRouter} from "@uniswap/universal-router/contracts/interfaces/IUniversalRouter.sol";
import {IWETH9} from "@uniswap/v4-periphery/src/interfaces/external/IWETH9.sol";

// ── Project-specific ──────────────────────────────────────────
import {IPayRouter} from "./interfaces/IPayRouter.sol";

/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║                     AbiPago — PayRouter v2                     ║
 * ╠══════════════════════════════════════════════════════════════════╣
 * ║  Settlement contract deployed on the DESTINATION chain.        ║
 * ║                                                                ║
 * ║  Settlement modes:                                             ║
 * ║  A. settle()           — User approve+transferFrom             ║
 * ║  B. settleFromBridge() — LI.FI contractCall (tokens at router) ║
 * ║  C. settleNative()     — Native ETH → auto-wrap to WETH       ║
 * ║  D. settleBatch()      — Multiple invoices in one tx           ║
 * ║                                                                ║
 * ║  Swap logic:                                                   ║
 * ║  • tokenIn == tokenOut → direct transfer to merchant           ║
 * ║  • tokenIn != tokenOut → Uniswap V4 swap via Universal Router ║
 * ║                                                                ║
 * ║  Emits PaymentExecuted event (on-chain receipt for every       ║
 * ║  settlement).                                                  ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * Official Uniswap V4 integration:
 *   • Commands.V4_SWAP (0x10) — swap command for Universal Router
 *   • Actions.SWAP_EXACT_IN_SINGLE / SETTLE_ALL / TAKE_ALL
 *   • IV4Router.ExactInputSingleParams — swap parameter struct
 *
 * Bounties targeted:
 *   • Uniswap Foundation — V4 swap integration
 *   • LI.FI — cross-chain Composer endpoint (contractCall)
 *   • ENS — payment profile resolution (off-chain, ref stored here)
 */
contract PayRouter is IPayRouter {
    /* ─── Constants ────────────────────────────────────────────── */

    /// @notice Maximum protocol fee: 1% (100 bps).
    uint16 public constant MAX_FEE_BPS = 100;

    /// @notice Sentinel for native ETH in token fields.
    address public constant NATIVE_ETH = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    /* ─── State ────────────────────────────────────────────────── */

    address public owner;
    IUniversalRouter public universalRouter;
    IWETH9 public weth;

    /// @notice Protocol fee configuration (optional, default = no fee).
    FeeConfig public feeConfig;

    /// @notice Tracks settled invoice hashes to prevent replay.
    mapping(bytes32 => bool) public settled;

    /// @notice Reentrancy guard flag.
    uint256 private _locked = 1;

    /* ─── Errors ───────────────────────────────────────────────── */

    error InvoiceExpired();
    error AlreadySettled();
    error InsufficientInput();
    error SwapOutputInsufficient();
    error TransferFailed();
    error Unauthorized();
    error ZeroAddress();
    error ZeroAmount();
    error FeeTooHigh();
    error Reentrancy();
    error InsufficientNativeValue();
    error BatchEmpty();
    error NativeTransferFailed();
    error TokenOutMismatch();

    /* ─── Constructor ──────────────────────────────────────────── */

    /// @param _universalRouter Address of Uniswap's Universal Router on this chain.
    /// @param _weth            Address of WETH (wrapped native) on this chain.
    constructor(address _universalRouter, address _weth) {
        if (_universalRouter == address(0)) revert ZeroAddress();
        if (_weth == address(0)) revert ZeroAddress();
        owner = msg.sender;
        universalRouter = IUniversalRouter(_universalRouter);
        weth = IWETH9(_weth);

        emit OwnershipTransferred(address(0), msg.sender);
    }

    /* ─── Modifiers ────────────────────────────────────────────── */

    modifier onlyOwner() {
        _checkOwner();
        _;
    }

    modifier nonReentrant() {
        _nonReentrantBefore();
        _;
        _nonReentrantAfter();
    }

    function _checkOwner() internal view {
        if (msg.sender != owner) revert Unauthorized();
    }

    function _nonReentrantBefore() internal {
        if (_locked == 2) revert Reentrancy();
        _locked = 2;
    }

    function _nonReentrantAfter() internal {
        _locked = 1;
    }

    /* ═══════════════════════════════════════════════════════════════
     *  MODE A: settle() — User provides tokens via approve+transferFrom
     * ═══════════════════════════════════════════════════════════════ */

    /// @inheritdoc IPayRouter
    function settle(
        Invoice calldata invoice,
        address tokenIn,
        uint256 amountIn,
        bytes calldata swapData,
        address refundTo
    ) external override nonReentrant {
        if (amountIn == 0) revert ZeroAmount();
        _validateInvoice(invoice);

        bytes32 invoiceId = _invoiceId(invoice);
        if (settled[invoiceId]) revert AlreadySettled();
        settled[invoiceId] = true;

        // Pull tokenIn from caller
        _safeTransferFrom(tokenIn, msg.sender, address(this), amountIn);

        uint256 fee = _settleSingle(invoice, tokenIn, amountIn, swapData, refundTo);

        emit PaymentExecuted(
            invoice.ref,
            invoice.receiver,
            msg.sender,
            tokenIn,
            amountIn,
            invoice.tokenOut,
            invoice.amountOut,
            fee,
            block.timestamp
        );
    }

    /* ═══════════════════════════════════════════════════════════════
     *  MODE B: settleFromBridge() — LI.FI contractCall
     *  Tokens already at this contract (LI.FI sent them before call)
     * ═══════════════════════════════════════════════════════════════ */

    /// @inheritdoc IPayRouter
    function settleFromBridge(
        Invoice calldata invoice,
        address tokenIn,
        uint256 amountIn,
        bytes calldata swapData,
        address refundTo
    ) external override nonReentrant {
        if (amountIn == 0) revert ZeroAmount();
        _validateInvoice(invoice);

        bytes32 invoiceId = _invoiceId(invoice);
        if (settled[invoiceId]) revert AlreadySettled();
        settled[invoiceId] = true;

        // Verify bridged tokens are available (sent by LI.FI before this call)
        uint256 balance = IERC20(tokenIn).balanceOf(address(this));
        if (balance < amountIn) revert InsufficientInput();

        uint256 fee = _settleSingle(invoice, tokenIn, amountIn, swapData, refundTo);

        emit BridgeSettlement(
            invoice.ref,
            invoice.receiver,
            tokenIn,
            amountIn,
            invoice.tokenOut,
            invoice.amountOut,
            block.timestamp
        );

        emit PaymentExecuted(
            invoice.ref,
            invoice.receiver,
            msg.sender,
            tokenIn,
            amountIn,
            invoice.tokenOut,
            invoice.amountOut,
            fee,
            block.timestamp
        );
    }

    /* ═══════════════════════════════════════════════════════════════
     *  MODE C: settleNative() — Native ETH, auto-wrapped to WETH
     * ═══════════════════════════════════════════════════════════════ */

    /// @inheritdoc IPayRouter
    function settleNative(
        Invoice calldata invoice,
        bytes calldata swapData,
        address refundTo
    ) external payable override nonReentrant {
        if (msg.value == 0) revert ZeroAmount();
        _validateInvoice(invoice);

        bytes32 invoiceId = _invoiceId(invoice);
        if (settled[invoiceId]) revert AlreadySettled();
        settled[invoiceId] = true;

        // Wrap native ETH → WETH
        weth.deposit{value: msg.value}();

        address wethAddr = address(weth);
        uint256 fee = _settleSingle(invoice, wethAddr, msg.value, swapData, refundTo);

        emit PaymentExecuted(
            invoice.ref,
            invoice.receiver,
            msg.sender,
            NATIVE_ETH,
            msg.value,
            invoice.tokenOut,
            invoice.amountOut,
            fee,
            block.timestamp
        );
    }

    /* ═══════════════════════════════════════════════════════════════
     *  MODE D: settleBatch() — Multiple invoices in one tx
     * ═══════════════════════════════════════════════════════════════ */

    /// @inheritdoc IPayRouter
    function settleBatch(
        Invoice[] calldata invoices,
        address tokenIn,
        uint256 amountIn,
        bytes calldata swapData,
        address refundTo
    ) external override nonReentrant {
        uint256 len = invoices.length;
        if (len == 0) revert BatchEmpty();
        if (amountIn == 0) revert ZeroAmount();

        // Validate all invoices share the same tokenOut
        address sharedTokenOut = invoices[0].tokenOut;
        for (uint256 i = 1; i < len; ++i) {
            if (invoices[i].tokenOut != sharedTokenOut) revert TokenOutMismatch();
        }

        // Pull total tokenIn once
        _safeTransferFrom(tokenIn, msg.sender, address(this), amountIn);

        // Check if swap is needed
        bool needsSwap = tokenIn != sharedTokenOut;

        if (needsSwap && swapData.length > 0) {
            IERC20(tokenIn).approve(address(universalRouter), amountIn);
            (bytes memory commands, bytes[] memory inputs, uint256 deadline) =
                abi.decode(swapData, (bytes, bytes[], uint256));
            universalRouter.execute(commands, inputs, deadline);
        }

        // Distribute to each receiver
        for (uint256 i; i < len; ++i) {
            _validateInvoice(invoices[i]);

            {
                bytes32 invoiceId = _invoiceId(invoices[i]);
                if (settled[invoiceId]) revert AlreadySettled();
                settled[invoiceId] = true;
            }

            {
                address payToken = needsSwap ? invoices[i].tokenOut : tokenIn;
                uint256 payAmount = invoices[i].amountOut;
                uint256 fee;

                if (feeConfig.feeBps > 0 && feeConfig.feeRecipient != address(0)) {
                    fee = (payAmount * feeConfig.feeBps) / 10_000;
                    payAmount -= fee;
                    _safeTransfer(payToken, feeConfig.feeRecipient, fee);
                }

                _safeTransfer(payToken, invoices[i].receiver, payAmount);

                emit PaymentExecuted(
                    invoices[i].ref,
                    invoices[i].receiver,
                    msg.sender,
                    tokenIn,
                    invoices[i].amountOut,
                    invoices[i].tokenOut,
                    payAmount,
                    fee,
                    block.timestamp
                );
            }
        }

        // Refund any dust left to refundTo
        uint256 dustIn = IERC20(tokenIn).balanceOf(address(this));
        if (dustIn > 0) {
            _safeTransfer(tokenIn, refundTo, dustIn);
        }
        if (needsSwap) {
            uint256 dustOut = IERC20(sharedTokenOut).balanceOf(address(this));
            if (dustOut > 0) {
                _safeTransfer(sharedTokenOut, refundTo, dustOut);
            }
        }

        emit BatchSettled(len, block.timestamp);
    }

    /* ═══════════════════════════════════════════════════════════════
     *  INTERNAL: Single settlement logic (shared by settle / bridge / native)
     * ═══════════════════════════════════════════════════════════════ */

    /// @dev Executes the core settlement: swap if needed, deduct fee, pay merchant.
    /// @return fee The protocol fee deducted (0 if disabled).
    function _settleSingle(
        Invoice calldata invoice,
        address tokenIn,
        uint256 amountIn,
        bytes calldata swapData,
        address refundTo
    ) internal returns (uint256 fee) {
        if (tokenIn == invoice.tokenOut) {
            // ── Direct payment (no swap needed) ──────────────────
            if (amountIn < invoice.amountOut) revert InsufficientInput();

            uint256 payAmount = invoice.amountOut;

            // Protocol fee
            if (feeConfig.feeBps > 0 && feeConfig.feeRecipient != address(0)) {
                fee = (payAmount * feeConfig.feeBps) / 10_000;
                payAmount -= fee;
                _safeTransfer(invoice.tokenOut, feeConfig.feeRecipient, fee);
            }

            _safeTransfer(invoice.tokenOut, invoice.receiver, payAmount);

            // Refund dust to refundTo (not msg.sender — important for LI.FI flows)
            uint256 dust = amountIn - invoice.amountOut;
            if (dust > 0) {
                _safeTransfer(tokenIn, refundTo, dust);
            }
        } else {
            // ── Swap via Uniswap V4, then pay ────────────────────
            fee = _swapAndPay(tokenIn, amountIn, invoice, swapData, refundTo);
        }
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
     * For a V4_SWAP (Commands.V4_SWAP = 0x10), the input encodes:
     *   - actions: packed bytes of action IDs from the Actions library
     *       Actions.SWAP_EXACT_IN_SINGLE = 0x06
     *       Actions.SETTLE_ALL           = 0x0c
     *       Actions.TAKE_ALL             = 0x0f
     *   - params[]: ABI-encoded params for each action
     *       params[0]: IV4Router.ExactInputSingleParams
     *       params[1]: abi.encode(currency0, maxAmount)   // SETTLE_ALL
     *       params[2]: abi.encode(currency1, minAmount)   // TAKE_ALL
     *
     * Example construction (off-chain, ethers.js):
     *
     *   // import Commands from universal-router/contracts/libraries/Commands.sol
     *   // import Actions  from v4-periphery/src/libraries/Actions.sol
     *
     *   const actions = ethers.solidityPacked(
     *     ['uint8', 'uint8', 'uint8'],
     *     [Actions.SWAP_EXACT_IN_SINGLE, Actions.SETTLE_ALL, Actions.TAKE_ALL]
     *   );
     *   const swapParam = ethers.AbiCoder.defaultAbiCoder().encode(
     *     ['tuple(tuple(address,address,uint24,int24,address),bool,uint128,uint128,bytes)'],
     *     [exactInputSingleParams]
     *   );
     *   const settleParam = ethers.AbiCoder.defaultAbiCoder().encode(
     *     ['address', 'uint256'], [tokenIn, maxAmount]
     *   );
     *   const takeParam = ethers.AbiCoder.defaultAbiCoder().encode(
     *     ['address', 'uint256'], [tokenOut, minAmount]
     *   );
     *   const v4Input = ethers.AbiCoder.defaultAbiCoder().encode(
     *     ['bytes', 'bytes[]'],
     *     [actions, [swapParam, settleParam, takeParam]]
     *   );
     *   const commands = ethers.solidityPacked(['uint8'], [Commands.V4_SWAP]);
     *   const swapData = ethers.AbiCoder.defaultAbiCoder().encode(
     *     ['bytes', 'bytes[]', 'uint256'],
     *     [commands, [v4Input], deadline]
     *   );
     */
    function _swapAndPay(
        address tokenIn,
        uint256 amountIn,
        Invoice calldata invoice,
        bytes calldata swapData,
        address refundTo
    ) internal returns (uint256 fee) {
        // Approve Universal Router to spend tokenIn
        IERC20(tokenIn).approve(address(universalRouter), amountIn);

        if (swapData.length > 0) {
            (bytes memory commands, bytes[] memory inputs, uint256 deadline) =
                abi.decode(swapData, (bytes, bytes[], uint256));
            universalRouter.execute(commands, inputs, deadline);
        }

        // Verify sufficient tokenOut after swap
        uint256 balanceOut = IERC20(invoice.tokenOut).balanceOf(address(this));
        if (balanceOut < invoice.amountOut) revert SwapOutputInsufficient();

        uint256 payAmount = invoice.amountOut;

        // Protocol fee
        if (feeConfig.feeBps > 0 && feeConfig.feeRecipient != address(0)) {
            fee = (payAmount * feeConfig.feeBps) / 10_000;
            payAmount -= fee;
            _safeTransfer(invoice.tokenOut, feeConfig.feeRecipient, fee);
        }

        // Pay merchant
        _safeTransfer(invoice.tokenOut, invoice.receiver, payAmount);

        // Refund excess tokenOut to refundTo
        uint256 excessOut = IERC20(invoice.tokenOut).balanceOf(address(this));
        if (excessOut > 0) {
            _safeTransfer(invoice.tokenOut, refundTo, excessOut);
        }

        // Refund remaining tokenIn to refundTo
        uint256 remainingIn = IERC20(tokenIn).balanceOf(address(this));
        if (remainingIn > 0) {
            _safeTransfer(tokenIn, refundTo, remainingIn);
        }
    }

    /* ═══════════════════════════════════════════════════════════════
     *  INTERNAL HELPERS
     * ═══════════════════════════════════════════════════════════════ */

    function _validateInvoice(Invoice calldata inv) internal view {
        if (inv.receiver == address(0)) revert ZeroAddress();
        if (inv.tokenOut == address(0)) revert ZeroAddress();
        if (inv.amountOut == 0) revert ZeroAmount();
        if (inv.deadline != 0 && block.timestamp > inv.deadline) revert InvoiceExpired();
    }

    function _invoiceId(Invoice calldata inv) internal pure returns (bytes32 id) {
        /// @solidity memory-safe-assembly
        assembly {
            let ptr := mload(0x40)
            calldatacopy(ptr, inv, 0xc0) // 6 fields × 32 bytes = 192 = 0xc0
            id := keccak256(ptr, 0xc0)
        }
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
     *  VIEW FUNCTIONS
     * ═══════════════════════════════════════════════════════════════ */

    /// @notice Compute the invoice ID for a given invoice (off-chain pre-computation).
    function computeInvoiceId(Invoice calldata inv) external pure returns (bytes32) {
        return _invoiceId(inv);
    }

    /// @notice Check if an invoice has already been settled.
    function isSettled(Invoice calldata inv) external view returns (bool) {
        return settled[_invoiceId(inv)];
    }

    /* ═══════════════════════════════════════════════════════════════
     *  ADMIN
     * ═══════════════════════════════════════════════════════════════ */

    /// @notice Update protocol fee configuration.
    /// @param _feeRecipient Address to receive fees (address(0) = disable fees).
    /// @param _feeBps       Fee in basis points (max 100 = 1%).
    function setFeeConfig(address _feeRecipient, uint16 _feeBps) external onlyOwner {
        if (_feeBps > MAX_FEE_BPS) revert FeeTooHigh();
        feeConfig = FeeConfig({ feeRecipient: _feeRecipient, feeBps: _feeBps });
        emit FeeConfigUpdated(_feeRecipient, _feeBps);
    }

    /// @notice Update Universal Router address (e.g., after Uniswap upgrade).
    function setUniversalRouter(address _router) external onlyOwner {
        if (_router == address(0)) revert ZeroAddress();
        universalRouter = IUniversalRouter(_router);
        emit UniversalRouterUpdated(_router);
    }

    /// @notice Transfer ownership.
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    /// @notice Emergency rescue of stuck tokens.
    function rescue(address token, address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        _safeTransfer(token, to, amount);
    }

    /// @notice Emergency rescue of stuck native ETH.
    function rescueNative(address payable to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        (bool ok, ) = to.call{value: amount}("");
        if (!ok) revert NativeTransferFailed();
    }

    /// @notice Allow contract to receive ETH (for native-token wrapping/swaps).
    receive() external payable {}
}
