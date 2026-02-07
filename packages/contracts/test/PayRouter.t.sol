// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {PayRouter} from "../src/PayRouter.sol";
import {IPayRouter} from "../src/interfaces/IPayRouter.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/* ═══════════════════════════════════════════════════════════════════
 *                          MOCK CONTRACTS
 * ═══════════════════════════════════════════════════════════════════ */

/// @dev Mock ERC20 for testing. 6 decimals by default (like USDC).
contract MockERC20 is IERC20 {
    string public name;
    string public symbol;
    uint8 public decimals = 6;
    uint256 public override totalSupply;
    mapping(address => uint256) public override balanceOf;
    mapping(address => mapping(address => uint256)) public override allowance;

    constructor(string memory _name, string memory _symbol) {
        name = _name;
        symbol = _symbol;
    }

    function setDecimals(uint8 _d) external { decimals = _d; }

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;
    }

    function burn(address from, uint256 amount) external {
        balanceOf[from] -= amount;
        totalSupply -= amount;
    }

    function approve(address spender, uint256 amount) external override returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external override returns (bool) {
        require(balanceOf[msg.sender] >= amount, "MockERC20: insufficient balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external override returns (bool) {
        require(allowance[from][msg.sender] >= amount, "MockERC20: insufficient allowance");
        require(balanceOf[from] >= amount, "MockERC20: insufficient balance");
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

/// @dev Mock WETH with deposit/withdraw.
contract MockWETH is MockERC20 {
    constructor() MockERC20("Wrapped Ether", "WETH") {
        decimals = 18;
    }

    function deposit() external payable {
        balanceOf[msg.sender] += msg.value;
        totalSupply += msg.value;
    }

    function withdraw(uint256 amount) external {
        require(balanceOf[msg.sender] >= amount, "MockWETH: insufficient");
        balanceOf[msg.sender] -= amount;
        totalSupply -= amount;
        payable(msg.sender).transfer(amount);
    }

    receive() external payable {
        balanceOf[msg.sender] += msg.value;
        totalSupply += msg.value;
    }
}

/// @dev Mock Universal Router that simulates V4 swaps.
///      Takes all approved tokenIn from caller, mints tokenOut at given rate.
contract MockUniversalRouter {
    MockERC20 public tokenIn;
    MockERC20 public tokenOut;
    uint256 public rate; // tokenOut per tokenIn (scaled 1e6)

    constructor(MockERC20 _tokenIn, MockERC20 _tokenOut, uint256 _rate) {
        tokenIn = _tokenIn;
        tokenOut = _tokenOut;
        rate = _rate;
    }

    function setRate(uint256 _rate) external { rate = _rate; }

    function execute(bytes calldata, bytes[] calldata, uint256) external payable {
        uint256 inBal = tokenIn.allowance(msg.sender, address(this));
        if (inBal > 0) {
            bool ok = tokenIn.transferFrom(msg.sender, address(this), inBal);
            require(ok, "transferFrom failed");
            uint256 outAmount = (inBal * rate) / 1e6;
            tokenOut.mint(msg.sender, outAmount);
        }
    }
}

/// @dev Mock Universal Router that always reverts (for failure testing).
contract FailingUniversalRouter {
    function execute(bytes calldata, bytes[] calldata, uint256) external payable {
        revert("SWAP_FAILED");
    }
}

/* ═══════════════════════════════════════════════════════════════════
 *                    PayRouter TEST SUITE
 * ═══════════════════════════════════════════════════════════════════ */

contract PayRouterTest is Test {
    PayRouter public router;
    MockERC20 public usdc;
    MockWETH public wethToken;
    MockERC20 public dai;
    MockUniversalRouter public uniRouter;

    address public merchant = makeAddr("merchant");
    address public merchant2 = makeAddr("merchant2");
    address public payer = makeAddr("payer");
    address public deployer = makeAddr("deployer");
    address public feeRecipient = makeAddr("feeRecipient");

    function setUp() public {
        usdc = new MockERC20("USD Coin", "USDC");
        dai = new MockERC20("DAI Stablecoin", "DAI");
        wethToken = new MockWETH();
        // 1 WETH = 2800 USDC (rate = 2800e6)
        uniRouter = new MockUniversalRouter(MockERC20(address(wethToken)), usdc, 2800e6);

        vm.prank(deployer);
        router = new PayRouter(address(uniRouter), address(wethToken));
    }

    /* ─────────────────────────────────────────────────────────────
     *  CONSTRUCTOR TESTS
     * ───────────────────────────────────────────────────────────── */

    function test_constructor_setsOwner() public view {
        assertEq(router.owner(), deployer);
    }

    function test_constructor_setsUniversalRouter() public view {
        assertEq(address(router.universalRouter()), address(uniRouter));
    }

    function test_constructor_setsWeth() public view {
        assertEq(address(router.weth()), address(wethToken));
    }

    function test_constructor_revert_zeroRouter() public {
        vm.expectRevert(PayRouter.ZeroAddress.selector);
        new PayRouter(address(0), address(wethToken));
    }

    function test_constructor_revert_zeroWeth() public {
        vm.expectRevert(PayRouter.ZeroAddress.selector);
        new PayRouter(address(uniRouter), address(0));
    }

    /* ─────────────────────────────────────────────────────────────
     *  MODE A: settle() — Direct payment (same token)
     * ───────────────────────────────────────────────────────────── */

    function test_settle_directPayment() public {
        usdc.mint(payer, 10e6);

        IPayRouter.Invoice memory inv = IPayRouter.Invoice({
            receiver: merchant,
            tokenOut: address(usdc),
            amountOut: 3_500000, // 3.50 USDC
            deadline: block.timestamp + 600,
            ref: keccak256("coffee42"),
            nonce: 1
        });

        vm.startPrank(payer);
        usdc.approve(address(router), 3_500000);

        vm.expectEmit(true, true, true, true);
        emit IPayRouter.PaymentExecuted(
            inv.ref, merchant, payer,
            address(usdc), 3_500000,
            address(usdc), 3_500000,
            0, // no fee
            block.timestamp
        );

        router.settle(inv, address(usdc), 3_500000, "", payer);
        vm.stopPrank();

        assertEq(usdc.balanceOf(merchant), 3_500000, "merchant should receive 3.50 USDC");
        assertEq(usdc.balanceOf(payer), 6_500000, "payer should have 6.50 USDC left");
        assertEq(usdc.balanceOf(address(router)), 0, "router should have 0 USDC");
    }

    function test_settle_directPayment_withDustRefund() public {
        usdc.mint(payer, 10e6);

        IPayRouter.Invoice memory inv = IPayRouter.Invoice({
            receiver: merchant,
            tokenOut: address(usdc),
            amountOut: 3_000000,
            deadline: block.timestamp + 600,
            ref: keccak256("dust-test"),
            nonce: 1
        });

        vm.startPrank(payer);
        usdc.approve(address(router), 5_000000); // overpay
        router.settle(inv, address(usdc), 5_000000, "", payer);
        vm.stopPrank();

        assertEq(usdc.balanceOf(merchant), 3_000000, "merchant gets exact amount");
        assertEq(usdc.balanceOf(payer), 7_000000, "payer gets dust back");
        assertEq(usdc.balanceOf(address(router)), 0, "router empty");
    }

    /* ─────────────────────────────────────────────────────────────
     *  MODE A: settle() — With Uniswap V4 Swap (WETH → USDC)
     * ───────────────────────────────────────────────────────────── */

    function test_settle_withSwap() public {
        uint256 wethAmount = 1_250; // 0.00125 WETH at 6 dec mock
        wethToken.mint(payer, wethAmount);

        IPayRouter.Invoice memory inv = IPayRouter.Invoice({
            receiver: merchant,
            tokenOut: address(usdc),
            amountOut: 3_500000,
            deadline: block.timestamp + 600,
            ref: keccak256("swap-coffee"),
            nonce: 2
        });

        bytes memory swapData = abi.encode(
            hex"10",
            new bytes[](0),
            block.timestamp + 600
        );

        vm.startPrank(payer);
        wethToken.approve(address(router), wethAmount);
        router.settle(inv, address(wethToken), wethAmount, swapData, payer);
        vm.stopPrank();

        assertGe(usdc.balanceOf(merchant), 3_500000, "merchant should receive >= 3.50 USDC");
    }

    /* ─────────────────────────────────────────────────────────────
     *  MODE A: settle() — With Fee
     * ───────────────────────────────────────────────────────────── */

    function test_settle_withFee() public {
        // Enable 0.5% fee
        vm.prank(deployer);
        router.setFeeConfig(feeRecipient, 50);

        usdc.mint(payer, 10e6);

        IPayRouter.Invoice memory inv = IPayRouter.Invoice({
            receiver: merchant,
            tokenOut: address(usdc),
            amountOut: 10_000000, // 10 USDC
            deadline: block.timestamp + 600,
            ref: keccak256("fee-test"),
            nonce: 1
        });

        vm.startPrank(payer);
        usdc.approve(address(router), 10_000000);
        router.settle(inv, address(usdc), 10_000000, "", payer);
        vm.stopPrank();

        // fee = 10_000000 * 50 / 10000 = 50000 (0.05 USDC)
        uint256 expectedFee = 50000;
        uint256 merchantReceived = 10_000000 - expectedFee;
        assertEq(usdc.balanceOf(feeRecipient), expectedFee, "fee recipient gets 0.5%");
        assertEq(usdc.balanceOf(merchant), merchantReceived, "merchant gets amount minus fee");
    }

    /* ─────────────────────────────────────────────────────────────
     *  MODE B: settleFromBridge() — LI.FI contractCall
     * ───────────────────────────────────────────────────────────── */

    function test_settleFromBridge_directPayment() public {
        // Simulate LI.FI sending USDC to PayRouter before calling
        usdc.mint(address(router), 5_000000);

        IPayRouter.Invoice memory inv = IPayRouter.Invoice({
            receiver: merchant,
            tokenOut: address(usdc),
            amountOut: 3_500000,
            deadline: block.timestamp + 600,
            ref: keccak256("bridge-coffee"),
            nonce: 1
        });

        // LI.FI executor calls settleFromBridge; dust goes to payer, not executor
        address lifiBridge = makeAddr("lifi-executor");
        vm.prank(lifiBridge);
        router.settleFromBridge(inv, address(usdc), 5_000000, "", payer);

        assertEq(usdc.balanceOf(merchant), 3_500000, "merchant receives from bridge");
        assertEq(usdc.balanceOf(payer), 1_500000, "dust refunded to user, not executor");
        assertEq(usdc.balanceOf(lifiBridge), 0, "executor keeps nothing");
    }

    function test_settleFromBridge_insufficientBalance() public {
        usdc.mint(address(router), 1_000000); // only 1 USDC

        IPayRouter.Invoice memory inv = IPayRouter.Invoice({
            receiver: merchant,
            tokenOut: address(usdc),
            amountOut: 3_500000,
            deadline: block.timestamp + 600,
            ref: keccak256("bridge-low"),
            nonce: 1
        });

        address lifiBridge = makeAddr("lifi-executor");
        vm.prank(lifiBridge);
        vm.expectRevert(PayRouter.InsufficientInput.selector);
        router.settleFromBridge(inv, address(usdc), 3_500000, "", payer);
    }

    /* ─────────────────────────────────────────────────────────────
     *  MODE C: settleNative() — ETH payment auto-wrapped
     * ───────────────────────────────────────────────────────────── */

    function test_settleNative_directWethPayment() public {
        // Merchant wants WETH
        IPayRouter.Invoice memory inv = IPayRouter.Invoice({
            receiver: merchant,
            tokenOut: address(wethToken),
            amountOut: 1 ether,
            deadline: block.timestamp + 600,
            ref: keccak256("native-pay"),
            nonce: 1
        });

        vm.deal(payer, 2 ether);
        vm.prank(payer);
        router.settleNative{value: 1 ether}(inv, "", payer);

        assertEq(wethToken.balanceOf(merchant), 1 ether, "merchant receives WETH");
    }

    function test_settleNative_zeroValue_reverts() public {
        IPayRouter.Invoice memory inv = IPayRouter.Invoice({
            receiver: merchant,
            tokenOut: address(wethToken),
            amountOut: 1 ether,
            deadline: block.timestamp + 600,
            ref: keccak256("native-zero"),
            nonce: 1
        });

        vm.prank(payer);
        vm.expectRevert(PayRouter.ZeroAmount.selector);
        router.settleNative{value: 0}(inv, "", payer);
    }

    /* ─────────────────────────────────────────────────────────────
     *  MODE D: settleBatch()
     * ───────────────────────────────────────────────────────────── */

    function test_settleBatch_directPayment() public {
        usdc.mint(payer, 20e6);

        IPayRouter.Invoice[] memory invoices = new IPayRouter.Invoice[](3);
        invoices[0] = IPayRouter.Invoice(merchant, address(usdc), 3e6, block.timestamp + 600, keccak256("batch-1"), 100);
        invoices[1] = IPayRouter.Invoice(merchant, address(usdc), 2e6, block.timestamp + 600, keccak256("batch-2"), 101);
        invoices[2] = IPayRouter.Invoice(merchant2, address(usdc), 5e6, block.timestamp + 600, keccak256("batch-3"), 102);

        vm.startPrank(payer);
        usdc.approve(address(router), 10e6);
        router.settleBatch(invoices, address(usdc), 10e6, "", payer);
        vm.stopPrank();

        assertEq(usdc.balanceOf(merchant), 5e6, "merchant should have 3+2=5 USDC");
        assertEq(usdc.balanceOf(merchant2), 5e6, "merchant2 should have 5 USDC");
    }

    function test_settleBatch_emptyReverts() public {
        IPayRouter.Invoice[] memory invoices = new IPayRouter.Invoice[](0);

        vm.startPrank(payer);
        vm.expectRevert(PayRouter.BatchEmpty.selector);
        router.settleBatch(invoices, address(usdc), 1e6, "", payer);
        vm.stopPrank();
    }

    function test_settleBatch_withFee() public {
        vm.prank(deployer);
        router.setFeeConfig(feeRecipient, 100); // 1% fee

        usdc.mint(payer, 20e6);

        IPayRouter.Invoice[] memory invoices = new IPayRouter.Invoice[](2);
        invoices[0] = IPayRouter.Invoice(merchant, address(usdc), 5e6, block.timestamp + 600, keccak256("batch-fee-1"), 200);
        invoices[1] = IPayRouter.Invoice(merchant2, address(usdc), 5e6, block.timestamp + 600, keccak256("batch-fee-2"), 201);

        vm.startPrank(payer);
        usdc.approve(address(router), 10e6);
        router.settleBatch(invoices, address(usdc), 10e6, "", payer);
        vm.stopPrank();

        // 1% of 5e6 = 50000 per invoice, total = 100000
        assertEq(usdc.balanceOf(feeRecipient), 100000, "fee recipient gets 1% of total");
        assertEq(usdc.balanceOf(merchant), 5e6 - 50000, "merchant gets amount minus fee");
        assertEq(usdc.balanceOf(merchant2), 5e6 - 50000, "merchant2 gets amount minus fee");
    }

    function test_settleBatch_revert_tokenOutMismatch() public {
        usdc.mint(payer, 20e6);

        IPayRouter.Invoice[] memory invoices = new IPayRouter.Invoice[](2);
        invoices[0] = IPayRouter.Invoice(merchant, address(usdc), 3e6, block.timestamp + 600, keccak256("mismatch-1"), 300);
        invoices[1] = IPayRouter.Invoice(merchant2, address(dai), 2e6, block.timestamp + 600, keccak256("mismatch-2"), 301);

        vm.startPrank(payer);
        usdc.approve(address(router), 10e6);
        vm.expectRevert(PayRouter.TokenOutMismatch.selector);
        router.settleBatch(invoices, address(usdc), 10e6, "", payer);
        vm.stopPrank();
    }

    function test_settleFromBridge_refundsToCorrectAddress() public {
        // Simulate LI.FI sending 5 USDC but invoice only needs 3.5 USDC
        usdc.mint(address(router), 5_000000);

        address userRefund = makeAddr("user-refund");

        IPayRouter.Invoice memory inv = IPayRouter.Invoice({
            receiver: merchant,
            tokenOut: address(usdc),
            amountOut: 3_500000,
            deadline: block.timestamp + 600,
            ref: keccak256("bridge-refund-test"),
            nonce: 99
        });

        // Executor calls settleFromBridge; refund goes to userRefund, NOT executor
        address executor = makeAddr("bridge-executor");
        vm.prank(executor);
        router.settleFromBridge(inv, address(usdc), 5_000000, "", userRefund);

        assertEq(usdc.balanceOf(merchant), 3_500000, "merchant gets exact amount");
        assertEq(usdc.balanceOf(userRefund), 1_500000, "dust refunded to specified address");
        assertEq(usdc.balanceOf(executor), 0, "executor receives nothing");
    }

    /* ─────────────────────────────────────────────────────────────
     *  REPLAY PROTECTION
     * ───────────────────────────────────────────────────────────── */

    function test_revert_alreadySettled() public {
        usdc.mint(payer, 10e6);

        IPayRouter.Invoice memory inv = IPayRouter.Invoice({
            receiver: merchant,
            tokenOut: address(usdc),
            amountOut: 1e6,
            deadline: block.timestamp + 600,
            ref: keccak256("replay-test"),
            nonce: 10
        });

        vm.startPrank(payer);
        usdc.approve(address(router), 2e6);
        router.settle(inv, address(usdc), 1e6, "", payer);

        usdc.approve(address(router), 2e6);
        vm.expectRevert(PayRouter.AlreadySettled.selector);
        router.settle(inv, address(usdc), 1e6, "", payer);
        vm.stopPrank();
    }

    /* ─────────────────────────────────────────────────────────────
     *  INVOICE VALIDATION
     * ───────────────────────────────────────────────────────────── */

    function test_revert_expired() public {
        vm.warp(1000); // ensure timestamp is high enough
        usdc.mint(payer, 10e6);

        IPayRouter.Invoice memory inv = IPayRouter.Invoice({
            receiver: merchant,
            tokenOut: address(usdc),
            amountOut: 1e6,
            deadline: block.timestamp - 1,
            ref: keccak256("expired"),
            nonce: 20
        });

        vm.startPrank(payer);
        usdc.approve(address(router), 1e6);
        vm.expectRevert(PayRouter.InvoiceExpired.selector);
        router.settle(inv, address(usdc), 1e6, "", payer);
        vm.stopPrank();
    }

    function test_settle_noExpiry() public {
        usdc.mint(payer, 5e6);

        IPayRouter.Invoice memory inv = IPayRouter.Invoice({
            receiver: merchant,
            tokenOut: address(usdc),
            amountOut: 2e6,
            deadline: 0,
            ref: keccak256("no-expiry"),
            nonce: 30
        });

        vm.startPrank(payer);
        usdc.approve(address(router), 2e6);
        router.settle(inv, address(usdc), 2e6, "", payer);
        vm.stopPrank();

        assertEq(usdc.balanceOf(merchant), 2e6);
    }

    function test_revert_zeroReceiver() public {
        usdc.mint(payer, 5e6);

        IPayRouter.Invoice memory inv = IPayRouter.Invoice({
            receiver: address(0),
            tokenOut: address(usdc),
            amountOut: 1e6,
            deadline: block.timestamp + 600,
            ref: keccak256("zero-recv"),
            nonce: 40
        });

        vm.startPrank(payer);
        usdc.approve(address(router), 1e6);
        vm.expectRevert(PayRouter.ZeroAddress.selector);
        router.settle(inv, address(usdc), 1e6, "", payer);
        vm.stopPrank();
    }

    function test_revert_zeroTokenOut() public {
        usdc.mint(payer, 5e6);

        IPayRouter.Invoice memory inv = IPayRouter.Invoice({
            receiver: merchant,
            tokenOut: address(0),
            amountOut: 1e6,
            deadline: block.timestamp + 600,
            ref: keccak256("zero-token"),
            nonce: 41
        });

        vm.startPrank(payer);
        usdc.approve(address(router), 1e6);
        vm.expectRevert(PayRouter.ZeroAddress.selector);
        router.settle(inv, address(usdc), 1e6, "", payer);
        vm.stopPrank();
    }

    function test_revert_zeroAmount() public {
        IPayRouter.Invoice memory inv = IPayRouter.Invoice({
            receiver: merchant,
            tokenOut: address(usdc),
            amountOut: 1e6,
            deadline: block.timestamp + 600,
            ref: keccak256("zero-amt"),
            nonce: 42
        });

        vm.startPrank(payer);
        vm.expectRevert(PayRouter.ZeroAmount.selector);
        router.settle(inv, address(usdc), 0, "", payer);
        vm.stopPrank();
    }

    function test_revert_zeroAmountOut() public {
        usdc.mint(payer, 5e6);

        IPayRouter.Invoice memory inv = IPayRouter.Invoice({
            receiver: merchant,
            tokenOut: address(usdc),
            amountOut: 0,
            deadline: block.timestamp + 600,
            ref: keccak256("zero-amtout"),
            nonce: 43
        });

        vm.startPrank(payer);
        usdc.approve(address(router), 1e6);
        vm.expectRevert(PayRouter.ZeroAmount.selector);
        router.settle(inv, address(usdc), 1e6, "", payer);
        vm.stopPrank();
    }

    /* ─────────────────────────────────────────────────────────────
     *  VIEW FUNCTIONS
     * ───────────────────────────────────────────────────────────── */

    function test_computeInvoiceId_deterministic() public view {
        IPayRouter.Invoice memory inv = IPayRouter.Invoice({
            receiver: merchant,
            tokenOut: address(usdc),
            amountOut: 3_500000,
            deadline: block.timestamp + 600,
            ref: keccak256("id-test"),
            nonce: 1
        });

        bytes32 id1 = router.computeInvoiceId(inv);
        bytes32 id2 = router.computeInvoiceId(inv);
        assertEq(id1, id2, "same invoice should produce same ID");
        assertTrue(id1 != bytes32(0), "invoice ID should not be zero");
    }

    function test_isSettled() public {
        usdc.mint(payer, 5e6);

        IPayRouter.Invoice memory inv = IPayRouter.Invoice({
            receiver: merchant,
            tokenOut: address(usdc),
            amountOut: 1e6,
            deadline: block.timestamp + 600,
            ref: keccak256("settled-check"),
            nonce: 50
        });

        assertFalse(router.isSettled(inv), "should not be settled initially");

        vm.startPrank(payer);
        usdc.approve(address(router), 1e6);
        router.settle(inv, address(usdc), 1e6, "", payer);
        vm.stopPrank();

        assertTrue(router.isSettled(inv), "should be settled after payment");
    }

    /* ─────────────────────────────────────────────────────────────
     *  ADMIN FUNCTIONS
     * ───────────────────────────────────────────────────────────── */

    function test_onlyOwner_setRouter() public {
        vm.prank(payer);
        vm.expectRevert(PayRouter.Unauthorized.selector);
        router.setUniversalRouter(address(0x1234));

        vm.prank(deployer);
        router.setUniversalRouter(address(0x1234));
        assertEq(address(router.universalRouter()), address(0x1234));
    }

    function test_setFeeConfig() public {
        vm.prank(deployer);
        router.setFeeConfig(feeRecipient, 50);

        (address recipient, uint16 bps) = router.feeConfig();
        assertEq(recipient, feeRecipient);
        assertEq(bps, 50);
    }

    function test_setFeeConfig_revert_tooHigh() public {
        vm.prank(deployer);
        vm.expectRevert(PayRouter.FeeTooHigh.selector);
        router.setFeeConfig(feeRecipient, 101); // > 1%
    }

    function test_setFeeConfig_disableFee() public {
        vm.startPrank(deployer);
        router.setFeeConfig(feeRecipient, 50);
        router.setFeeConfig(address(0), 0);
        vm.stopPrank();

        (address recipient, uint16 bps) = router.feeConfig();
        assertEq(recipient, address(0));
        assertEq(bps, 0);
    }

    function test_rescue() public {
        usdc.mint(address(router), 1e6);

        vm.prank(deployer);
        router.rescue(address(usdc), deployer, 1e6);
        assertEq(usdc.balanceOf(deployer), 1e6);
    }

    function test_rescueNative() public {
        vm.deal(address(router), 1 ether);

        uint256 balBefore = deployer.balance;
        vm.prank(deployer);
        router.rescueNative(payable(deployer), 1 ether);
        assertEq(deployer.balance - balBefore, 1 ether);
    }

    function test_transferOwnership() public {
        address newOwner = makeAddr("newOwner");

        vm.prank(deployer);
        router.transferOwnership(newOwner);
        assertEq(router.owner(), newOwner);

        // Old owner can't call admin
        vm.prank(deployer);
        vm.expectRevert(PayRouter.Unauthorized.selector);
        router.setUniversalRouter(address(0x1234));

        // New owner can
        vm.prank(newOwner);
        router.setUniversalRouter(address(0x1234));
    }

    function test_transferOwnership_revert_zero() public {
        vm.prank(deployer);
        vm.expectRevert(PayRouter.ZeroAddress.selector);
        router.transferOwnership(address(0));
    }

    /* ─────────────────────────────────────────────────────────────
     *  FUZZ TESTS
     * ───────────────────────────────────────────────────────────── */

    function testFuzz_settle_directPayment(uint256 amount) public {
        amount = bound(amount, 1, type(uint128).max);
        usdc.mint(payer, amount);

        IPayRouter.Invoice memory inv = IPayRouter.Invoice({
            receiver: merchant,
            tokenOut: address(usdc),
            amountOut: amount,
            deadline: block.timestamp + 600,
            ref: keccak256(abi.encode("fuzz", amount)),
            nonce: amount
        });

        vm.startPrank(payer);
        usdc.approve(address(router), amount);
        router.settle(inv, address(usdc), amount, "", payer);
        vm.stopPrank();

        assertEq(usdc.balanceOf(merchant), amount);
    }

    function testFuzz_settle_withFee(uint256 amount, uint16 feeBps) public {
        amount = bound(amount, 100, type(uint128).max); // min 100 so fee > 0
        feeBps = uint16(bound(feeBps, 1, 100));

        vm.prank(deployer);
        router.setFeeConfig(feeRecipient, feeBps);

        usdc.mint(payer, amount);

        IPayRouter.Invoice memory inv = IPayRouter.Invoice({
            receiver: merchant,
            tokenOut: address(usdc),
            amountOut: amount,
            deadline: block.timestamp + 600,
            ref: keccak256(abi.encode("fuzz-fee", amount, feeBps)),
            nonce: amount
        });

        vm.startPrank(payer);
        usdc.approve(address(router), amount);
        router.settle(inv, address(usdc), amount, "", payer);
        vm.stopPrank();

        uint256 expectedFee = (amount * feeBps) / 10_000;
        uint256 expectedMerchant = amount - expectedFee;

        assertEq(usdc.balanceOf(feeRecipient), expectedFee, "fee incorrect");
        assertEq(usdc.balanceOf(merchant), expectedMerchant, "merchant amount incorrect");
    }

    /* ─────────────────────────────────────────────────────────────
     *  RECEIVE ETH
     * ───────────────────────────────────────────────────────────── */

    function test_receiveEth() public {
        vm.deal(payer, 1 ether);
        vm.prank(payer);
        (bool ok,) = address(router).call{value: 1 ether}("");
        assertTrue(ok, "should accept ETH");
        assertEq(address(router).balance, 1 ether);
    }
}

