/**
 * LI.FI API service — cross-chain routing via REST
 *
 * Base URL: https://li.quest/v1
 * No API key required for basic usage.
 *
 * Two main flows:
 *  1. getQuote()  — single-step route (simple transfers)
 *  2. getRoutes() — multi-step routes (advanced, swap+bridge combos)
 *
 * For AbiPago we use `toAmount`-based quoting: the merchant specifies
 * the exact amount they want to receive and we calculate how much the
 * payer needs to send.
 */

const LIFI_BASE = 'https://li.quest/v1';

/* ─── Types (subset of LI.FI response shapes) ───────────────────── */

export interface LiFiToken {
  address: string;
  symbol: string;
  decimals: number;
  chainId: number;
  name: string;
  priceUSD: string;
  logoURI?: string;
}

export interface LiFiGasCost {
  type: string;
  estimate: string;
  amount: string;
  amountUSD: string;
  token: LiFiToken;
}

export interface LiFiFeeCost {
  name: string;
  percentage: string;
  amount: string;
  amountUSD: string;
  included: boolean;
  token: LiFiToken;
}

export interface LiFiEstimate {
  fromAmount: string;
  toAmount: string;
  toAmountMin: string;
  approvalAddress?: string;
  executionDuration?: number;
  feeCosts: LiFiFeeCost[];
  gasCosts: LiFiGasCost[];
}

export interface LiFiAction {
  fromChainId: number;
  toChainId: number;
  fromToken: LiFiToken;
  toToken: LiFiToken;
  fromAmount: string;
  slippage: number;
  fromAddress?: string;
  toAddress?: string;
}

export interface LiFiStep {
  id: string;
  type: 'swap' | 'cross' | 'lifi' | 'protocol';
  tool: string;
  toolDetails?: { key: string; name: string; logoURI: string };
  action: LiFiAction;
  estimate: LiFiEstimate;
  includedSteps?: LiFiStep[];
  transactionRequest?: {
    from: string;
    to: string;
    chainId: number;
    data: string;
    value: string;
    gasPrice?: string;
    gasLimit?: string;
  };
}

export interface LiFiRoute {
  id: string;
  fromChainId: number;
  toChainId: number;
  fromAmountUSD: string;
  fromAmount: string;
  fromToken: LiFiToken;
  toAmountUSD: string;
  toAmount: string;
  toAmountMin: string;
  toToken: LiFiToken;
  gasCostUSD: string;
  steps: LiFiStep[];
}

export interface LiFiRoutesResponse {
  routes: LiFiRoute[];
  unavailableRoutes?: unknown[];
}

/* ─── Quote parameters ───────────────────────────────────────────── */

export interface GetQuoteParams {
  fromChain: number | string;
  toChain: number | string;
  fromToken: string;   // address or symbol
  toToken: string;     // address or symbol
  fromAddress: string; // sender wallet
  toAddress?: string;  // receiver wallet (defaults to fromAddress)
  fromAmount: string;  // raw amount with decimals
  slippage?: number;   // e.g. 0.005 = 0.5%
  order?: 'FASTEST' | 'CHEAPEST';
  integrator?: string;
}

export interface GetQuoteToAmountParams {
  fromChain: number | string;
  toChain: number | string;
  fromToken: string;
  toToken: string;
  fromAddress: string;
  toAddress?: string;
  toAmount: string;   // exact amount merchant wants
  slippage?: number;
  order?: 'FASTEST' | 'CHEAPEST';
  integrator?: string;
}

export interface GetRoutesParams {
  fromChainId: number;
  toChainId: number;
  fromTokenAddress: string;
  toTokenAddress: string;
  fromAmount: string;
  fromAddress?: string;
  toAddress?: string;
  options?: {
    slippage?: number;
    order?: 'FASTEST' | 'CHEAPEST';
    integrator?: string;
    allowBridges?: string[];
    allowExchanges?: string[];
    maxPriceImpact?: number;
  };
}

/* ─── Status check ───────────────────────────────────────────────── */

export interface LiFiStatusParams {
  txHash: string;
  bridge?: string;
  fromChain: number;
  toChain: number;
}

export interface LiFiStatusResponse {
  status: 'NOT_FOUND' | 'INVALID' | 'PENDING' | 'DONE' | 'FAILED';
  substatus?: string;
  substatusMessage?: string;
  sending?: { txHash: string; amount: string; token: LiFiToken };
  receiving?: { txHash: string; amount: string; token: LiFiToken };
}

/* ─── Contract-calls quoting (bridge + dest-chain action) ────────── */

export interface LiFiContractCall {
  fromAmount: string;
  fromTokenAddress: string;
  toContractAddress: string;
  toContractCallData: string;
  toContractGasLimit: string;
}

