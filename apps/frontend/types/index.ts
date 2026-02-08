/* ─── AbiPago Domain Types ─────────────────────────────────────────── */

import { PAY_ROUTER_ADDRESS, PAY_ROUTER_CHAIN_ID } from '@/constants/contracts';

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

/** Invoice payload from QR / NFC scan */
export interface Invoice {
  ens: string;            // ENS name of merchant
  amount: string;         // Display-units amount (e.g. "3.50")
  ref: string;            // Human reference (e.g. "coffee42")
  assetHint?: string;     // Optional display token symbol
  chainId?: number;       // Destination chain from QR
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
export type StepId = 'approving' | 'preparing' | 'swapping' | 'settling' | 'completed';

export interface StepInfo {
  id: StepId;
  title: string;
  subtitle: string;
  status: 'completed' | 'in-progress' | 'pending' | 'error';
  txHash?: string;
}

/** Full payment state for the routing-progress screen */
export interface PaymentState {
  steps: StepInfo[];
  sourceTxHash?: string;
  destTxHash?: string;
}

/** Payment result passed to the success screen */
export interface PaymentResult {
  merchantEns: string;
  merchantAddress: string;
  amount: string;
  asset: string;
  fromChainId: number;
  fromChainName: string;
  toChainId: number;
  toChainName: string;
  fromToken: string;
  fromTokenSymbol: string;
  fromAmount: string;
  toToken: string;
  toTokenSymbol: string;
  sourceTxHash: string;
  destTxHash?: string;
  networkFee: string;
  routeLabel: string;
  ref: string;
  timestamp: number;
}

/* ─── Defaults & mock fallbacks ────────────────────────────────────── */

export const MOCK_PROFILE: PaymentProfile = {
  receiver: '0x84e5cA5c3a194193CC62c5f7E483e68507003a19',
  chainId: PAY_ROUTER_CHAIN_ID, // Unichain
  token: '0x078D782b760474a361dDA0AF3839290b0EF57AD6', // USDC on Unichain
  slippageBps: 50,
  memo: 'Cafetería SCZ',
  expirySec: 600,
  router: PAY_ROUTER_ADDRESS,
};

export const MOCK_INVOICE: Invoice = {
  ens: 'cafeteria.eth',
  amount: '3.50',
  ref: 'coffee42',
  assetHint: 'USDC',
  chainId: PAY_ROUTER_CHAIN_ID,
};

export const MOCK_ROUTE: RouteInfo = {
  fromChainName: 'Arbitrum',
  fromChainId: 42161,
  toChainName: 'Unichain',
  toChainId: PAY_ROUTER_CHAIN_ID,
  fromToken: '0x0000000000000000000000000000000000000000',
  fromTokenSymbol: 'ETH',
  toToken: '0x078D782b760474a361dDA0AF3839290b0EF57AD6',
  toTokenSymbol: 'USDC',
  fromAmount: '0.00125',
  toAmount: '3.50',
  estimatedGasFee: '~$0.12',
  estimatedTimeSeconds: 120,
  routeLabel: 'Uniswap V4 • LI.FI',
};
