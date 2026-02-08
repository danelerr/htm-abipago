# Important
In the presentation video, the demo portion cut off at a crucial moment, and the audio is out of sync. You can review the contract and its transactions directly
https://unichain.blockscout.com/address/0x91Bf4c06D2A588980450Bb6AEDc43f1923f149c2?tab=txs

# AbiPago

Mobile intent-based payments with NFC/QR scanning, ENS payment profiles, LI.FI cross-chain routing, and Uniswap V4 settlement.

## What it does

AbiPago lets merchants get paid in their preferred token on their preferred chain, regardless of which chain or token the payer uses.

A merchant registers an ENS name (e.g. `cafeteria.eth`) and publishes payment preferences as ENS text records: receiver address, chain ID, token, slippage tolerance, and expiry. A payer opens the app, scans a QR code or taps an NFC tag containing the merchant's ENS name and invoice amount, and the app handles everything else: it resolves the ENS name, calculates the optimal cross-chain route via LI.FI, bridges and swaps tokens, and calls the PayRouter smart contract on the destination chain, which performs a final Uniswap V4 swap if the bridged token does not match what the merchant requested, then transfers the exact amount to the merchant's wallet and emits an on-chain receipt event.

The user experience is: scan, confirm, done. No manual bridging, no token selection, no chain switching.

## Problem

In real-world crypto payments, three frictions prevent adoption:

1. **Chain/token mismatch.** The merchant and the payer are rarely on the same chain with the same token.
2. **Centralized payment configuration.** "How to get paid" typically requires a backend, a database, and vendor lock-in.
3. **UX complexity.** The user should not need to understand bridges, routers, or slippage.

## Solution

AbiPago converts an invoice into three composable layers:

- **Portable identity and configuration** via ENS text records (no backend required).
- **Cross-chain execution** via LI.FI Composer (swap + bridge + contract call in one transaction).
- **Final settlement** via a PayRouter smart contract on Unichain that uses Uniswap V4 Universal Router when a token swap is needed.

## Architecture

```
Payer (any chain)
  |
  | 1. Scan QR / Tap NFC
  v
AbiPago Mobile App (React Native / Expo)
  |
  | 2. Resolve ENS text records (pay.receiver, pay.chainId, pay.token, etc.)
  | 3. Calculate best route via LI.FI API
  | 4. User confirms payment
  |
  | 5. Sign transaction via WalletConnect
  v
Source Chain
  |
  | 6. LI.FI swap + bridge
  v
Unichain Mainnet (Chain 130)
  |
  | 7. LI.FI calls PayRouter.settleFromBridge()
  | 8. PayRouter swaps via Uniswap V4 Universal Router (if needed)
  | 9. PayRouter transfers exact amount to merchant
  | 10. Emits PaymentExecuted event (on-chain receipt)
  v
Merchant Wallet
```

Full architecture diagrams are in [docs/architecture.md](docs/architecture.md).

## Smart Contract

**PayRouter v2** is deployed and verified on Unichain mainnet (chain 130):

