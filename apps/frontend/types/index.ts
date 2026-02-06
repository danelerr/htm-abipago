/* ─── AbiPago Domain Types ─────────────────────────────────────────── */

/** ENS Payment Profile stored in text records (pay.*) */
export interface PaymentProfile {
  receiver: string;       // pay.receiver  — 0x address
  chainId: number;        // pay.chainId   — EVM chain id
  token: string;          // pay.token     — token contract address
  slippageBps?: number;   // pay.slippageBps
  tipBps?: number;        // pay.tipBps
  memo?: string;          // pay.memo
  expirySec?: number;     // pay.expirySec
  router?: string;        // pay.router    — PayRouter address on dest chain
}

/** Invoice payload (QR / NFC) */
export interface Invoice {
  ens: string;            // ENS name of merchant
  amount: string;         // Display-units amount (e.g. "3.50")
  ref: string;            // Human reference (e.g. "coffee42")
  assetHint?: string;     // Optional display token symbol
}

/** Route information returned by LI.FI */
export interface RouteInfo {
  fromChainName: string;
  fromChainId: number;
  toChainName: string;
  toChainId: number;
  fromToken: string;
  fromTokenSymbol: string;
  toToken: string;
  toTokenSymbol: string;
  fromAmount: string;
  toAmount: string;
  estimatedGasFee: string;
  estimatedTimeSeconds: number;
  routeLabel: string;     // e.g. "Uniswap V4 • LI.FI"
}

/** Payment step IDs */
export type StepId = 'preparing' | 'swapping' | 'settling' | 'completed';

export interface StepInfo {
  id: StepId;
  title: string;
  subtitle: string;
  status: 'completed' | 'in-progress' | 'pending';
}

/** Full payment state for the routing-progress screen */
export interface PaymentState {
  steps: StepInfo[];
  sourceTxHash?: string;
  destTxHash?: string;
}

/* ─── Mock data helpers (remove in production) ─────────────────────── */

export const MOCK_PROFILE: PaymentProfile = {
  receiver: '0x84e5cA5c3a194193CC62c5f7E483e68507003a19',
  chainId: 8453,        // Base
  token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC on Base
  slippageBps: 50,
  memo: 'Cafetería SCZ',
  expirySec: 600,
};

export const MOCK_INVOICE: Invoice = {
  ens: 'cafeteria.eth',
  amount: '3.50',
  ref: 'coffee42',
  assetHint: 'USDC',
};

export const MOCK_ROUTE: RouteInfo = {
  fromChainName: 'Arbitrum',
  fromChainId: 42161,
  toChainName: 'Base',
  toChainId: 8453,
  fromToken: '0x0000000000000000000000000000000000000000',
  fromTokenSymbol: 'ETH',
  toToken: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  toTokenSymbol: 'USDC',
  fromAmount: '0.00125',
  toAmount: '3.50',
  estimatedGasFee: '~$0.12',
  estimatedTimeSeconds: 120,
  routeLabel: 'Uniswap V4 • LI.FI',
};
