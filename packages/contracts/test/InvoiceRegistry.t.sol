// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {InvoiceRegistry} from "../src/InvoiceRegistry.sol";
import {IInvoiceRegistry} from "../src/interfaces/IInvoiceRegistry.sol";

/* ═══════════════════════════════════════════════════════════════════
 *                   InvoiceRegistry TEST SUITE
 * ═══════════════════════════════════════════════════════════════════ */

contract InvoiceRegistryTest is Test {
    InvoiceRegistry public registry;

    address public owner = makeAddr("owner");
    address public merchant = makeAddr("merchant");
    address public merchant2 = makeAddr("merchant2");
    address public receiver = makeAddr("receiver");
    address public payRouter = makeAddr("payRouter");
    address public usdc = makeAddr("usdc");
    address public rando = makeAddr("rando");

    function setUp() public {
        vm.prank(owner);
        registry = new InvoiceRegistry();

        // Authorize PayRouter
        vm.prank(owner);
        registry.setAuthorizedRouter(payRouter, true);
    }

    /* ─────────────────────────────────────────────────────────────
     *  CONSTRUCTOR
     * ───────────────────────────────────────────────────────────── */

    function test_constructor_setsOwner() public view {
        assertEq(registry.owner(), owner);
    }

    /* ─────────────────────────────────────────────────────────────
     *  CREATE INVOICE
     * ───────────────────────────────────────────────────────────── */

    function test_createInvoice_basic() public {
        vm.prank(merchant);
        bytes32 invoiceId = registry.createInvoice(
            receiver,
            usdc,
            3_500000, // 3.50 USDC
            block.timestamp + 600,
            keccak256("coffee42"),
            "Cafe - Order #42"
        );

        assertTrue(invoiceId != bytes32(0), "invoiceId should not be zero");
        assertEq(registry.totalInvoices(), 1);
        assertEq(registry.merchantNonce(merchant), 1);

        IInvoiceRegistry.InvoiceData memory inv = registry.getInvoice(invoiceId);
        assertEq(inv.merchant, merchant);
        assertEq(inv.receiver, receiver);
        assertEq(inv.tokenOut, usdc);
        assertEq(inv.amountOut, 3_500000);
        assertEq(inv.nonce, 0); // first invoice, nonce = 0
        assertEq(uint256(inv.status), uint256(IInvoiceRegistry.InvoiceStatus.Active));
    }

    function test_createInvoice_autoIncrementNonce() public {
        vm.startPrank(merchant);

        registry.createInvoice(receiver, usdc, 1e6, block.timestamp + 600, keccak256("inv1"), "");
        registry.createInvoice(receiver, usdc, 2e6, block.timestamp + 600, keccak256("inv2"), "");
        registry.createInvoice(receiver, usdc, 3e6, block.timestamp + 600, keccak256("inv3"), "");

        vm.stopPrank();

        assertEq(registry.merchantNonce(merchant), 3);
        assertEq(registry.totalInvoices(), 3);
    }

    function test_createInvoice_noExpiry() public {
        vm.prank(merchant);
        bytes32 invoiceId = registry.createInvoice(
            receiver, usdc, 1e6, 0, keccak256("no-expiry"), ""
        );

        IInvoiceRegistry.InvoiceData memory inv = registry.getInvoice(invoiceId);
        assertEq(inv.deadline, 0);
        assertEq(uint256(registry.getStatus(invoiceId)), uint256(IInvoiceRegistry.InvoiceStatus.Active));
    }

    function test_createInvoice_revert_zeroReceiver() public {
        vm.prank(merchant);
        vm.expectRevert(InvoiceRegistry.ZeroAddress.selector);
        registry.createInvoice(address(0), usdc, 1e6, block.timestamp + 600, keccak256("x"), "");
    }

    function test_createInvoice_revert_zeroToken() public {
        vm.prank(merchant);
        vm.expectRevert(InvoiceRegistry.ZeroAddress.selector);
        registry.createInvoice(receiver, address(0), 1e6, block.timestamp + 600, keccak256("x"), "");
    }

    function test_createInvoice_revert_zeroAmount() public {
        vm.prank(merchant);
        vm.expectRevert(InvoiceRegistry.ZeroAmount.selector);
        registry.createInvoice(receiver, usdc, 0, block.timestamp + 600, keccak256("x"), "");
    }

    function test_createInvoice_revert_deadlineInPast() public {
        vm.warp(1000); // ensure timestamp is high enough
        vm.prank(merchant);
        vm.expectRevert(InvoiceRegistry.DeadlineInPast.selector);
        registry.createInvoice(receiver, usdc, 1e6, block.timestamp - 1, keccak256("x"), "");
    }

    function test_createInvoice_emitsEvent() public {
        // Compute expected invoiceId using merchant address and nonce=0
        bytes32 expectedId = registry.computeInvoiceId(
            merchant, receiver, usdc, 1e6, block.timestamp + 600, keccak256("event-test"), 0
        );

        vm.expectEmit(true, true, true, true);
        emit IInvoiceRegistry.InvoiceCreated(
            expectedId, merchant, receiver, usdc, 1e6,
            block.timestamp + 600, keccak256("event-test"), 0, "memo"
        );

        vm.prank(merchant);
        registry.createInvoice(receiver, usdc, 1e6, block.timestamp + 600, keccak256("event-test"), "memo");
    }

    /* ─────────────────────────────────────────────────────────────
     *  CANCEL INVOICE
     * ───────────────────────────────────────────────────────────── */

    function test_cancelInvoice() public {
        vm.prank(merchant);
        bytes32 invoiceId = registry.createInvoice(
            receiver, usdc, 1e6, block.timestamp + 600, keccak256("cancel"), ""
        );

        vm.prank(merchant);
        registry.cancelInvoice(invoiceId);

        assertEq(uint256(registry.getStatus(invoiceId)), uint256(IInvoiceRegistry.InvoiceStatus.Cancelled));
    }

    function test_cancelInvoice_revert_notMerchant() public {
        vm.prank(merchant);
        bytes32 invoiceId = registry.createInvoice(
            receiver, usdc, 1e6, block.timestamp + 600, keccak256("not-mine"), ""
        );

        vm.prank(rando);
        vm.expectRevert(InvoiceRegistry.NotMerchant.selector);
        registry.cancelInvoice(invoiceId);
    }

    function test_cancelInvoice_revert_notFound() public {
        vm.prank(merchant);
        vm.expectRevert(InvoiceRegistry.InvoiceNotFound.selector);
        registry.cancelInvoice(keccak256("nonexistent"));
    }

    function test_cancelInvoice_revert_alreadyCancelled() public {
        vm.prank(merchant);
        bytes32 invoiceId = registry.createInvoice(
            receiver, usdc, 1e6, block.timestamp + 600, keccak256("double-cancel"), ""
        );

        vm.startPrank(merchant);
        registry.cancelInvoice(invoiceId);

        vm.expectRevert(InvoiceRegistry.InvoiceNotActive.selector);
        registry.cancelInvoice(invoiceId);
        vm.stopPrank();
    }

    /* ─────────────────────────────────────────────────────────────
     *  MARK SETTLED
     * ───────────────────────────────────────────────────────────── */

    function test_markSettled() public {
        vm.prank(merchant);
        bytes32 invoiceId = registry.createInvoice(
            receiver, usdc, 1e6, block.timestamp + 600, keccak256("settle"), ""
        );

        bytes32 settlementRef = keccak256("tx-hash-123");
        vm.prank(payRouter);
        registry.markSettled(invoiceId, settlementRef);

        IInvoiceRegistry.InvoiceData memory inv = registry.getInvoice(invoiceId);
        assertEq(uint256(inv.status), uint256(IInvoiceRegistry.InvoiceStatus.Settled));
        assertEq(inv.settlementTx, settlementRef);
    }

    function test_markSettled_revert_unauthorized() public {
        vm.prank(merchant);
        bytes32 invoiceId = registry.createInvoice(
            receiver, usdc, 1e6, block.timestamp + 600, keccak256("unauth-settle"), ""
        );

        vm.prank(rando);
        vm.expectRevert(InvoiceRegistry.Unauthorized.selector);
        registry.markSettled(invoiceId, keccak256("tx"));
    }

    function test_markSettled_revert_notActive() public {
        vm.prank(merchant);
        bytes32 invoiceId = registry.createInvoice(
            receiver, usdc, 1e6, block.timestamp + 600, keccak256("settle-inactive"), ""
        );

        // Cancel first
        vm.prank(merchant);
        registry.cancelInvoice(invoiceId);

        // Then try to settle
        vm.prank(payRouter);
        vm.expectRevert(InvoiceRegistry.InvoiceNotActive.selector);
        registry.markSettled(invoiceId, keccak256("tx"));
    }

    function test_markSettled_revert_alreadySettled() public {
        vm.prank(merchant);
        bytes32 invoiceId = registry.createInvoice(
            receiver, usdc, 1e6, block.timestamp + 600, keccak256("double-settle"), ""
        );

        vm.startPrank(payRouter);
        registry.markSettled(invoiceId, keccak256("tx1"));

        vm.expectRevert(InvoiceRegistry.InvoiceNotActive.selector);
        registry.markSettled(invoiceId, keccak256("tx2"));
        vm.stopPrank();
    }

    /* ─────────────────────────────────────────────────────────────
     *  DYNAMIC EXPIRY
     * ───────────────────────────────────────────────────────────── */

    function test_getStatus_expired() public {
        vm.prank(merchant);
        bytes32 invoiceId = registry.createInvoice(
            receiver, usdc, 1e6, block.timestamp + 100, keccak256("expiry"), ""
        );

        // Still active
        assertEq(uint256(registry.getStatus(invoiceId)), uint256(IInvoiceRegistry.InvoiceStatus.Active));

        // Warp past deadline
        vm.warp(block.timestamp + 101);
        assertEq(uint256(registry.getStatus(invoiceId)), uint256(IInvoiceRegistry.InvoiceStatus.Expired));
    }

    function test_getStatus_nonexistent() public view {
        assertEq(uint256(registry.getStatus(keccak256("nope"))), uint256(IInvoiceRegistry.InvoiceStatus.None));
    }

    /* ─────────────────────────────────────────────────────────────
     *  COMPUTE INVOICE ID
     * ───────────────────────────────────────────────────────────── */

    function test_computeInvoiceId_deterministic() public view {
        bytes32 id1 = registry.computeInvoiceId(merchant, receiver, usdc, 1e6, 1000, keccak256("det"), 0);
        bytes32 id2 = registry.computeInvoiceId(merchant, receiver, usdc, 1e6, 1000, keccak256("det"), 0);
        assertEq(id1, id2);
    }

    function test_computeInvoiceId_differentInputs() public view {
        bytes32 id1 = registry.computeInvoiceId(merchant, receiver, usdc, 1e6, 1000, keccak256("a"), 0);
        bytes32 id2 = registry.computeInvoiceId(merchant, receiver, usdc, 2e6, 1000, keccak256("a"), 0);
        assertTrue(id1 != id2, "different amounts should produce different IDs");
    }

    /* ─────────────────────────────────────────────────────────────
     *  ADMIN
     * ───────────────────────────────────────────────────────────── */

    function test_setAuthorizedRouter() public {
        address newRouter = makeAddr("newRouter");

        vm.prank(owner);
        registry.setAuthorizedRouter(newRouter, true);
        assertTrue(registry.authorizedRouters(newRouter));

        vm.prank(owner);
        registry.setAuthorizedRouter(newRouter, false);
        assertFalse(registry.authorizedRouters(newRouter));
    }

    function test_setAuthorizedRouter_revert_notOwner() public {
        vm.prank(rando);
        vm.expectRevert(InvoiceRegistry.Unauthorized.selector);
        registry.setAuthorizedRouter(makeAddr("x"), true);
    }

    function test_setAuthorizedRouter_revert_zeroAddress() public {
        vm.prank(owner);
        vm.expectRevert(InvoiceRegistry.ZeroAddress.selector);
        registry.setAuthorizedRouter(address(0), true);
    }

    function test_transferOwnership() public {
        address newOwner = makeAddr("newOwner");

        vm.prank(owner);
        registry.transferOwnership(newOwner);
        assertEq(registry.owner(), newOwner);
    }

    function test_transferOwnership_revert_notOwner() public {
        vm.prank(rando);
        vm.expectRevert(InvoiceRegistry.Unauthorized.selector);
        registry.transferOwnership(rando);
    }

    function test_transferOwnership_revert_zeroAddress() public {
        vm.prank(owner);
        vm.expectRevert(InvoiceRegistry.ZeroAddress.selector);
        registry.transferOwnership(address(0));
    }

    /* ─────────────────────────────────────────────────────────────
     *  FULL LIFECYCLE
     * ───────────────────────────────────────────────────────────── */

    function test_fullLifecycle_createAndSettle() public {
        // Merchant creates invoice
        vm.prank(merchant);
        bytes32 invoiceId = registry.createInvoice(
            receiver, usdc, 5e6, block.timestamp + 600, keccak256("lifecycle"), "Full test"
        );

        // Invoice is Active
        assertEq(uint256(registry.getStatus(invoiceId)), uint256(IInvoiceRegistry.InvoiceStatus.Active));

        // PayRouter settles
        vm.prank(payRouter);
        registry.markSettled(invoiceId, keccak256("settlement-tx"));

        // Invoice is Settled
        assertEq(uint256(registry.getStatus(invoiceId)), uint256(IInvoiceRegistry.InvoiceStatus.Settled));

        // Can't settle again
        vm.prank(payRouter);
        vm.expectRevert(InvoiceRegistry.InvoiceNotActive.selector);
        registry.markSettled(invoiceId, keccak256("tx2"));

        // Can't cancel after settle
        vm.prank(merchant);
        vm.expectRevert(InvoiceRegistry.InvoiceNotActive.selector);
        registry.cancelInvoice(invoiceId);
    }

    function test_fullLifecycle_createAndCancel() public {
        vm.prank(merchant);
        bytes32 invoiceId = registry.createInvoice(
            receiver, usdc, 5e6, block.timestamp + 600, keccak256("cancel-lifecycle"), ""
        );

        assertEq(uint256(registry.getStatus(invoiceId)), uint256(IInvoiceRegistry.InvoiceStatus.Active));

        vm.prank(merchant);
        registry.cancelInvoice(invoiceId);

        assertEq(uint256(registry.getStatus(invoiceId)), uint256(IInvoiceRegistry.InvoiceStatus.Cancelled));

        // Can't settle a cancelled invoice
        vm.prank(payRouter);
        vm.expectRevert(InvoiceRegistry.InvoiceNotActive.selector);
        registry.markSettled(invoiceId, keccak256("tx"));
    }

    /* ─────────────────────────────────────────────────────────────
     *  FUZZ TESTS
     * ───────────────────────────────────────────────────────────── */

    function testFuzz_createInvoice(uint256 amount, uint256 deadlineOffset) public {
        amount = bound(amount, 1, type(uint128).max);
        deadlineOffset = bound(deadlineOffset, 1, 365 days);

        vm.prank(merchant);
        bytes32 invoiceId = registry.createInvoice(
            receiver, usdc, amount, block.timestamp + deadlineOffset,
            keccak256(abi.encode("fuzz", amount)), ""
        );

        IInvoiceRegistry.InvoiceData memory inv = registry.getInvoice(invoiceId);
        assertEq(inv.amountOut, amount);
        assertEq(inv.deadline, block.timestamp + deadlineOffset);
        assertEq(uint256(inv.status), uint256(IInvoiceRegistry.InvoiceStatus.Active));
    }
}
