/**
 * Confirm Payment — shows merchant, amount, route details, fees.
 * Adapted from: stitch/confirm_payment_details/code.html
 */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { C, S, R } from '@/constants/theme';
import { MOCK_ROUTE, MOCK_INVOICE } from '@/types';
import type { RouteInfo } from '@/types';
import SwipeButton from '@/components/ui/swipe-button';
import { useAccount } from '@/services/appkit';
import { chainName } from '@/services/ens';
import { getQuoteToAmount, type LiFiStep } from '@/services/lifi';

export default function ConfirmPaymentScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    ens?: string;
    amount?: string;
    ref?: string;
    assetHint?: string;
    receiver?: string;
    destChainId?: string;
    destToken?: string;
    slippageBps?: string;
    memo?: string;
    routerAddr?: string;
  }>();
  const { address } = useAccount();

  // Merge incoming params with mock fallbacks
  const merchantEns = params.ens ?? MOCK_INVOICE.ens;
  const payAmount = params.amount ?? MOCK_INVOICE.amount;
  const payRef = params.ref ?? MOCK_INVOICE.ref;
  const destChainId = params.destChainId ? parseInt(params.destChainId, 10) : MOCK_ROUTE.toChainId;
  const destChainLabel = chainName(destChainId);

  // Route fetching state
  const [routeInfo, setRouteInfo] = useState<RouteInfo>(MOCK_ROUTE);
  const [lifiQuote, setLifiQuote] = useState<LiFiStep | null>(null);
  const [fetchingRoute, setFetchingRoute] = useState(false);

  // Fetch a real LI.FI quote when wallet is connected and we have real params
  useEffect(() => {
    if (!address || !params.destToken || !params.destChainId) return;
    let cancelled = false;
    (async () => {
      setFetchingRoute(true);
      try {
        // Payer's source chain — use Arbitrum ETH as default source
        const quote = await getQuoteToAmount({
          fromChain: 42161, // Arbitrum
          toChain: parseInt(params.destChainId!, 10),
          fromToken: '0x0000000000000000000000000000000000000000', // ETH
          toToken: params.destToken!,
          fromAddress: address,
          toAddress: params.receiver || address,
          toAmount: (parseFloat(payAmount) * 1e6).toString(), // Assume 6-decimal stablecoin
          slippage: params.slippageBps ? parseInt(params.slippageBps, 10) / 10000 : 0.005,
        });
        if (cancelled) return;
        setLifiQuote(quote);
        // Map LI.FI response → RouteInfo for display
        setRouteInfo({
          fromChainName: chainName(quote.action.fromChainId),
          fromChainId: quote.action.fromChainId,
          toChainName: chainName(quote.action.toChainId),
          toChainId: quote.action.toChainId,
          fromToken: quote.action.fromToken.address,
          fromTokenSymbol: quote.action.fromToken.symbol,
          toToken: quote.action.toToken.address,
          toTokenSymbol: quote.action.toToken.symbol,
          fromAmount: (
            parseFloat(quote.estimate.fromAmount) /
            10 ** quote.action.fromToken.decimals
          ).toFixed(6),
          toAmount: payAmount,
          estimatedGasFee: quote.estimate.gasCosts?.[0]
            ? `~$${quote.estimate.gasCosts[0].amountUSD}`
            : MOCK_ROUTE.estimatedGasFee,
          estimatedTimeSeconds: quote.estimate.executionDuration ?? 120,
          routeLabel: `${quote.tool} • LI.FI`,
        });
      } catch {
        // Keep mock route on error
      } finally {
        if (!cancelled) setFetchingRoute(false);
      }
    })();
    return () => { cancelled = true; };
  }, [address, params.destToken, params.destChainId, params.receiver, params.slippageBps, payAmount]);

  const handleConfirm = () => {
    router.push('/routing-progress');
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* ── Top Nav ─────────────────────────────────────────────── */}
      <View style={styles.topNav}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={C.white} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Confirm Payment</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* ── Merchant Section ──────────────────────────────────── */}
        <View style={styles.merchantSection}>
          <View style={styles.avatarWrap}>
            <Image
              source={{ uri: `https://i.pravatar.cc/80?u=${merchantEns}` }}
              style={styles.avatar}
            />
            <View style={styles.verifiedBadge}>
              <MaterialIcons name="verified" size={16} color={C.primary} />
            </View>
          </View>
          <Text style={styles.ensName}>{merchantEns}</Text>
          <View style={styles.verifiedPill}>
            <MaterialIcons name="check-circle" size={14} color={C.primary} />
            <Text style={styles.verifiedText}>Verified Merchant</Text>
          </View>
        </View>

        {/* ── Invoice Amount ────────────────────────────────────── */}
        <View style={styles.amountSection}>
          <View style={styles.amountRow}>
            <Text style={styles.amountVal}>{payAmount}</Text>
            <Text style={styles.amountToken}>{params.assetHint || MOCK_INVOICE.assetHint}</Text>
          </View>
          <Text style={styles.amountFiat}>≈ {routeInfo.fromAmount} {routeInfo.fromTokenSymbol}</Text>
          <View style={styles.refPill}>
            <MaterialIcons name="local-cafe" size={16} color={C.textSecondary} />
            <Text style={styles.refText}>{payRef || 'Payment'}</Text>
          </View>
        </View>

        {/* ── Route Details Card ────────────────────────────────── */}
        {fetchingRoute ? (
          <View style={[styles.routeCard, { alignItems: 'center', paddingVertical: 32 }]}>
            <ActivityIndicator color={C.primary} size="large" />
            <Text style={[styles.routeTitle, { marginTop: 12, marginBottom: 0 }]}>
              Finding best route via LI.FI…
            </Text>
          </View>
        ) : (
          <View style={styles.routeCard}>
            <Text style={styles.routeTitle}>Route Details</Text>

          {/* Source */}
          <View style={styles.routeRow}>
            <View style={[styles.chainIcon, { backgroundColor: C.info + '33' }]}>
              <MaterialIcons name="layers" size={20} color={C.info} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.routeLabel}>You pay</Text>
              <Text style={styles.routeVal}>
                {routeInfo.fromTokenSymbol}{' '}
                <Text style={styles.routeChain}>on {routeInfo.fromChainName}</Text>
              </Text>
            </View>
            <Text style={styles.routeAmount}>{routeInfo.fromAmount}</Text>
          </View>

          {/* Arrow */}
          <View style={styles.arrowWrap}>
            <View style={styles.arrowCircle}>
              <MaterialIcons name="arrow-downward" size={14} color={C.textTertiary} />
            </View>
          </View>

          {/* Destination */}
          <View style={styles.routeRow}>
            <View style={[styles.chainIcon, { backgroundColor: C.blue600 + '33' }]}>
              <MaterialIcons name="radio-button-checked" size={20} color={C.blue500} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.routeLabel}>Merchant gets</Text>
              <Text style={styles.routeVal}>
                {routeInfo.toTokenSymbol}{' '}
                <Text style={styles.routeChain}>on {routeInfo.toChainName}</Text>
              </Text>
            </View>
            <Text style={styles.routeAmount}>{routeInfo.toAmount}</Text>
          </View>

          {/* Fees */}
          <View style={styles.feeDivider} />
          <View style={styles.feeRow}>
            <MaterialIcons name="local-gas-station" size={18} color={C.textSecondary} />
            <Text style={styles.feeLabel}>Est. Network Fee</Text>
            <Text style={styles.feeVal}>{routeInfo.estimatedGasFee}</Text>
          </View>
          <View style={styles.feeRow}>
            <MaterialIcons name="tune" size={18} color={C.textSecondary} />
            <Text style={styles.feeLabel}>Max Slippage</Text>
            <View style={styles.slippagePill}>
              <Text style={styles.slippageText}>Auto ({params.slippageBps ? `${parseInt(params.slippageBps, 10) / 100}%` : '0.5%'})</Text>
            </View>
          </View>
          <View style={styles.feeDivider} />
          <View style={styles.feeRow}>
            <MaterialIcons name="hub" size={18} color={C.textSecondary} />
            <Text style={styles.feeLabel}>Route</Text>
            <Text style={styles.routeVia}>{routeInfo.routeLabel}</Text>
          </View>
        </View>
        )}

        {/* Partner logos */}
        <View style={styles.partners}>
          <Text style={styles.partnerText}>ENS</Text>
          <Text style={styles.partnerText}>LI.FI</Text>
          <Text style={[styles.partnerText, { fontStyle: 'italic' }]}>Uniswap</Text>
        </View>
      </ScrollView>

      {/* ── Bottom Action Bar ───────────────────────────────────── */}
      <View style={styles.bottomBar}>
        <GestureHandlerRootView>
          <SwipeButton
            label="Slide to Confirm"
            subLabel="$3.62 Total"
            onSwipeComplete={handleConfirm}
          />
        </GestureHandlerRootView>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.cancelText}>Cancel Transaction</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