export interface GetQuoteContractCallsParams {
  fromChain: number | string;
  fromToken: string;
  fromAddress: string;
  toChain: number | string;
  toToken: string;
  toAmount: string;
  toFallbackAddress: string;
  contractCalls: LiFiContractCall[];
  slippage?: number;
}

/* ─── Helpers ────────────────────────────────────────────────────── */

async function lifiGet<T>(path: string, params: Record<string, string | number | undefined>): Promise<T> {
  const url = new URL(`${LIFI_BASE}${path}`);
  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined) url.searchParams.set(key, String(val));
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`LI.FI ${path} ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

async function lifiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${LIFI_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LI.FI ${path} ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

/* ─── Public API ─────────────────────────────────────────────────── */

/**
 * Get a single-step quote (fromAmount-based).
 * Returns a Step object with transactionRequest ready to sign.
 */
export async function getQuote(params: GetQuoteParams): Promise<LiFiStep> {
  return lifiGet<LiFiStep>('/quote', {
    fromChain: params.fromChain,
    toChain: params.toChain,
    fromToken: params.fromToken,
    toToken: params.toToken,
    fromAddress: params.fromAddress,
    toAddress: params.toAddress,
    fromAmount: params.fromAmount,
    slippage: params.slippage ?? 0.005,
    order: params.order ?? 'CHEAPEST',
    integrator: params.integrator ?? 'abipago',
  });
}

/**
 * Get a single-step quote (toAmount-based).
 * The merchant receives exactly `toAmount`; LI.FI computes the required `fromAmount`.
 */
export async function getQuoteToAmount(params: GetQuoteToAmountParams): Promise<LiFiStep> {
  return lifiGet<LiFiStep>('/quote/toAmount', {
    fromChain: params.fromChain,
    toChain: params.toChain,
    fromToken: params.fromToken,
    toToken: params.toToken,
    fromAddress: params.fromAddress,
    toAddress: params.toAddress,
    toAmount: params.toAmount,
    slippage: params.slippage ?? 0.005,
    order: params.order ?? 'CHEAPEST',
    integrator: params.integrator ?? 'abipago',
  });
}

/**
 * Get multiple advanced routes (for swap+bridge combos).
 * Returns an array of Route objects sorted by the requested order.
 */
export async function getRoutes(params: GetRoutesParams): Promise<LiFiRoutesResponse> {
  return lifiPost<LiFiRoutesResponse>('/advanced/routes', {
    fromChainId: params.fromChainId,
    fromTokenAddress: params.fromTokenAddress,
    fromAmount: params.fromAmount,
    toChainId: params.toChainId,
    toTokenAddress: params.toTokenAddress,
    fromAddress: params.fromAddress,
    toAddress: params.toAddress,
    options: {
      slippage: params.options?.slippage ?? 0.005,
      order: params.options?.order ?? 'CHEAPEST',
      integrator: params.options?.integrator ?? 'abipago',
      ...(params.options?.allowBridges && { bridges: { allow: params.options.allowBridges } }),
      ...(params.options?.allowExchanges && { exchanges: { allow: params.options.allowExchanges } }),
      ...(params.options?.maxPriceImpact !== undefined && { maxPriceImpact: params.options.maxPriceImpact }),
    },
  });
}

/**
 * Check transaction status across chains.
 */
export async function getStatus(params: LiFiStatusParams): Promise<LiFiStatusResponse> {
  return lifiGet<LiFiStatusResponse>('/status', {
    txHash: params.txHash,
    bridge: params.bridge,
    fromChain: params.fromChain,
    toChain: params.toChain,
  });
}

/**
 * Get available chains.
 */
export async function getChains(): Promise<{ chains: { id: number; name: string; key: string }[] }> {
  return lifiGet('/chains', {});
}

/**
 * Get available tokens for a specific chain.
 */
export async function getTokens(chainId?: number): Promise<{ tokens: Record<string, LiFiToken[]> }> {
  return lifiGet('/tokens', { chains: chainId });
}

/**
 * Get a quote with post-bridge contract calls on the destination chain.
 * Used for cross-chain payments: LI.FI bridges tokens → calls settleFromBridge on PayRouter.
 */
export async function getQuoteContractCalls(
  params: GetQuoteContractCallsParams,
): Promise<LiFiStep> {
  return lifiPost<LiFiStep>('/quote/contractCalls', {
    fromChain: params.fromChain,
    fromToken: params.fromToken,
    fromAddress: params.fromAddress,
    toChain: params.toChain,
    toToken: params.toToken,
    toAmount: params.toAmount,
    toFallbackAddress: params.toFallbackAddress,
    contractCalls: params.contractCalls,
    slippage: params.slippage ?? 0.005,
    integrator: 'abipago',
  });
}
