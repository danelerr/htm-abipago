// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {PayRouter} from "../src/PayRouter.sol";
import {InvoiceRegistry} from "../src/InvoiceRegistry.sol";

/**
 * @title DeployPayRouter
 * @notice Deployment script for AbiPago PayRouter + InvoiceRegistry.
 *
 * Usage:
 *   # Base mainnet (recommended for demo)
 *   forge script script/DeployPayRouter.s.sol:DeployPayRouter \
 *     --rpc-url $BASE_RPC_URL \
 *     --broadcast \
 *     --verify \
 *     -vvvv
 *
 * Required env vars:
 *   PRIVATE_KEY         — deployer private key
 *   UNIVERSAL_ROUTER    — Uniswap Universal Router address on target chain
 *   WETH                — WETH (wrapped native) address on target chain
 *
 * Optional env vars:
 *   FEE_RECIPIENT       — address for protocol fees (default: none)
 *   FEE_BPS             — fee in basis points, max 100 (default: 0)
 *
 * ┌─────────────────────────────────────────────────────────────────┐
 * │  Mainnet Addresses (verify at docs before deploying)           │
 * ├─────────────┬──────────────────────────────────────────────────┤
 * │  Chain      │  Universal Router                                │
 * ├─────────────┼──────────────────────────────────────────────────┤
 * │  Base       │  0x6fF5693b99212Da76ad316178A184AB56D299b43      │
 * │  Arbitrum   │  0x6fF5693b99212Da76ad316178A184AB56D299b43      │
 * │  Optimism   │  0x6fF5693b99212Da76ad316178A184AB56D299b43      │
 * │  Ethereum   │  0x66a9893cC07D91D95644AEDD05D03f95e1dBA8Af      │
 * └─────────────┴──────────────────────────────────────────────────┘
 * ┌─────────────┬──────────────────────────────────────────────────┐
 * │  Chain      │  WETH Address                                    │
 * ├─────────────┼──────────────────────────────────────────────────┤
 * │  Base       │  0x4200000000000000000000000000000000000006       │
 * │  Arbitrum   │  0x82aF49447D8a07e3bd95BD0d56f35241523fBab1      │
 * │  Optimism   │  0x4200000000000000000000000000000000000006       │
 * │  Ethereum   │  0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2     │
 * └─────────────┴──────────────────────────────────────────────────┘
 *
 * ⚠️  Verify latest addresses at:
 *     https://docs.uniswap.org/contracts/v4/deployments
 */
contract DeployPayRouter is Script {
    function run() public {
        uint256 deployerPK = vm.envUint("PRIVATE_KEY");
        address universalRouter = vm.envAddress("UNIVERSAL_ROUTER");
        address weth = vm.envAddress("WETH");

        // Optional fee config
        address feeRecipient = vm.envOr("FEE_RECIPIENT", address(0));
        uint256 feeBps = vm.envOr("FEE_BPS", uint256(0));

        console.log("=== AbiPago Deployment ===");
        console.log("  Universal Router:", universalRouter);
        console.log("  WETH:           ", weth);

        vm.startBroadcast(deployerPK);

        // 1. Deploy InvoiceRegistry
        InvoiceRegistry invoiceRegistry = new InvoiceRegistry();
        console.log("  InvoiceRegistry:", address(invoiceRegistry));

        // 2. Deploy PayRouter
        PayRouter payRouter = new PayRouter(universalRouter, weth);
        console.log("  PayRouter:      ", address(payRouter));

        // 3. Authorize PayRouter in InvoiceRegistry
        invoiceRegistry.setAuthorizedRouter(address(payRouter), true);
        console.log("  PayRouter authorized in InvoiceRegistry");

        // 4. Set fee config (if provided)
        if (feeRecipient != address(0) && feeBps > 0) {
            payRouter.setFeeConfig(feeRecipient, uint16(feeBps));
            console.log("  Fee config set:", feeBps, "bps to", feeRecipient);
        }

        vm.stopBroadcast();

        console.log("");
        console.log("=== Deployment Complete ===");
        console.log("  PayRouter:       ", address(payRouter));
        console.log("  InvoiceRegistry: ", address(invoiceRegistry));
        console.log("  Owner:           ", payRouter.owner());
    }
}

