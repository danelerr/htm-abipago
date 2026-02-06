// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {PayRouter} from "../src/PayRouter.sol";

/**
 * @title DeployPayRouter
 * @notice Deployment script for AbiPago PayRouter.
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
 *
 * Universal Router addresses (mainnet):
 *   Base:      0x6fF5693b99212Da76ad316178A184AB56D299b43
 *   Arbitrum:  0x6fF5693b99212Da76ad316178A184AB56D299b43
 *   Optimism:  0x6fF5693b99212Da76ad316178A184AB56D299b43
 *   Ethereum:  0x66a9893cC07D91D95644AEDD05D03f95e1dBA8Af
 *
 *   ⚠️  Verify latest addresses at:
 *       https://docs.uniswap.org/contracts/v4/deployments
 */
contract DeployPayRouter is Script {
    function run() public {
        uint256 deployerPK = vm.envUint("PRIVATE_KEY");
        address universalRouter = vm.envAddress("UNIVERSAL_ROUTER");

        console.log("Deploying PayRouter...");
        console.log("  Universal Router:", universalRouter);

        vm.startBroadcast(deployerPK);

        PayRouter payRouter = new PayRouter(universalRouter);

        vm.stopBroadcast();

        console.log("=== PayRouter deployed ===");
        console.log("  Address:", address(payRouter));
        console.log("  Owner:  ", payRouter.owner());
    }
}
