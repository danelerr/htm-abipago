// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {PayRouter} from "../src/PayRouter.sol";
import {IPayRouter} from "../src/interfaces/IPayRouter.sol";

/**
 * @title PopulatePayRouter
 * @notice Sends 3 demo transactions to PayRouter for hackathon demo purposes.
 *
 * Usage:
 *   forge script script/PopulatePayRouter.s.sol:PopulatePayRouter \
 *     --rpc-url https://mainnet.unichain.org \
 *     --broadcast --interactives 1 \
 *     -vvvv
 *
 * Required env vars:
 *   PAY_ROUTER  — deployed PayRouter address
 *
 * Optional env vars:
 *   MERCHANT    — merchant address to receive payments (default: deployer)
 */
contract PopulatePayRouter is Script {
    function run() public {
        address payRouterAddr = vm.envAddress("PAY_ROUTER");
        PayRouter router = PayRouter(payable(payRouterAddr));

        // Use deployer as default merchant, or override
        address merchant = vm.envOr("MERCHANT", msg.sender);

        console.log("=== Populating PayRouter ===");
        console.log("  PayRouter:", payRouterAddr);
        console.log("  Merchant: ", merchant);
        console.log("  Sender:   ", msg.sender);

        vm.startBroadcast();

        // ── TX 1: settleNative — pay 0.0001 ETH (WETH) ──────────
        {
            IPayRouter.Invoice memory inv = IPayRouter.Invoice({
                receiver: merchant,
                tokenOut: address(router.weth()),
                amountOut: 0.0001 ether,
                deadline: block.timestamp + 3600,
                ref: keccak256("demo-coffee-001"),
                nonce: 1001
            });

            router.settleNative{value: 0.0001 ether}(inv, "", msg.sender);
            console.log("  TX1: settleNative 0.0001 ETH -> WETH");
        }

        // ── TX 2: settleNative — pay 0.0002 ETH (WETH) ──────────
        {
            IPayRouter.Invoice memory inv = IPayRouter.Invoice({
                receiver: merchant,
                tokenOut: address(router.weth()),
                amountOut: 0.0002 ether,
                deadline: block.timestamp + 3600,
                ref: keccak256("demo-lunch-002"),
                nonce: 1002
            });

            router.settleNative{value: 0.0002 ether}(inv, "", msg.sender);
            console.log("  TX2: settleNative 0.0002 ETH -> WETH");
        }

        // ── TX 3: settleNative — pay 0.00015 ETH (WETH) ─────────
        {
            IPayRouter.Invoice memory inv = IPayRouter.Invoice({
                receiver: merchant,
                tokenOut: address(router.weth()),
                amountOut: 0.00015 ether,
                deadline: block.timestamp + 3600,
                ref: keccak256("demo-snack-003"),
                nonce: 1003
            });

            router.settleNative{value: 0.00015 ether}(inv, "", msg.sender);
            console.log("  TX3: settleNative 0.00015 ETH -> WETH");
        }

        vm.stopBroadcast();

        console.log("");
        console.log("=== Done! 3 payments settled ===");
        console.log("  Total ETH spent: 0.00045 ETH");
    }
}
