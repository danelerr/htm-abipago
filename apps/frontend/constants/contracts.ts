/**
 * AbiPago — On-chain contract addresses & token registry
 *
 * PayRouter deployed & verified on Unichain mainnet (chain 130):
 *   0x91Bf4c06D2A588980450Bb6AEDc43f1923f149c2
 *
 * Token addresses are canonical addresses on each chain.
 * Native ETH is represented by the sentinel 0xEeee…eeEE.
 */

/* ─── PayRouter ──────────────────────────────────────────────────── */

export const PAY_ROUTER_ADDRESS = '0x91Bf4c06D2A588980450Bb6AEDc43f1923f149c2' as const;
export const PAY_ROUTER_CHAIN_ID = 130; // Unichain mainnet

/* ─── Well-known addresses ───────────────────────────────────────── */

export const NATIVE_ETH = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' as const;
export const ADDRESS_ZERO = '0x0000000000000000000000000000000000000000' as const;

/* ─── Unichain infrastructure (from deploy script) ───────────────── */

export const UNICHAIN_UNIVERSAL_ROUTER = '0xEf740bf23aCaE26f6492B10de645D6B98dC8Eaf3' as const;
export const UNICHAIN_WETH = '0x4200000000000000000000000000000000000006' as const;
export const PERMIT2 = '0x000000000022D473030F116dDEE9F6B43aC78BA3' as const;

/* ─── RPC endpoints ──────────────────────────────────────────────── */

export const UNICHAIN_RPC = 'https://unichain-mainnet.g.alchemy.com/v2/y-lD-r3odgBTlWOt-LQDP';
export const ETH_MAINNET_RPC = 'https://eth-mainnet.g.alchemy.com/v2/KvuR1VlQ9mPp-SMWA5yK4';

/* ─── Token addresses by chain ───────────────────────────────────── */

export interface TokenInfo {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  color: string;
}

/**
 * Canonical token addresses per chain.
 * chainId → symbol → TokenInfo
 */
