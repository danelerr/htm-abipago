/**
 * PayRouter service — Interact with the AbiPago PayRouter contract on Unichain.
 *
 * This service provides:
 *  1. Building on-chain Invoice structs from app-level data
 *  2. ERC-20 approve + settle flow for same-chain payments
 *  3. LI.FI contractCall integration for cross-chain (bridge → settleFromBridge)
 *  4. Native ETH settle via settleNative
 *  5. Read helpers: isSettled, computeInvoiceId
 *
 * Uses viem — same library already used for ENS resolution.
 */

import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  encodeFunctionData,
  parseUnits,
  formatUnits,
  keccak256,
  toHex,
  toBytes,
  type PublicClient,
  type WalletClient,
  type Hash,
  type Address,
  type Chain,
} from 'viem';
import { unichain, mainnet, arbitrum, optimism, base, polygon } from 'viem/chains';
import {
  PAY_ROUTER_ADDRESS,
  NATIVE_ETH,
  UNICHAIN_RPC,
  ETH_MAINNET_RPC,
} from '@/constants/contracts';

/* ─── Chain map for multi-chain wallet clients ───────────────────── */

const CHAIN_MAP: Record<number, Chain> = {
  1: mainnet,
  10: optimism,
  130: unichain,
  137: polygon,
  8453: base,
  42161: arbitrum,
};

/* ─── Multi-chain RPC endpoints ──────────────────────────────────── */

const CHAIN_RPC: Record<number, string> = {
  1: ETH_MAINNET_RPC,
  10: 'https://mainnet.optimism.io',
  130: UNICHAIN_RPC,
  137: 'https://polygon-rpc.com',
  8453: 'https://mainnet.base.org',
  42161: 'https://arb1.arbitrum.io/rpc',
};

/* ─── ABIs (viem-style JSON) ─────────────────────────────────────── */

const invoiceTupleType = {
  type: 'tuple' as const,
  components: [
    { name: 'receiver', type: 'address' as const },
    { name: 'tokenOut', type: 'address' as const },
    { name: 'amountOut', type: 'uint256' as const },
    { name: 'deadline', type: 'uint256' as const },
    { name: 'ref', type: 'bytes32' as const },
    { name: 'nonce', type: 'uint256' as const },
  ],
} as const;

