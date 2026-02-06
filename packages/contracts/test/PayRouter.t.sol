// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {PayRouter} from "../src/PayRouter.sol";
import {IPayRouter} from "../src/interfaces/IPayRouter.sol";
import {IERC20} from "../src/interfaces/IERC20.sol";

/* ─── Mock ERC20 for testing ──────────────────────────────────────── */

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

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;
    }

    function approve(address spender, uint256 amount) external override returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external override returns (bool) {
        require(balanceOf[msg.sender] >= amount, "insufficient");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external override returns (bool) {
        require(allowance[from][msg.sender] >= amount, "allowance");
        require(balanceOf[from] >= amount, "insufficient");
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

/* ─── Mock Universal Router ───────────────────────────────────────── */

contract MockUniversalRouter {
    /// @dev Simulates a swap: burns tokenIn from sender, mints tokenOut to sender.
    ///      In test, the PayRouter is the caller after approving.
    MockERC20 public tokenIn;
    MockERC20 public tokenOut;
    uint256 public rate; // tokenOut per tokenIn (scaled 1e6)

    constructor(MockERC20 _tokenIn, MockERC20 _tokenOut, uint256 _rate) {
        tokenIn = _tokenIn;
        tokenOut = _tokenOut;
        rate = _rate;
    }

    function execute(bytes calldata, bytes[] calldata, uint256) external payable {
        // Simulate: take all approved tokenIn from caller, give tokenOut
        uint256 inBal = tokenIn.allowance(msg.sender, address(this));
        if (inBal > 0) {
            tokenIn.transferFrom(msg.sender, address(this), inBal);
            uint256 outAmount = (inBal * rate) / 1e6;
            tokenOut.mint(msg.sender, outAmount);
        }
    }
}

/* ═══════════════════════════════════════════════════════════════════ */
/*                         TEST SUITE                                */
/* ═══════════════════════════════════════════════════════════════════ */

contract PayRouterTest is Test {
    PayRouter public router;
    MockERC20 public usdc;
    MockERC20 public weth;
    MockUniversalRouter public uniRouter;

    address public merchant = makeAddr("merchant");
    address public payer = makeAddr("payer");
    address public deployer = makeAddr("deployer");

    function setUp() public {
        usdc = new MockERC20("USD Coin", "USDC");
        weth = new MockERC20("Wrapped Ether", "WETH");
        // 1 WETH = 2800 USDC (rate = 2800e6)
        uniRouter = new MockUniversalRouter(weth, usdc, 2800e6);

        vm.prank(deployer);
        router = new PayRouter(address(uniRouter));
    }

    /* ─── Direct settlement (same token) ──────────────────────── */

    function test_settle_directPayment() public {
        // Mint USDC to payer
        usdc.mint(payer, 10e6);

        IPayRouter.Invoice memory inv = IPayRouter.Invoice({
            receiver: merchant,
            tokenOut: address(usdc),
            amountOut: 3_500000, // 3.50 USDC
            deadline: block.timestamp + 600,
            ref: keccak256("coffee42"),
            nonce: 1
        });

        // Payer approves PayRouter
        vm.startPrank(payer);
        usdc.approve(address(router), 3_500000);

        // Expect event
        vm.expectEmit(true, true, true, true);
        emit IPayRouter.PaymentExecuted(
            inv.ref, merchant, payer,
            address(usdc), 3_500000,
            address(usdc), 3_500000,
            block.timestamp
        );

        router.settle(inv, address(usdc), 3_500000, "");
        vm.stopPrank();

        // Verify balances
        assertEq(usdc.balanceOf(merchant), 3_500000, "merchant should receive 3.50 USDC");
        assertEq(usdc.balanceOf(payer), 6_500000, "payer should have 6.50 USDC left");
    }

    /* ─── Settlement with swap (WETH → USDC) ──────────────────── */

    function test_settle_withSwap() public {
        // Mint WETH to payer (enough for ~3.50 USDC at 2800 rate)
        uint256 wethAmount = 1_250; // 0.00125 WETH (1250 units at 6 decimals)
        weth.mint(payer, wethAmount);

        IPayRouter.Invoice memory inv = IPayRouter.Invoice({
            receiver: merchant,
            tokenOut: address(usdc),
            amountOut: 3_500000, // 3.50 USDC
            deadline: block.timestamp + 600,
            ref: keccak256("coffee42"),
            nonce: 2
        });

        // Build mock swap data (just needs to be non-empty for mock router)
        bytes memory swapData = abi.encode(
            hex"10", // V4_SWAP command
            new bytes[](0),
            block.timestamp + 600
        );

        vm.startPrank(payer);
        weth.approve(address(router), wethAmount);

        router.settle(inv, address(weth), wethAmount, swapData);
        vm.stopPrank();

        // Verify merchant received USDC
        assertGe(usdc.balanceOf(merchant), 3_500000, "merchant should receive >= 3.50 USDC");
    }

    /* ─── Replay protection ───────────────────────────────────── */

    function test_revert_alreadySettled() public {
        usdc.mint(payer, 10e6);

        IPayRouter.Invoice memory inv = IPayRouter.Invoice({
            receiver: merchant,
            tokenOut: address(usdc),
            amountOut: 1e6,
            deadline: block.timestamp + 600,
            ref: keccak256("test-replay"),
            nonce: 10
        });

        vm.startPrank(payer);
        usdc.approve(address(router), 2e6);
        router.settle(inv, address(usdc), 1e6, "");

        // Second settle should revert
        usdc.approve(address(router), 2e6);
        vm.expectRevert(PayRouter.AlreadySettled.selector);
        router.settle(inv, address(usdc), 1e6, "");
        vm.stopPrank();
    }

    /* ─── Expired invoice ─────────────────────────────────────── */

    function test_revert_expired() public {
        usdc.mint(payer, 10e6);

        IPayRouter.Invoice memory inv = IPayRouter.Invoice({
            receiver: merchant,
            tokenOut: address(usdc),
            amountOut: 1e6,
            deadline: block.timestamp - 1, // already expired
            ref: keccak256("expired"),
            nonce: 20
        });

        vm.startPrank(payer);
        usdc.approve(address(router), 1e6);
        vm.expectRevert(PayRouter.InvoiceExpired.selector);
        router.settle(inv, address(usdc), 1e6, "");
        vm.stopPrank();
    }

    /* ─── Zero-deadline (no expiry) works ──────────────────────── */

    function test_settle_noExpiry() public {
        usdc.mint(payer, 5e6);

        IPayRouter.Invoice memory inv = IPayRouter.Invoice({
            receiver: merchant,
            tokenOut: address(usdc),
            amountOut: 2e6,
            deadline: 0, // no expiry
            ref: keccak256("no-expiry"),
            nonce: 30
        });

        vm.startPrank(payer);
        usdc.approve(address(router), 2e6);
        router.settle(inv, address(usdc), 2e6, "");
        vm.stopPrank();

        assertEq(usdc.balanceOf(merchant), 2e6);
    }

    /* ─── Batch settlement ────────────────────────────────────── */

    function test_settleBatch() public {
        usdc.mint(payer, 20e6);

        IPayRouter.Invoice[] memory invoices = new IPayRouter.Invoice[](3);
        invoices[0] = IPayRouter.Invoice(merchant, address(usdc), 3e6, block.timestamp + 600, keccak256("batch-1"), 100);
        invoices[1] = IPayRouter.Invoice(merchant, address(usdc), 2e6, block.timestamp + 600, keccak256("batch-2"), 101);
        invoices[2] = IPayRouter.Invoice(makeAddr("merchant2"), address(usdc), 5e6, block.timestamp + 600, keccak256("batch-3"), 102);

        vm.startPrank(payer);
        usdc.approve(address(router), 10e6);
        router.settleBatch(invoices, address(usdc), 10e6, "");
        vm.stopPrank();

        assertEq(usdc.balanceOf(merchant), 5e6, "merchant should have 3+2=5 USDC");
        assertEq(usdc.balanceOf(makeAddr("merchant2")), 5e6, "merchant2 should have 5 USDC");
    }

    /* ─── Admin functions ─────────────────────────────────────── */

    function test_onlyOwner_setRouter() public {
        vm.prank(payer);
        vm.expectRevert(PayRouter.Unauthorized.selector);
        router.setUniversalRouter(address(0x1234));

        vm.prank(deployer);
        router.setUniversalRouter(address(0x1234));
        assertEq(address(router.universalRouter()), address(0x1234));
    }

    function test_rescue() public {
        usdc.mint(address(router), 1e6); // stuck tokens

        vm.prank(deployer);
        router.rescue(address(usdc), deployer, 1e6);
        assertEq(usdc.balanceOf(deployer), 1e6);
    }
}