export const TOKEN_REGISTRY: Record<number, Record<string, TokenInfo>> = {
  /* ── Unichain (130) ─────────────────────────────────────────── */
  130: {
    ETH: {
      address: NATIVE_ETH,
      symbol: 'ETH',
      name: 'Ether',
      decimals: 18,
      color: '#627EEA',
    },
    WETH: {
      address: '0x4200000000000000000000000000000000000006',
      symbol: 'WETH',
      name: 'Wrapped Ether',
      decimals: 18,
      color: '#627EEA',
    },
    USDC: {
      address: '0x078D782b760474a361dDA0AF3839290b0EF57AD6',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      color: '#2775CA',
    },
    USDT: {
      address: '0x588cE4F028d8E787b2D7CFE46a3B2b0FcEA0cCAF',
      symbol: 'USDT',
      name: 'Tether',
      decimals: 6,
      color: '#50AF95',
    },
    DAI: {
      address: '0x20caB320a855b39f724131c69424F4deC30EF08d',
      symbol: 'DAI',
      name: 'Dai',
      decimals: 18,
      color: '#F5AC37',
    },
    UNI: {
      address: '0x8f187aA05619a017077f5308904739877ce9eA21',
      symbol: 'UNI',
      name: 'Uniswap',
      decimals: 18,
      color: '#FF007A',
    },
  },

  /* ── Base (8453) ────────────────────────────────────────────── */
  8453: {
    ETH: { address: NATIVE_ETH, symbol: 'ETH', name: 'Ether', decimals: 18, color: '#627EEA' },
    USDC: { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', symbol: 'USDC', name: 'USD Coin', decimals: 6, color: '#2775CA' },
    USDT: { address: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2', symbol: 'USDT', name: 'Tether', decimals: 6, color: '#50AF95' },
    DAI: { address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb', symbol: 'DAI', name: 'Dai', decimals: 18, color: '#F5AC37' },
  },

  /* ── Arbitrum (42161) ───────────────────────────────────────── */
  42161: {
    ETH: { address: NATIVE_ETH, symbol: 'ETH', name: 'Ether', decimals: 18, color: '#627EEA' },
    USDC: { address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', symbol: 'USDC', name: 'USD Coin', decimals: 6, color: '#2775CA' },
    USDT: { address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', symbol: 'USDT', name: 'Tether', decimals: 6, color: '#50AF95' },
    DAI: { address: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1', symbol: 'DAI', name: 'Dai', decimals: 18, color: '#F5AC37' },
    UNI: { address: '0xFa7F8980b0f1E64A2062791cc3b0871572f1F7f0', symbol: 'UNI', name: 'Uniswap', decimals: 18, color: '#FF007A' },
  },

  /* ── Ethereum (1) ───────────────────────────────────────────── */
  1: {
    ETH: { address: NATIVE_ETH, symbol: 'ETH', name: 'Ether', decimals: 18, color: '#627EEA' },
    USDC: { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', symbol: 'USDC', name: 'USD Coin', decimals: 6, color: '#2775CA' },
    USDT: { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', symbol: 'USDT', name: 'Tether', decimals: 6, color: '#50AF95' },
    DAI: { address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', symbol: 'DAI', name: 'Dai', decimals: 18, color: '#F5AC37' },
    UNI: { address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', symbol: 'UNI', name: 'Uniswap', decimals: 18, color: '#FF007A' },
  },

  /* ── Optimism (10) ──────────────────────────────────────────── */
  10: {
    ETH: { address: NATIVE_ETH, symbol: 'ETH', name: 'Ether', decimals: 18, color: '#627EEA' },
    USDC: { address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', symbol: 'USDC', name: 'USD Coin', decimals: 6, color: '#2775CA' },
    USDT: { address: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58', symbol: 'USDT', name: 'Tether', decimals: 6, color: '#50AF95' },
    DAI: { address: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1', symbol: 'DAI', name: 'Dai', decimals: 18, color: '#F5AC37' },
    UNI: { address: '0x6fd9d7AD17242c41f7131d257212c54A0e816691', symbol: 'UNI', name: 'Uniswap', decimals: 18, color: '#FF007A' },
  },

  /* ── Polygon (137) ──────────────────────────────────────────── */
  137: {
    ETH: { address: NATIVE_ETH, symbol: 'ETH', name: 'Ether', decimals: 18, color: '#627EEA' },
    USDC: { address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', symbol: 'USDC', name: 'USD Coin', decimals: 6, color: '#2775CA' },
    USDT: { address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', symbol: 'USDT', name: 'Tether', decimals: 6, color: '#50AF95' },
    DAI: { address: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063', symbol: 'DAI', name: 'Dai', decimals: 18, color: '#F5AC37' },
    UNI: { address: '0xb33EaAd8d922B1083446DC23f610c2567fB5180f', symbol: 'UNI', name: 'Uniswap', decimals: 18, color: '#FF007A' },
  },
};

/**
 * Resolve a token by symbol on a specific chain.
 * Falls back to null if not found.
 */
export function getToken(chainId: number, symbol: string): TokenInfo | null {
  return TOKEN_REGISTRY[chainId]?.[symbol] ?? null;
}

/**
 * Get all tokens available on a specific chain.
 */
export function getTokensForChain(chainId: number): TokenInfo[] {
  const registry = TOKEN_REGISTRY[chainId];
  if (!registry) return [];
  return Object.values(registry);
}

/**
 * Resolve token address by symbol on a given chain.
 */
export function getTokenAddress(chainId: number, symbol: string): string | null {
  return TOKEN_REGISTRY[chainId]?.[symbol]?.address ?? null;
}

/**
 * Get token decimals by symbol on a given chain.
 */
export function getTokenDecimals(chainId: number, symbol: string): number {
  return TOKEN_REGISTRY[chainId]?.[symbol]?.decimals ?? 18;
}

/**
 * Resolve a token by its on-chain address (case-insensitive).
 * Searches the given chain registry; returns null if not found.
 */
export function getTokenByAddress(chainId: number, address: string): TokenInfo | null {
  const registry = TOKEN_REGISTRY[chainId];
  if (!registry) return null;
  const lower = address.toLowerCase();
  return Object.values(registry).find((t) => t.address.toLowerCase() === lower) ?? null;
}


