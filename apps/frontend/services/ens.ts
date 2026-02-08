/**
 * ENS resolver service — resolve names, addresses, and payment text records.
 *
 * Uses `viem` public client connected to Ethereum mainnet for all ENS
 * resolution (the ENS registry lives on L1 even though the merchant
 * may receive payments on L2s).
 *
 * AbiPago-specific text records:
 *   - pay.receiver     → 0x address on dest chain
 *   - pay.chainId      → destination chain ID
 *   - pay.token        → token address on dest chain
 *   - pay.slippageBps  → allowed slippage in basis points
 *   - pay.tipBps       → tip in basis points
 *   - pay.memo         → merchant display memo
 *   - pay.expirySec    → invoice expiry seconds
 *   - pay.router       → PayRouter contract on dest chain
 */

import { createPublicClient, http, type PublicClient } from 'viem';
import { mainnet } from 'viem/chains';
import { normalize } from 'viem/ens';
import type { PaymentProfile } from '@/types';

/* ─── Singleton public client ────────────────────────────────────── */

let _client: PublicClient | null = null;

function getClient(): PublicClient {
  if (!_client) {
    _client = createPublicClient({
      chain: mainnet,
      transport: http('https://eth-mainnet.g.alchemy.com/v2/KvuR1VlQ9mPp-SMWA5yK4'),
    }) as PublicClient;
  }
  return _client;
}

/* ─── Core resolution ────────────────────────────────────────────── */

/**
 * Forward resolution: ENS name → 0x address
 */
export async function resolveAddress(name: string): Promise<string | null> {
  const client = getClient();
  const address = await client.getEnsAddress({ name: normalize(name) });
  return address ?? null;
}

/**
 * Reverse resolution: 0x address → ENS name
 */
export async function resolveName(address: `0x${string}`): Promise<string | null> {
  const client = getClient();
  const name = await client.getEnsName({ address });
  return name ?? null;
}

/**
 * Get avatar URL for an ENS name
 */
export async function resolveAvatar(name: string): Promise<string | null> {
  const client = getClient();
  const avatar = await client.getEnsAvatar({ name: normalize(name) });
  return avatar ?? null;
}

/* ─── Text record helpers ────────────────────────────────────────── */

/**
 * Read a single text record from an ENS name's resolver.
 */
export async function getTextRecord(name: string, key: string): Promise<string | null> {
  const client = getClient();
  const value = await client.getEnsText({ name: normalize(name), key });
  return value ?? null;
}

/**
 * Read multiple text records in parallel.
 */
export async function getTextRecords(
  name: string,
  keys: string[],
): Promise<Record<string, string | null>> {
  const results = await Promise.all(keys.map((key) => getTextRecord(name, key)));
  const map: Record<string, string | null> = {};
  keys.forEach((key, i) => {
    map[key] = results[i];
  });
  return map;
}

/* ─── AbiPago Payment Profile ────────────────────────────────────── */

const PAYMENT_KEYS = [
  'pay.receiver',
  'pay.chainId',
  'pay.token',
  'pay.slippageBps',
  'pay.tipBps',
  'pay.memo',
  'pay.expirySec',
  'pay.router',
] as const;

/**
 * Fetch the full AbiPago PaymentProfile from a merchant's ENS text records.
 * Returns `null` if the minimum required records (receiver, chainId, token) are missing.
 */
export async function getPaymentProfile(ensName: string): Promise<PaymentProfile | null> {
  const records = await getTextRecords(ensName, [...PAYMENT_KEYS]);

  const receiver = records['pay.receiver'];
  const chainIdStr = records['pay.chainId'];
  const token = records['pay.token'];

  // Minimum required fields
  if (!receiver || !chainIdStr || !token) return null;

  const profile: PaymentProfile = {
    receiver,
    chainId: parseInt(chainIdStr, 10),
    token,
  };

  if (records['pay.slippageBps']) {
    profile.slippageBps = parseInt(records['pay.slippageBps'], 10);
  }
  if (records['pay.tipBps']) {
    profile.tipBps = parseInt(records['pay.tipBps'], 10);
  }
  if (records['pay.memo']) {
    profile.memo = records['pay.memo'];
  }
  if (records['pay.expirySec']) {
    profile.expirySec = parseInt(records['pay.expirySec'], 10);
  }
  if (records['pay.router']) {
    profile.router = records['pay.router'];
  }

  return profile;
}

/* ─── Utility ────────────────────────────────────────────────────── */

/**
 * Check if a string looks like a valid ENS name (contains `.`).
 */
export function isEnsName(value: string): boolean {
  return value.includes('.') && !value.startsWith('0x');
}

/**
 * Format an address for display: 0x1234…5678
 */
export function formatAddress(address: string, chars = 4): string {
  if (address.length < chars * 2 + 2) return address;
  return `${address.slice(0, chars + 2)}…${address.slice(-chars)}`;
}

/**
 * Chain ID → human-readable name (for display purposes).
 */
const CHAIN_NAMES: Record<number, string> = {
  1: 'Ethereum',
  10: 'Optimism',
  130: 'Unichain',
  137: 'Polygon',
  8453: 'Base',
  42161: 'Arbitrum',
};

export function chainName(chainId: number): string {
  return CHAIN_NAMES[chainId] ?? `Chain ${chainId}`;
}
