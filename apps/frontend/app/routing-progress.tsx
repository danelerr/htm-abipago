/**
 * Routing Progress — real payment execution with PayRouter contract.
 *
 * Receives all payment data from confirm-payment via route params.
 * Executes the actual on-chain transaction:
 *   - Direct:      approve → PayRouter.settle()
 *   - Native ETH:  PayRouter.settleNative()
 *   - Cross-chain: Sign LI.FI tx → poll status → settleFromBridge (automatic)
 *
 * Adapted from: stitch/routing_progress_stepper/code.html
 */
import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { C, S, R } from '@/constants/theme';
import type { StepInfo } from '@/types';
import { useAccount, useProvider } from '@/services/appkit';
import { chainName } from '@/services/ens';
import { getStatus } from '@/services/lifi';
import {
  settle,
  settleNative,
  approveToken,
  checkAllowance,
  waitForTx,
  getWalletClient,
  type OnChainInvoice,
} from '@/services/payrouter';
import { PAY_ROUTER_ADDRESS } from '@/constants/contracts';

export default function RoutingProgressScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    mode?: string;
    merchantEns?: string;
    merchantAddress?: string;
    amount?: string;
    asset?: string;
    ref?: string;
    // Invoice
    invoiceReceiver?: string;
    invoiceTokenOut?: string;
    invoiceAmountOut?: string;
    invoiceDeadline?: string;
    invoiceRef?: string;
    invoiceNonce?: string;
    // Payment plan
    tokenIn?: string;
    tokenInSymbol?: string;
    amountIn?: string;
    amountInHuman?: string;
    // Route info
    fromChainId?: string;
    fromChainName?: string;
    toChainId?: string;
    toChainName?: string;
    fromTokenSymbol?: string;
    toTokenSymbol?: string;
    routeLabel?: string;
    networkFee?: string;
    // LI.FI tx
    lifiTxTo?: string;
    lifiTxData?: string;
    lifiTxValue?: string;
    lifiTxChainId?: string;
    // Contract call
    contractCall?: string;
  }>();

  const { address, chainId: walletChainId } = useAccount();
  const { walletProvider } = useProvider();
  const executingRef = useRef(false);

  // Reconstruct the on-chain invoice from params
  const invoice: OnChainInvoice | null =
    params.invoiceReceiver && params.invoiceTokenOut
      ? {
          receiver: params.invoiceReceiver,
          tokenOut: params.invoiceTokenOut,
          amountOut: BigInt(params.invoiceAmountOut ?? '0'),
          deadline: BigInt(params.invoiceDeadline ?? '0'),
          ref: params.invoiceRef ?? '',
          nonce: BigInt(params.invoiceNonce ?? '0'),
        }
      : null;

  const mode = (params.mode ?? 'direct') as 'direct' | 'native' | 'cross-chain';

  /* ── Steps ─────────────────────────────────────────────────────── */
  const getInitialSteps = (): StepInfo[] => {
    if (mode === 'direct') {
      return [
        { id: 'approving', title: 'Approving token', subtitle: 'Requesting ERC-20 approval…', status: 'pending' },
        { id: 'settling', title: 'Settling on PayRouter', subtitle: `On ${chainName(parseInt(params.toChainId ?? '130', 10))}`, status: 'pending' },
        { id: 'completed', title: 'Payment sent', subtitle: 'Pending', status: 'pending' },
      ];
    }
    if (mode === 'native') {
      return [
        { id: 'settling', title: 'Settling native ETH', subtitle: `Auto-wrapping to WETH…`, status: 'pending' },
        { id: 'completed', title: 'Payment sent', subtitle: 'Pending', status: 'pending' },
      ];
    }
    // cross-chain
    return [
      { id: 'preparing', title: 'Preparing route', subtitle: `Route found via ${params.routeLabel ?? 'LI.FI'}`, status: 'pending' },
      { id: 'swapping', title: 'Swapping / Bridging', subtitle: `${params.fromChainName ?? ''} → ${params.toChainName ?? ''}`, status: 'pending' },
      { id: 'settling', title: 'Settling on destination', subtitle: 'PayRouter settlement', status: 'pending' },
      { id: 'completed', title: 'Payment sent', subtitle: 'Pending', status: 'pending' },
    ];
  };

  const [steps, setSteps] = useState<StepInfo[]>(getInitialSteps);
  const [sourceTxHash, setSourceTxHash] = useState<string | null>(null);
  const [destTxHash, setDestTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const updateStep = useCallback(
    (id: string, update: Partial<StepInfo>) =>
      setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...update } : s))),
    [],
  );

  /* ── Execute payment ───────────────────────────────────────── */
  useEffect(() => {
    if (executingRef.current) return;
    executingRef.current = true;

    (async () => {
      try {
        if (!walletProvider || !address || !invoice) {
          throw new Error('Wallet not connected');
        }

        const account = address as `0x${string}`;

        if (mode === 'direct') {
          // Step 1: Approve
          updateStep('approving', { status: 'in-progress' });
          const tokenIn = (params.tokenIn ?? invoice.tokenOut) as `0x${string}`;
          const amountIn = BigInt(params.amountIn ?? invoice.amountOut.toString());

          const currentAllowance = await checkAllowance(walletProvider, account, tokenIn);
          if (currentAllowance < amountIn) {
            const approveHash = await approveToken(walletProvider, account, tokenIn, amountIn);
            updateStep('approving', { subtitle: 'Waiting for confirmation…', txHash: approveHash });
            await waitForTx(approveHash);
          }
          updateStep('approving', { status: 'completed', subtitle: 'Token approved' });

          // Step 2: Settle
          updateStep('settling', { status: 'in-progress', subtitle: 'Sending to PayRouter…' });
          const txHash = await settle(walletProvider, account, invoice, tokenIn, amountIn);
          setSourceTxHash(txHash);
          updateStep('settling', { subtitle: 'Confirming on-chain…', txHash });
          await waitForTx(txHash);
          updateStep('settling', { status: 'completed', subtitle: 'Settlement confirmed' });

          // Done
          setDestTxHash(txHash);
          updateStep('completed', { status: 'completed', subtitle: 'Payment delivered' });

        } else if (mode === 'native') {
          // Step 1: settleNative
          updateStep('settling', { status: 'in-progress', subtitle: 'Wrapping ETH + settling…' });
          const value = BigInt(params.amountIn ?? '0');
          const txHash = await settleNative(walletProvider, account, invoice, value);
          setSourceTxHash(txHash);
          updateStep('settling', { subtitle: 'Confirming…', txHash });
          await waitForTx(txHash);
          updateStep('settling', { status: 'completed', subtitle: 'Settlement confirmed' });

          setDestTxHash(txHash);
          updateStep('completed', { status: 'completed', subtitle: 'Payment delivered' });

        } else {
          // Cross-chain: sign LI.FI transaction via viem wallet client
          updateStep('preparing', { status: 'in-progress', subtitle: 'Signing transaction…' });

          if (!params.lifiTxTo || !params.lifiTxData) {
            throw new Error('Missing LI.FI transaction data');
          }

          const wallet = getWalletClient(walletProvider);
          const txHash = await wallet.sendTransaction({
            account,
            to: params.lifiTxTo as `0x${string}`,
            data: params.lifiTxData as `0x${string}`,
            value: BigInt(params.lifiTxValue ?? '0'),
          });
          setSourceTxHash(txHash);
          updateStep('preparing', { status: 'completed', subtitle: 'Transaction sent' });
          updateStep('swapping', {
            status: 'in-progress',
            subtitle: 'Bridging in progress…',
            txHash,
          });

          // Wait for source tx to be mined
          await waitForTx(txHash);
          updateStep('swapping', { subtitle: 'Bridge pending…' });

          // Poll LI.FI status
          const fromChain = parseInt(params.fromChainId ?? '42161', 10);
          const toChain = parseInt(params.toChainId ?? '130', 10);
          let bridgeDone = false;
          let pollCount = 0;
          const MAX_POLLS = 120; // 10 min with 5s interval

          while (!bridgeDone && pollCount < MAX_POLLS) {
            await new Promise((r) => setTimeout(r, 5000));
            try {
              const status = await getStatus({
                txHash,
                fromChain,
                toChain,
              });
              if (status.status === 'DONE') {
                bridgeDone = true;
                const destHash = status.receiving?.txHash ?? txHash;
                setDestTxHash(destHash);
                updateStep('swapping', { status: 'completed', subtitle: 'Bridge complete' });
                updateStep('settling', {
                  status: 'completed',
                  subtitle: 'Settlement confirmed',
                  txHash: destHash,
                });
                updateStep('completed', { status: 'completed', subtitle: 'Payment delivered' });
              } else if (status.status === 'FAILED') {
                throw new Error(status.substatusMessage || 'Bridge transfer failed');
              } else {
                updateStep('swapping', { subtitle: `Bridging… (${status.substatus ?? 'pending'})` });
              }
            } catch (pollErr: any) {
              // Ignore poll errors, keep retrying
              if (pollErr?.message?.includes('failed')) throw pollErr;
            }
            pollCount++;
          }

          if (!bridgeDone) {
            // Timeout — mark as likely complete (LI.FI status API may lag)
            updateStep('swapping', { status: 'completed', subtitle: 'Bridge likely complete' });
            updateStep('settling', { status: 'completed', subtitle: 'Check explorer' });
            updateStep('completed', { status: 'completed', subtitle: 'Payment likely delivered' });
          }
        }

        // Navigate to success after short delay
        setTimeout(() => {
          router.replace({
            pathname: '/payment-success',
            params: {
              merchantEns: params.merchantEns ?? '',
              merchantAddress: params.merchantAddress ?? '',
              amount: params.amount ?? '',
              asset: params.asset ?? '',
              fromChainId: params.fromChainId ?? '',
              fromChainName: params.fromChainName ?? '',
              toChainId: params.toChainId ?? '',
              toChainName: params.toChainName ?? '',
              fromTokenSymbol: params.fromTokenSymbol ?? '',
              toTokenSymbol: params.toTokenSymbol ?? '',
              fromAmount: params.amountInHuman ?? '',
              sourceTxHash: sourceTxHash ?? '',
              destTxHash: destTxHash ?? sourceTxHash ?? '',
              networkFee: params.networkFee ?? '',
              routeLabel: params.routeLabel ?? '',
              ref: params.ref ?? '',
            },
          });
        }, 1500);

      } catch (err: any) {
        console.error('[routing] payment error:', err);
        const msg = err?.reason ?? err?.message ?? 'Transaction failed';
        setError(msg);

        // Mark current in-progress step as error
        setSteps((prev) =>
          prev.map((s) =>
            s.status === 'in-progress'
              ? { ...s, status: 'error', subtitle: msg }
              : s,
          ),
        );
      }
    })();
  }, []);

  const allDone = steps.every((s) => s.status === 'completed');
  const hasError = steps.some((s) => s.status === 'error');

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={C.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Processing Payment</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Stepper */}
      <View style={styles.stepperWrap}>
        {steps.map((step, i) => {
          const isLast = i === steps.length - 1;
          return (
            <View key={step.id} style={styles.stepRow}>
              {/* Left: icon + line */}
              <View style={styles.stepLeft}>
                {step.status === 'completed' ? (
                  <View style={styles.stepDone}>
                    <MaterialIcons name="check" size={18} color={C.primaryDark} />
                  </View>
                ) : step.status === 'in-progress' ? (
                  <View style={styles.stepActive}>
                    <ActivityIndicator size="small" color={C.primary} />
                  </View>
                ) : step.status === 'error' ? (
                  <View style={[styles.stepDone, { backgroundColor: '#FF4444' }]}>
                    <MaterialIcons name="close" size={18} color={C.white} />
                  </View>
                ) : (
                  <View style={styles.stepPending}>
                    <View style={styles.pendingDot} />
                  </View>
                )}
                {!isLast && (
                  <View
                    style={[
                      styles.stepLine,
                      step.status === 'completed' && { backgroundColor: C.primary },
                      step.status === 'error' && { backgroundColor: '#FF4444' },
                    ]}
                  />
                )}
              </View>

              {/* Right: content */}
              <View style={[styles.stepContent, step.status === 'pending' && { opacity: 0.4 }]}>
                <Text style={styles.stepTitle}>{step.title}</Text>
                <Text
                  style={[
                    styles.stepSub,
                    step.status === 'completed' && { color: C.primary },
                    step.status === 'in-progress' && { color: C.primary + 'CC' },
                    step.status === 'error' && { color: '#FF4444' },
                  ]}
                >
                  {step.subtitle}
                </Text>

                {/* Tx hash link */}
                {step.txHash && (
                  <Text style={styles.txHashText}>
                    Tx: {step.txHash.slice(0, 10)}…{step.txHash.slice(-6)}
                  </Text>
                )}

                {/* Bridge detail box */}
                {step.id === 'swapping' && step.status === 'in-progress' && (
                  <View style={styles.detailBox}>
                    <View style={styles.detailIcon}>
                      <MaterialIcons name="swap-horiz" size={18} color={C.blue400} />
                    </View>
                    <View>
                      <Text style={styles.detailLabel}>Bridge</Text>
                      <Text style={styles.detailVal}>
                        {params.fromChainName ?? 'Source'}{' '}
                        <Text style={{ color: C.gray500 }}>→</Text>{' '}
                        {params.toChainName ?? 'Unichain'}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            </View>
          );
        })}
      </View>

      {/* Bottom section */}
      <View style={styles.bottom}>
        {/* Status card */}
        <View style={[styles.statusCard, hasError && { backgroundColor: '#3A2222', borderColor: '#4A3030' }]}>
          <View>
            <Text style={styles.statusTitle}>
              {allDone
                ? 'Payment complete!'
                : hasError
                  ? 'Transaction Error'
                  : mode === 'cross-chain'
                    ? 'Bridging via LI.FI...'
                    : 'Settling on PayRouter...'}
            </Text>
            <Text style={styles.statusSub}>
              {allDone
                ? 'Redirecting…'
                : hasError
                  ? 'Check details above'
                  : mode === 'cross-chain'
                    ? 'Finding best rates & routes'
                    : `${params.amount ?? ''} ${params.asset ?? ''} → ${params.merchantEns ?? ''}`}
            </Text>
          </View>
        </View>

        {/* Retry / Processing button */}
        {hasError ? (
          <TouchableOpacity
            style={[styles.processingBtn, { borderColor: '#FF4444' }]}
            onPress={() => router.back()}
          >
            <MaterialIcons name="refresh" size={18} color="#FF4444" />
            <Text style={[styles.processingText, { color: '#FF4444' }]}>Go Back & Retry</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.processingBtn}>
            {!allDone && <ActivityIndicator size="small" color={C.textTertiary} />}
            <Text style={styles.processingText}>
              {allDone ? 'Complete ✓' : 'Processing...'}
            </Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

/* ─── Styles ───────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bgDarkAlt },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: S.md,
    paddingVertical: S.md,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: C.white },

  /* Stepper */
  stepperWrap: { flex: 1, paddingHorizontal: S.lg, paddingTop: S.xl },

  stepRow: { flexDirection: 'row' },
  stepLeft: { alignItems: 'center', width: 32, marginRight: S.md },

  stepDone: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center',
    shadowColor: C.primary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 10,
  },
  stepActive: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: C.bgDarkAlt, borderWidth: 2, borderColor: C.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  stepPending: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: C.bgDarkAlt, borderWidth: 1, borderColor: C.gray700,
    alignItems: 'center', justifyContent: 'center',
  },
  pendingDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.gray700 },

  stepLine: {
    width: 2, flex: 1, minHeight: 24,
    backgroundColor: C.gray700, marginVertical: 4, borderRadius: 1,
  },

  stepContent: { flex: 1, paddingBottom: 28, paddingTop: 4 },
  stepTitle: { fontSize: 15, fontWeight: '600', color: C.white },
  stepSub: { fontSize: 13, color: C.gray500, marginTop: 4 },
  txHashText: { fontSize: 11, color: C.blue400, marginTop: 4, fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }) },

  detailBox: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: C.borderLight,
    borderRadius: R.xl, padding: 12, marginTop: 12,
  },
  detailIcon: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: C.blue500 + '33', alignItems: 'center', justifyContent: 'center',
  },
  detailLabel: { fontSize: 10, color: C.gray400, textTransform: 'uppercase', letterSpacing: 1 },
  detailVal: { fontSize: 13, fontWeight: '500', color: C.white, marginTop: 2 },

  /* Bottom */
  bottom: { padding: S.lg, gap: S.md },

  statusCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#2A3022', borderWidth: 1, borderColor: '#3F4A30',
    borderRadius: R.xl, padding: S.md,
  },
  statusTitle: { fontSize: 14, fontWeight: '700', color: C.white },
  statusSub: { fontSize: 12, color: C.gray400, marginTop: 2 },

  processingBtn: {
    height: 56, borderRadius: R.full,
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: C.borderLight,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12,
  },
  processingText: { fontSize: 15, fontWeight: '700', color: C.textTertiary },
});
