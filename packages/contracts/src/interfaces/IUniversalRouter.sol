// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IUniversalRouter — Minimal interface for Uniswap's Universal Router.
 * @notice Used by PayRouter to execute V4 swaps on the destination chain.
 *
 * Universal Router command reference (Uniswap v4):
 *   0x10 = V4_SWAP  — Execute a Uniswap V4 pool swap
 *
 * See: https://docs.uniswap.org/contracts/universal-router/overview
 */
interface IUniversalRouter {
    /// @notice Executes encoded commands along with provided inputs.
    /// @param commands  Packed bytes where each byte is a command id.
    /// @param inputs    ABI-encoded inputs for each command.
    /// @param deadline  Timestamp after which the tx reverts.
    function execute(
        bytes calldata commands,
        bytes[] calldata inputs,
        uint256 deadline
    ) external payable;
}