/* ─── Styles ───────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bgDarkAlt },

  /* Nav */
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: S.md,
    paddingVertical: S.md,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  navTitle: { fontSize: 17, fontWeight: '700', color: C.white },

  scroll: { paddingHorizontal: S.lg, paddingBottom: 200 },

  /* Merchant */
  merchantSection: { alignItems: 'center', marginTop: S.md, marginBottom: S.xl },
  avatarWrap: { position: 'relative' },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    borderWidth: 2, borderColor: C.bgDarkAlt,
    backgroundColor: C.cardDark,
  },
  verifiedBadge: {
    position: 'absolute', bottom: 0, right: 0,
    backgroundColor: C.bgDarkAlt, borderRadius: 12, padding: 2,
  },
  ensName: { fontSize: 20, fontWeight: '600', color: C.white, marginTop: 16 },
  verifiedPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: C.primary + '1A', borderWidth: 1, borderColor: C.primary + '33',
    borderRadius: R.full, paddingHorizontal: 12, paddingVertical: 4, marginTop: 8,
  },
  verifiedText: { fontSize: 11, fontWeight: '600', color: C.primary, textTransform: 'uppercase', letterSpacing: 0.5 },

  /* Amount */
  amountSection: { alignItems: 'center', marginBottom: 32 },
  amountRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  amountVal: { fontSize: 48, fontWeight: '800', color: C.white, letterSpacing: -2 },
  amountToken: { fontSize: 28, fontWeight: '700', color: C.textSecondary },
  amountFiat: { fontSize: 13, color: C.textTertiary, marginTop: 4 },
  refPill: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.cardDark, borderRadius: R.full,
    paddingHorizontal: 16, paddingVertical: 8, marginTop: 16,
    borderWidth: 1, borderColor: C.borderLight,
  },
  refText: { fontSize: 13, fontWeight: '500', color: C.textSecondary },

  /* Route card */
  routeCard: {
    backgroundColor: C.cardDark,
    borderRadius: R.xxl,
    padding: S.md,
    borderWidth: 1,
    borderColor: C.borderLight,
    marginBottom: S.md,
  },
  routeTitle: {
    fontSize: 12, fontWeight: '500', color: C.textMuted,
    textTransform: 'uppercase', letterSpacing: 1,
    paddingHorizontal: 8, marginBottom: S.sm,
  },
  routeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.bgDarkAlt + '80', borderRadius: R.lg,
    padding: S.md, borderWidth: 1, borderColor: C.borderLight,
  },
  chainIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  routeLabel: { fontSize: 11, color: C.textMuted },
  routeVal: { fontSize: 15, fontWeight: '600', color: C.white },
  routeChain: { fontWeight: '400', color: C.textTertiary },
  routeAmount: { fontSize: 15, fontWeight: '500', color: C.white },

  arrowWrap: { alignItems: 'center', marginVertical: -8, zIndex: 10 },
  arrowCircle: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: C.cardDark, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },

  feeDivider: { height: 1, backgroundColor: C.borderLight, marginVertical: 12 },
  feeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  feeLabel: { flex: 1, fontSize: 13, color: C.textSecondary },
  feeVal: { fontSize: 13, fontWeight: '500', color: C.white },
  slippagePill: { backgroundColor: C.primary + '1A', borderRadius: 4, paddingHorizontal: 8, paddingVertical: 2 },
  slippageText: { fontSize: 11, fontWeight: '500', color: C.primary },
  routeVia: { fontSize: 11, fontWeight: '500', color: C.textTertiary },

  /* Partners */
  partners: {
    flexDirection: 'row', justifyContent: 'center', gap: 16,
    opacity: 0.3, marginBottom: S.xl,
  },
  partnerText: { fontSize: 10, fontWeight: '700', color: C.white, letterSpacing: 2 },

  /* Bottom */
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: C.bgDarkAlt + 'E6',
    borderTopWidth: 1, borderTopColor: C.borderLight,
    borderTopLeftRadius: R.xxl, borderTopRightRadius: R.xxl,
    paddingHorizontal: S.lg, paddingTop: S.md, paddingBottom: 40,
    gap: 12, alignItems: 'center',
  },
  cancelText: { fontSize: 14, fontWeight: '500', color: C.textTertiary, paddingVertical: 8 },
});
