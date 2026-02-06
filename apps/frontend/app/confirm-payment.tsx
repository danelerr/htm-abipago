/**
 * Confirm Payment — shows merchant, amount, route details, fees.
 * Adapted from: stitch/confirm_payment_details/code.html
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { C, S, R } from '@/constants/theme';
import { MOCK_ROUTE, MOCK_INVOICE } from '@/types';

export default function ConfirmPaymentScreen() {
  const router = useRouter();

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
              source={{ uri: 'https://i.pravatar.cc/80?u=cafeteria' }}
              style={styles.avatar}
            />
            <View style={styles.verifiedBadge}>
              <MaterialIcons name="verified" size={16} color={C.primary} />
            </View>
          </View>
          <Text style={styles.ensName}>{MOCK_INVOICE.ens}</Text>
          <View style={styles.verifiedPill}>
            <MaterialIcons name="check-circle" size={14} color={C.primary} />
            <Text style={styles.verifiedText}>Verified Merchant</Text>
          </View>
        </View>

        {/* ── Invoice Amount ────────────────────────────────────── */}
        <View style={styles.amountSection}>
          <View style={styles.amountRow}>
            <Text style={styles.amountVal}>{MOCK_INVOICE.amount}</Text>
            <Text style={styles.amountToken}>{MOCK_INVOICE.assetHint}</Text>
          </View>
          <Text style={styles.amountFiat}>≈ 0.0012 ETH</Text>
          <View style={styles.refPill}>
            <MaterialIcons name="local-cafe" size={16} color={C.textSecondary} />
            <Text style={styles.refText}>Morning Coffee</Text>
          </View>
        </View>

        {/* ── Route Details Card ────────────────────────────────── */}
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
                {MOCK_ROUTE.fromTokenSymbol}{' '}
                <Text style={styles.routeChain}>on {MOCK_ROUTE.fromChainName}</Text>
              </Text>
            </View>
            <Text style={styles.routeAmount}>{MOCK_ROUTE.fromAmount}</Text>
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
                {MOCK_ROUTE.toTokenSymbol}{' '}
                <Text style={styles.routeChain}>on {MOCK_ROUTE.toChainName}</Text>
              </Text>
            </View>
            <Text style={styles.routeAmount}>{MOCK_ROUTE.toAmount}</Text>
          </View>

          {/* Fees */}
          <View style={styles.feeDivider} />
          <View style={styles.feeRow}>
            <MaterialIcons name="local-gas-station" size={18} color={C.textSecondary} />
            <Text style={styles.feeLabel}>Est. Network Fee</Text>
            <Text style={styles.feeVal}>{MOCK_ROUTE.estimatedGasFee}</Text>
          </View>
          <View style={styles.feeRow}>
            <MaterialIcons name="tune" size={18} color={C.textSecondary} />
            <Text style={styles.feeLabel}>Max Slippage</Text>
            <View style={styles.slippagePill}>
              <Text style={styles.slippageText}>Auto (0.5%)</Text>
            </View>
          </View>
          <View style={styles.feeDivider} />
          <View style={styles.feeRow}>
            <MaterialIcons name="hub" size={18} color={C.textSecondary} />
            <Text style={styles.feeLabel}>Route</Text>
            <Text style={styles.routeVia}>{MOCK_ROUTE.routeLabel}</Text>
          </View>
        </View>

        {/* Partner logos */}
        <View style={styles.partners}>
          <Text style={styles.partnerText}>ENS</Text>
          <Text style={styles.partnerText}>LI.FI</Text>
          <Text style={[styles.partnerText, { fontStyle: 'italic' }]}>Uniswap</Text>
        </View>
      </ScrollView>

      {/* ── Bottom Action Bar ───────────────────────────────────── */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm} activeOpacity={0.85}>
          <View style={styles.confirmArrow}>
            <MaterialIcons name="arrow-forward" size={20} color={C.primaryDark} />
          </View>
          <Text style={styles.confirmText}>Confirm & Pay</Text>
          <Text style={styles.confirmTotal}>$3.62 Total</Text>
        </TouchableOpacity>
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
  confirmBtn: {
    width: '100%', height: 56, backgroundColor: C.primary,
    borderRadius: R.full, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8,
  },
  confirmArrow: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.1)',
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  confirmText: { fontSize: 17, fontWeight: '700', color: C.primaryDark, flex: 1 },
  confirmTotal: { fontSize: 13, fontWeight: '500', color: C.primaryDark + 'AA', marginRight: 16 },
  cancelText: { fontSize: 14, fontWeight: '500', color: C.textTertiary, paddingVertical: 8 },
});