export const PAY_ROUTER_ABI = [
  // Views
  {
    type: 'function',
    name: 'computeInvoiceId',
    stateMutability: 'pure',
    inputs: [{ ...invoiceTupleType, name: 'inv' }],
    outputs: [{ name: '', type: 'bytes32' }],
  },
  {
    type: 'function',
    name: 'isSettled',
    stateMutability: 'view',
    inputs: [{ ...invoiceTupleType, name: 'inv' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  // settle (Mode A)
  {
    type: 'function',
    name: 'settle',
    stateMutability: 'nonpayable',
    inputs: [
      { ...invoiceTupleType, name: 'invoice' },
      { name: 'tokenIn', type: 'address' },
      { name: 'amountIn', type: 'uint256' },
      { name: 'swapData', type: 'bytes' },
      { name: 'refundTo', type: 'address' },
    ],
    outputs: [],
  },
  // settleFromBridge (Mode B)
  {
    type: 'function',
    name: 'settleFromBridge',
    stateMutability: 'nonpayable',
    inputs: [
      { ...invoiceTupleType, name: 'invoice' },
      { name: 'tokenIn', type: 'address' },
      { name: 'amountIn', type: 'uint256' },
      { name: 'swapData', type: 'bytes' },
      { name: 'refundTo', type: 'address' },
    ],
    outputs: [],
  },
  // settleNative (Mode C)
  {
    type: 'function',
    name: 'settleNative',
    stateMutability: 'payable',
    inputs: [
      { ...invoiceTupleType, name: 'invoice' },
      { name: 'swapData', type: 'bytes' },
      { name: 'refundTo', type: 'address' },
    ],
    outputs: [],
  },
  // Events
  {
    type: 'event',
    name: 'PaymentExecuted',
    inputs: [
      { name: 'ref', type: 'bytes32', indexed: true },
      { name: 'receiver', type: 'address', indexed: true },
      { name: 'payer', type: 'address', indexed: true },
      { name: 'tokenIn', type: 'address', indexed: false },
      { name: 'amountIn', type: 'uint256', indexed: false },
      { name: 'tokenOut', type: 'address', indexed: false },
      { name: 'amountOut', type: 'uint256', indexed: false },
      { name: 'fee', type: 'uint256', indexed: false },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
] as const;

const ERC20_ABI = [
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'allowance',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

/* ─── On-chain Invoice struct ────────────────────────────────────── */

export interface OnChainInvoice {
  receiver: Address;
  tokenOut: Address;
  amountOut: bigint;
  deadline: bigint;
  ref: `0x${string}`;   // bytes32
  nonce: bigint;
}

/**
 * Build an on-chain Invoice from human-readable params.
 */
export function buildInvoice(params: {
  receiver: string;
  tokenOut: string;
  amountOutHuman: string;
  tokenDecimals: number;
  deadlineSeconds?: number;
  ref: string;
}): OnChainInvoice {
  const amountOut = parseUnits(params.amountOutHuman, params.tokenDecimals);
  const deadline = params.deadlineSeconds
    ? BigInt(Math.floor(Date.now() / 1000) + params.deadlineSeconds)
    : 0n;
  const ref = keccak256(toBytes(params.ref));
  // Random 8-byte nonce
  const nonceBytes = new Uint8Array(8);
  crypto.getRandomValues(nonceBytes);
  const nonce = BigInt(toHex(nonceBytes));

  return {
    receiver: params.receiver as Address,
    tokenOut: params.tokenOut as Address,
    amountOut,
    deadline,
    ref,
    nonce,
  };
}

/* ─── Read-only viem client ──────────────────────────────────────── */

let _publicClient: PublicClient | null = null;

function getPublicClient(): PublicClient {
  if (!_publicClient) {
    _publicClient = createPublicClient({
      chain: unichain,
      transport: http(UNICHAIN_RPC),
    }) as PublicClient;
  }
  return _publicClient;
}

/* ─── Multi-chain read-only clients ──────────────────────────────── */

const _chainClients: Record<number, PublicClient> = {};

/**
 * Get (or create) a cached public client for any supported chain.
 * Used for reading allowance / balance on the payer's source chain.
 */
export function getPublicClientForChain(chainId: number): PublicClient {
  if (chainId === 130) return getPublicClient(); // reuse Unichain singleton
  if (!_chainClients[chainId]) {
    _chainClients[chainId] = createPublicClient({
      chain: CHAIN_MAP[chainId] ?? unichain,
      transport: http(CHAIN_RPC[chainId] ?? UNICHAIN_RPC),
    }) as PublicClient;
  }
  return _chainClients[chainId];
}

/**
 * Check if an invoice has been settled on-chain.
 */
export async function checkIsSettled(invoice: OnChainInvoice): Promise<boolean> {
  const client = getPublicClient();
  return client.readContract({
    address: PAY_ROUTER_ADDRESS,
    abi: PAY_ROUTER_ABI,
    functionName: 'isSettled',
    args: [invoice],
  }) as Promise<boolean>;
}

/**
 * Compute the invoice ID (keccak256 of the 6-field struct).
 */
export async function computeInvoiceId(invoice: OnChainInvoice): Promise<`0x${string}`> {
  const client = getPublicClient();
  return client.readContract({
    address: PAY_ROUTER_ADDRESS,
    abi: PAY_ROUTER_ABI,
    functionName: 'computeInvoiceId',
    args: [invoice],
  }) as Promise<`0x${string}`>;
}

/* ─── Wallet client helper ───────────────────────────────────────── */

/**
 * Create a viem WalletClient from the EIP-1193 provider injected by AppKit.
 */
export function getWalletClient(provider: any, chainId?: number): WalletClient {
  const chain = chainId ? CHAIN_MAP[chainId] ?? unichain : unichain;
  return createWalletClient({
    chain,
    transport: custom(provider),
  });
}

/* ─── ERC-20 helpers ─────────────────────────────────────────────── */

export async function checkAllowance(
  provider: any,
  account: Address,
  tokenIn: Address,
): Promise<bigint> {
  const client = getPublicClient();
  return client.readContract({
    address: tokenIn,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [account, PAY_ROUTER_ADDRESS],
  }) as Promise<bigint>;
}

export async function approveToken(
  provider: any,
  account: Address,
  tokenIn: Address,
  amount: bigint,
): Promise<Hash> {
  const wallet = getWalletClient(provider);
  return wallet.writeContract({
    account,
    chain: unichain,
    address: tokenIn,
    abi: ERC20_ABI,
    functionName: 'approve',
    args: [PAY_ROUTER_ADDRESS, amount],
  });
}

/* ─── Multi-chain ERC-20 helpers (for cross-chain approval) ──────── */

/**
 * Check ERC-20 allowance on any supported chain.
 * Used before cross-chain payments to check if the LI.FI router is approved.
 */
export async function checkAllowanceOnChain(
  chainId: number,
  account: Address,
  token: Address,
  spender: Address,
): Promise<bigint> {
  const client = getPublicClientForChain(chainId);
  return client.readContract({
    address: token,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [account, spender],
  }) as Promise<bigint>;
}

/**
 * Approve an ERC-20 token on any chain (via the user's wallet provider).
 * Used to approve LI.FI's router contract before a cross-chain bridge tx.
 */
export async function approveTokenOnChain(
  provider: any,
  chainId: number,
  account: Address,
  token: Address,
  spender: Address,
  amount: bigint,
): Promise<Hash> {
  const wallet = getWalletClient(provider, chainId);
  const chain = CHAIN_MAP[chainId] ?? null;
  return wallet.writeContract({
    account,
    chain,
    address: token,
    abi: ERC20_ABI,
    functionName: 'approve',
    args: [spender, amount],
  });
}

/**
 * Wait for a transaction to be confirmed on any supported chain.
 */
export async function waitForTxOnChain(chainId: number, hash: Hash) {
  const client = getPublicClientForChain(chainId);
  return client.waitForTransactionReceipt({ hash, timeout: 60_000 });
}

export async function getTokenBalance(
  tokenAddress: Address,
  account: Address,
): Promise<bigint> {
  const client = getPublicClient();
  return client.readContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [account],
  }) as Promise<bigint>;
}

/**
 * Get native ETH balance on Unichain.
 */
export async function getNativeBalance(account: Address): Promise<bigint> {
  const client = getPublicClient();
  return client.getBalance({ address: account });
}

/**
 * Fetch recent PaymentExecuted events for an address (as payer or receiver).
 */
export interface PaymentEvent {
  ref: `0x${string}`;
  receiver: Address;
  payer: Address;
  tokenIn: Address;
  amountIn: bigint;
  tokenOut: Address;
  amountOut: bigint;
  fee: bigint;
  timestamp: bigint;
  txHash: `0x${string}`;
  blockNumber: bigint;
  direction: 'sent' | 'received';
}

export async function getPaymentHistory(
  account: Address,
  fromBlock?: bigint,
): Promise<PaymentEvent[]> {
  const client = getPublicClient();
  const startBlock = fromBlock ?? BigInt(0);

  // Fetch events where account is payer
  const sentLogs = await client.getLogs({
    address: PAY_ROUTER_ADDRESS,
    event: {
      type: 'event',
      name: 'PaymentExecuted',
      inputs: [
        { name: 'ref', type: 'bytes32', indexed: true },
        { name: 'receiver', type: 'address', indexed: true },
        { name: 'payer', type: 'address', indexed: true },
        { name: 'tokenIn', type: 'address', indexed: false },
        { name: 'amountIn', type: 'uint256', indexed: false },
        { name: 'tokenOut', type: 'address', indexed: false },
        { name: 'amountOut', type: 'uint256', indexed: false },
        { name: 'fee', type: 'uint256', indexed: false },
        { name: 'timestamp', type: 'uint256', indexed: false },
      ],
    },
    args: { payer: account },
    fromBlock: startBlock,
    toBlock: 'latest',
  });

  // Fetch events where account is receiver
  const receivedLogs = await client.getLogs({
    address: PAY_ROUTER_ADDRESS,
    event: {
      type: 'event',
      name: 'PaymentExecuted',
      inputs: [
        { name: 'ref', type: 'bytes32', indexed: true },
        { name: 'receiver', type: 'address', indexed: true },
        { name: 'payer', type: 'address', indexed: true },
        { name: 'tokenIn', type: 'address', indexed: false },
        { name: 'amountIn', type: 'uint256', indexed: false },
        { name: 'tokenOut', type: 'address', indexed: false },
        { name: 'amountOut', type: 'uint256', indexed: false },
        { name: 'fee', type: 'uint256', indexed: false },
        { name: 'timestamp', type: 'uint256', indexed: false },
      ],
    },
    args: { receiver: account },
    fromBlock: startBlock,
    toBlock: 'latest',
  });

  const parseLog = (log: any, direction: 'sent' | 'received'): PaymentEvent => ({
    ref: log.args.ref,
    receiver: log.args.receiver,
    payer: log.args.payer,
    tokenIn: log.args.tokenIn,
    amountIn: log.args.amountIn,
    tokenOut: log.args.tokenOut,
    amountOut: log.args.amountOut,
    fee: log.args.fee,
    timestamp: log.args.timestamp,
    txHash: log.transactionHash,
    blockNumber: log.blockNumber,
    direction,
  });

  const sent = sentLogs.map((l) => parseLog(l, 'sent'));
  const received = receivedLogs
    .filter((l) => l.args.receiver?.toLowerCase() !== l.args.payer?.toLowerCase())
    .map((l) => parseLog(l, 'received'));

  // Merge, dedupe, sort newest first
  const all = [...sent, ...received];
  const seen = new Set<string>();
  const deduped = all.filter((e) => {
    const key = `${e.txHash}-${e.direction}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  deduped.sort((a, b) => Number(b.timestamp - a.timestamp));

  return deduped;
}

/* ─── Settlement functions ───────────────────────────────────────── */

/**
 * Mode A: settle() — Payer provides ERC-20 tokens via approve + transferFrom.
 */
export async function settle(
  provider: any,
  account: Address,
  invoice: OnChainInvoice,
  tokenIn: Address,
  amountIn: bigint,
  swapData: `0x${string}` = '0x',
): Promise<Hash> {
  const wallet = getWalletClient(provider);
  return wallet.writeContract({
    account,
    chain: unichain,
    address: PAY_ROUTER_ADDRESS,
    abi: PAY_ROUTER_ABI,
    functionName: 'settle',
    args: [invoice, tokenIn, amountIn, swapData, account],
  });
}

/**
 * Mode B: encodeSettleFromBridge — returns calldata for LI.FI contractCall.
 */
export function encodeSettleFromBridge(
  invoice: OnChainInvoice,
  tokenIn: Address,
  amountIn: bigint,
  swapData: `0x${string}` = '0x',
  refundTo: Address,
): `0x${string}` {
  return encodeFunctionData({
    abi: PAY_ROUTER_ABI,
    functionName: 'settleFromBridge',
    args: [invoice, tokenIn, amountIn, swapData, refundTo],
  });
}

/**
 * Mode C: settleNative() — Pay with native ETH (auto-wrapped to WETH).
 */
export async function settleNative(
  provider: any,
  account: Address,
  invoice: OnChainInvoice,
  value: bigint,
  swapData: `0x${string}` = '0x',
): Promise<Hash> {
  const wallet = getWalletClient(provider);
  return wallet.writeContract({
    account,
    chain: unichain,
    address: PAY_ROUTER_ADDRESS,
    abi: PAY_ROUTER_ABI,
    functionName: 'settleNative',
    args: [invoice, swapData, account],
    value,
  });
}

/**
 * Wait for a transaction to be confirmed.
 */
export async function waitForTx(hash: Hash) {
  const client = getPublicClient();
  return client.waitForTransactionReceipt({ hash });
}

/* ─── Full payment orchestration ─────────────────────────────────── */

export type PaymentMode = 'direct' | 'native' | 'cross-chain';

export interface PaymentPlan {
  mode: PaymentMode;
  invoice: OnChainInvoice;
  tokenIn: string;
  tokenInSymbol: string;
  amountIn: bigint;
  amountInHuman: string;
  needsApproval: boolean;
  estimatedGas?: string;
  lifiContractCall?: string;
}

export async function buildPaymentPlan(params: {
  payerChainId: number;
  destChainId: number;
  tokenInSymbol: string;
  tokenInAddress: string;
  amountInHuman: string;
  amountInRaw: bigint;
  invoice: OnChainInvoice;
  payerAddress: string;
}): Promise<PaymentPlan> {
  const {
    payerChainId,
    destChainId,
    tokenInSymbol,
    tokenInAddress,
    amountInHuman,
    amountInRaw,
    invoice,
    payerAddress,
  } = params;

  const isSameChain = payerChainId === destChainId;
  const isNativeETH =
    tokenInAddress.toLowerCase() === NATIVE_ETH.toLowerCase() ||
    tokenInAddress === '0x0000000000000000000000000000000000000000';

  if (!isSameChain) {
    const callData = encodeSettleFromBridge(
      invoice,
      tokenInAddress as Address,
      amountInRaw,
      '0x',
      payerAddress as Address,
    );

    return {
      mode: 'cross-chain',
      invoice,
      tokenIn: tokenInAddress,
      tokenInSymbol,
      amountIn: amountInRaw,
      amountInHuman,
      needsApproval: false,
      lifiContractCall: callData,
    };
  }

  if (isNativeETH) {
    return {
      mode: 'native',
      invoice,
      tokenIn: NATIVE_ETH,
      tokenInSymbol: 'ETH',
      amountIn: amountInRaw,
      amountInHuman,
      needsApproval: false,
    };
  }

  return {
    mode: 'direct',
    invoice,
    tokenIn: tokenInAddress,
    tokenInSymbol,
    amountIn: amountInRaw,
    amountInHuman,
    needsApproval: true,
  };
}

/**
 * Execute a PaymentPlan. Returns the tx hash (or null for cross-chain).
 */
export async function executePaymentPlan(
  provider: any,
  account: Address,
  plan: PaymentPlan,
): Promise<Hash | null> {
  switch (plan.mode) {
    case 'native': {
      return settleNative(provider, account, plan.invoice, plan.amountIn);
    }
    case 'direct': {
      const currentAllowance = await checkAllowance(provider, account, plan.tokenIn as Address);
      if (currentAllowance < plan.amountIn) {
        const approveHash = await approveToken(provider, account, plan.tokenIn as Address, plan.amountIn);
        await waitForTx(approveHash);
      }
      return settle(provider, account, plan.invoice, plan.tokenIn as Address, plan.amountIn);
    }
    case 'cross-chain': {
      return null;
    }
  }
}

/* ─── Format helpers ─────────────────────────────────────────────── */

export function formatTokenAmount(
  amount: bigint,
  decimals: number,
  maxDecimals = 6,
): string {
  const str = formatUnits(amount, decimals);
  const dot = str.indexOf('.');
  if (dot === -1) return str;
  return str.slice(0, dot + maxDecimals + 1).replace(/0+$/, '').replace(/\.$/, '');
}

/* Re-export parseUnits from viem for convenience */
export { parseUnits, formatUnits } from 'viem';
