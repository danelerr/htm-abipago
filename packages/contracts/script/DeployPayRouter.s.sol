// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {PayRouter} from "../src/PayRouter.sol";

/**
 * @title DeployPayRouter
 * @notice Deployment script for AbiPago PayRouter on Unichain.
 *
 * Usage (Unichain mainnet):
 *   forge script script/DeployPayRouter.s.sol:DeployPayRouter \
 *     --rpc-url https://mainnet.unichain.org \
 *     --broadcast --verify \
 *     --verifier blockscout \
 *     --verifier-url https://unichain.blockscout.com/api/ \
 *     -vvvv
 *
 * Usage (Unichain Sepolia testnet):
 *   forge script script/DeployPayRouter.s.sol:DeployPayRouter \
 *     --rpc-url https://sepolia.unichain.org \
 *     --broadcast --verify \
 *     --verifier blockscout \
 *     --verifier-url https://unichain-sepolia.blockscout.com/api/ \
 *     -vvvv
 *
 * Verify at: https://docs.unichain.org/docs/technical-information/contract-addresses
 */
contract DeployPayRouter is Script {
    function run() public {
        uint256 deployerPk = vm.envUint("PRIVATE_KEY");

        // Default to Unichain mainnet addresses
        address universalRouter = vm.envOr("UNIVERSAL_ROUTER", address(0xEf740bf23aCaE26f6492B10de645D6B98dC8Eaf3));
        address weth = vm.envOr("WETH", address(0x4200000000000000000000000000000000000006));
        // Permit2 is canonical across all chains
        address permit2 = vm.envOr("PERMIT2", address(0x000000000022D473030F116dDEE9F6B43aC78BA3));

        // Optional fee config
        address feeRecipient = vm.envOr("FEE_RECIPIENT", address(0));
        uint256 feeBps = vm.envOr("FEE_BPS", uint256(0));

        console.log("=== AbiPago Deployment ===");
        console.log("  Universal Router:", universalRouter);
        console.log("  WETH:           ", weth);
        console.log("  Permit2:        ", permit2);

        vm.startBroadcast(deployerPk);

        // 1. Deploy PayRouter
        PayRouter payRouter = new PayRouter(universalRouter, weth, permit2);
        console.log("  PayRouter:      ", address(payRouter));

        // 2. Set fee config (if provided)
        if (feeRecipient != address(0) && feeBps > 0) {
            // casting to 'uint16' is safe because feeBps is validated by setFeeConfig (max 100)
            // forge-lint: disable-next-line(unsafe-typecast)
            payRouter.setFeeConfig(feeRecipient, uint16(feeBps));
            console.log("  Fee config set:", feeBps, "bps to", feeRecipient);
        }

        vm.stopBroadcast();

        console.log("");
        console.log("=== Deployment Complete ===");
        console.log("  PayRouter:       ", address(payRouter));
        console.log("  Owner:           ", payRouter.owner());
    }
}