| Field | Value |
|-------|-------|
| Address | [`0x91Bf4c06D2A588980450Bb6AEDc43f1923f149c2`](https://unichain.blockscout.com/address/0x91Bf4c06D2A588980450Bb6AEDc43f1923f149c2) |
| Chain | Unichain Mainnet (130) |
| Solidity | 0.8.24 |
| EVM | Cancun |
| Optimizer | 200 runs, via_ir=true |

### Settlement modes

| Mode | Function | Description |
|------|----------|-------------|
| A | `settle()` | Same-chain: payer approves tokens, PayRouter pulls via transferFrom |
| B | `settleFromBridge()` | Cross-chain: LI.FI bridges tokens to the contract, then calls this function |
| C | `settleNative()` | Native ETH: auto-wraps to WETH via IWETH9 |
| D | `settleBatch()` | Multiple invoices settled in a single transaction |

### Swap logic

When `tokenIn != tokenOut`, PayRouter executes a swap through Uniswap V4 via the Universal Router:

1. Approves Permit2 for the input token (ERC-20 infinite approval, only once per token).
2. Grants the Universal Router a short-lived Permit2 allowance (30 minutes).
3. Calls `universalRouter.execute()` with the V4_SWAP command.
4. Verifies the output balance meets `amountOut`.
5. Deducts protocol fee (if configured, max 1%).
6. Transfers the final amount to the merchant.
7. Refunds any dust to `refundTo`.

### Constructor dependencies

| Parameter | Address | Description |
|-----------|---------|-------------|
| `_universalRouter` | `0xEf740bf23aCaE26f6492B10de645D6B98dC8Eaf3` | Uniswap V4 Universal Router |
| `_weth` | `0x4200000000000000000000000000000000000006` | WETH (OP Stack standard) |
| `_permit2` | `0x000000000022D473030F116dDEE9F6B43aC78BA3` | Uniswap Permit2 |

### Test suite

38 tests covering all settlement modes, validation, admin functions, and edge cases.

```
packages/contracts/src/PayRouter.sol             526 lines
packages/contracts/src/interfaces/IPayRouter.sol 134 lines
packages/contracts/test/PayRouter.t.sol          837 lines
packages/contracts/script/DeployPayRouter.s.sol   96 lines
```

## ENS as Payment Profile

Instead of a centralized database, merchants publish payment settings as ENS text records:

| Text Record | Example Value | Purpose |
|-------------|---------------|---------|
| `pay.receiver` | `0x84e5...3a19` | Merchant wallet address |
| `pay.chainId` | `130` | Settlement chain (Unichain) |
| `pay.token` | `0x078D...AD6` | Desired token (USDC on Unichain) |
| `pay.slippageBps` | `50` | Allowed slippage (0.5%) |
| `pay.memo` | `My Coffee Shop` | Display name |
| `pay.expirySec` | `600` | Invoice expiry (10 minutes) |
| `pay.router` | `0x91Bf...9c2` | PayRouter contract address |

The app resolves these records via viem's ENS client connected to Ethereum mainnet (where the ENS registry lives), then uses the profile data to build the LI.FI route and the on-chain invoice.

## LI.FI Integration

LI.FI Composer handles cross-chain routing. The app calls the LI.FI REST API to:

1. **Get a quote** (`/v1/quote/toAmount`) for the exact amount the merchant wants to receive.
2. **Get a quote with contract calls** (`/v1/quote/contractCalls`) so LI.FI bridges tokens to PayRouter and atomically calls `settleFromBridge()` on arrival.
3. **Check status** (`/v1/status`) to track the cross-chain transaction.

Supported source chains: Ethereum, Base, Arbitrum, Optimism, Polygon (any EVM chain LI.FI supports).

## Project Structure

```
abipago-monorepo/
  apps/
    frontend/                    React Native mobile app (Expo SDK 54)
      app/
        _layout.tsx              Root layout with dark theme
        (tabs)/
          _layout.tsx            Tab navigation (Home, Pay, Activity, Profile)
          index.tsx              Home dashboard with ENS identity + balances
          pay.tsx                QR scanner / NFC reader
          activity.tsx           Transaction history from PayRouter events
          profile.tsx            ENS payment profile display
        confirm-payment.tsx      Route preview + LI.FI quote + confirm
        routing-progress.tsx     Step-by-step progress during payment
        payment-success.tsx      Receipt with tx hashes
        merchant-invoice.tsx     Generate QR / write NFC for merchants
      services/
        ens.ts                   ENS resolution (viem)
        lifi.ts                  LI.FI REST API client (332 lines)
        payrouter.ts             PayRouter contract interaction (619 lines)
        appkit.ts                WalletConnect / Reown AppKit
      constants/
        contracts.ts             Deployed addresses, token registry, ABI
        theme.ts                 Colors, spacing, radius
      types/
        index.ts                 Domain types (PaymentProfile, Invoice, etc.)
  packages/
    contracts/                   Foundry project
      src/
        PayRouter.sol            Main settlement contract (526 lines)
        interfaces/
          IPayRouter.sol         Public interface (134 lines)
      test/
        PayRouter.t.sol          38-test suite (837 lines)
      script/
        DeployPayRouter.s.sol    Deploy script (96 lines)
  docs/
    architecture.md              12 Mermaid diagrams
    deployment-guide.md          Setup and integration guide
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile app | React Native, Expo SDK 54, Expo Router, TypeScript |
| Wallet connection | WalletConnect via Reown AppKit |
| ENS resolution | viem (getEnsAddress, getEnsName, getEnsText, getEnsAvatar) |
| Cross-chain routing | LI.FI REST API (quote, routes, contractCalls, status) |
| Smart contract | Solidity 0.8.24, Foundry, Cancun EVM |
| On-chain swap | Uniswap V4 Universal Router, Permit2 |
| NFC | react-native-nfc-manager |
| QR | expo-camera, react-native-qrcode-svg |
| Target chain | Unichain Mainnet (130) |

## Getting Started

### Prerequisites

- Node.js >= 18
- pnpm >= 10
- Foundry (for contract development)
- Expo CLI (`npx expo`)
- iOS Simulator or Android Emulator (or physical device)

### Install

```bash
git clone https://github.com/your-org/abipago.git
cd abipago
pnpm install
```

### Run the mobile app

```bash
cd apps/frontend
npx expo start
```

Press `i` for iOS simulator, `a` for Android emulator, or scan the QR with Expo Go on a physical device.

### Run contract tests

```bash
cd packages/contracts
forge test -vvv
```

### Build contracts

```bash
cd packages/contracts
forge build
```

## Supported Tokens

### Unichain (destination chain)

| Token | Address | Decimals |
|-------|---------|----------|
| USDC | `0x078D782b760474a361dDA0AF3839290b0EF57AD6` | 6 |
| USDT | `0x588CE4F028D8e787B2d7cfe46A3B2B0FCea0cCaF` | 6 |
| DAI | `0x20CAb320A855b39F724131C69424F4dEC30Ef08d` | 18 |
| WETH | `0x4200000000000000000000000000000000000006` | 18 |
| UNI | `0x8f187aA05619a017077f5308904739877ce9eA21` | 18 |

### Source chains

Payers can pay from Base (8453), Arbitrum (42161), Ethereum (1), Optimism (10), and Polygon (137). Full token registry in `apps/frontend/constants/contracts.ts`.

## How It Is Made

AbiPago is a React Native (Expo SDK 54) mobile app with a Solidity smart contract backend. Merchants publish a "payment profile" on ENS using text records (`pay.chainId`, `pay.token`, `pay.receiver`, etc.), so the app resolves human-readable names and auto-configures settlement without any centralized server.

When a user pays, the app connects via WalletConnect (Reown AppKit) and uses LI.FI Composer to swap and bridge from the user's current chain/token to the merchant's desired chain/token. On the destination chain, LI.FI calls the PayRouter contract via `contractCalls` to finalize settlement; if the bridged token does not match what the merchant requested, PayRouter performs a final swap using Uniswap V4 (Universal Router + Permit2) before transferring funds and emitting an on-chain receipt event.

ENS acts as a portable, decentralized payments configuration layer. LI.FI + Uniswap V4 make the entire cross-chain swap-to-pay flow feel like a single tap.

## License

MIT
