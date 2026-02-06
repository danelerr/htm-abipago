# Contracts Package

Smart contracts built with Foundry for the UniPago project.

## Foundry

**Foundry is a blazing fast, portable and modular toolkit for Ethereum application development written in Rust.**

Foundry consists of:

- **Forge**: Ethereum testing framework (like Truffle, Hardhat and DappTools).
- **Cast**: Swiss army knife for interacting with EVM smart contracts, sending transactions and getting chain data.
- **Anvil**: Local Ethereum node, akin to Ganache, Hardhat Network.
- **Chisel**: Fast, utilitarian, and verbose solidity REPL.

## Documentation

https://book.getfoundry.sh/

## Setup

**Important**: After cloning the repository, install Foundry dependencies:

```bash
cd packages/contracts
forge install
```

This will install dependencies in the `lib/` folder (which is gitignored and should NOT be committed).

## Usage

### Build

```shell
$ forge build
```

### Test

```shell
$ forge test
```

### Format

```shell
$ forge fmt
```

### Gas Snapshots

```shell
$ forge snapshot
```

### Anvil

```shell
$ anvil
```

### Deploy

```shell
$ forge script script/Deploy.s.sol --rpc-url <your_rpc_url> --private-key <your_private_key>
```

## Project Structure

```
contracts/
├── src/           # Contract source files (.sol)
├── script/        # Deployment scripts
├── test/          # Test files
└── lib/           # Dependencies (gitignored - run 'forge install')
```

## Notes

- The `lib/` folder is **gitignored** and should NOT be committed
- Run `forge install` after cloning to install dependencies
- Dependencies are managed by Foundry, not by npm/pnpm
- To add new dependencies: `forge install <org>/<repo>`

### Cast

```shell
$ cast <subcommand>
```

### Help

```shell
$ forge --help
$ anvil --help
$ cast --help
```
