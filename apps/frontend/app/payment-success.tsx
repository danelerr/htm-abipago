/**
 * Payment Success Receipt — shows confirmation, route summary, tx hashes.
 * Adapted from: stitch/payment_success_receipt/code.html
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { C, S, R } from '@/constants/theme';

const MOCK_SOURCE_HASH = '0x71c76a4f8e3b9d012abc4def567890abcdef892a';
const MOCK_DEST_HASH = '0x3b2e9c7d456f1a2b3c4d5e6f7a8b9c0d1e2f119c';

export default function PaymentSuccessScreen() {
  const router = useRouter();

  const copyHash = (hash: string) => {
    Alert.alert('Copied', hash);
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <View style={{ width: 40 }} />
        <Text style={styles.topTitle}>Payment Receipt</Text>
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={() => router.replace('/(tabs)')}
        >
          <MaterialIcons name="close" size={20} color={C.white} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* ── Success Indicator ─────────────────────────────────── */}
        <View style={styles.successWrap}>
          <View style={styles.successGlow} />
          <View style={styles.successCircle}>
            <MaterialIcons name="check" size={44} color={C.black} />
          </View>
        </View>
        <Text style={styles.successTitle}>Payment Successful</Text>

        {/* ── Recipient & Amount ────────────────────────────────── */}
        <View style={styles.recipientSection}>
          <View style={styles.recipientAvatarRing}>
            <Image
              source={{ uri: 'https://i.pravatar.cc/64?u=cafeteria' }}
              style={styles.recipientAvatar}
            />
          </View>
          <View style={styles.recipientNameRow}>
            <Text style={styles.recipientName}>cafeteria.eth</Text>
            <MaterialIcons name="verified" size={14} color={C.primary} />
          </View>
          <View style={styles.amountRow}>
            <Text style={styles.amountVal}>3.50</Text>
            <Text style={styles.amountToken}>USDC</Text>
          </View>
        </View>

        {/* ── Transaction Route Card ───────────────────────────── */}
        <View style={styles.routeCard}>
          <Text style={styles.routeTitle}>Transaction Route</Text>

          {/* Source row */}
          <View style={styles.txRow}>
            <View style={styles.chainBadge}>
              <Text style={styles.chainBadgeText}>ARB</Text>
              <View style={styles.tokenBadge}>
                <Text style={styles.tokenBadgeText}>Ξ</Text>
              </View>
            </View>
            <View>
              <Text style={styles.txRowMain}>Sent 0.0012 ETH</Text>
              <Text style={styles.txRowSub}>From Arbitrum</Text>
            </View>
          </View>

          {/* Connector */}
          <View style={styles.connector}>
            <View style={styles.connectorLine} />
            <View style={styles.connectorPill}>
              <View style={styles.connectorDot} />
              <Text style={styles.connectorText}>Routed via LI.FI</Text>
            </View>
          </View>

          {/* Destination row */}
          <View style={styles.txRow}>
            <View style={[styles.chainBadge, { backgroundColor: C.blue600 }]}>
              <Text style={styles.chainBadgeText}>BASE</Text>
              <View style={[styles.tokenBadge, { backgroundColor: C.blue500 }]}>
                <Text style={styles.tokenBadgeText}>$</Text>
              </View>
            </View>
            <View>
              <Text style={[styles.txRowMain, { color: C.primary }]}>Received 3.50 USDC</Text>
              <Text style={styles.txRowSub}>On Base</Text>
            </View>
          </View>

          {/* Fee */}
          <View style={styles.feeDivider} />
          <View style={styles.feeRow}>
            <Text style={styles.feeLabel}>Network Fee</Text>
            <Text style={styles.feeVal}>~$0.02</Text>
          </View>
        </View>

        {/* ── Tx Hashes ────────────────────────────────────────── */}
        <View style={styles.hashesSection}>
          <TouchableOpacity style={styles.hashRow} onPress={() => copyHash(MOCK_SOURCE_HASH)}>
            <View>
              <Text style={styles.hashLabel}>Source Hash</Text>
              <Text style={styles.hashVal}>{MOCK_SOURCE_HASH.slice(0, 8)}…{MOCK_SOURCE_HASH.slice(-4)}</Text>
            </View>
            <MaterialIcons name="content-copy" size={18} color={C.gray500} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.hashRow} onPress={() => copyHash(MOCK_DEST_HASH)}>
            <View>
              <Text style={styles.hashLabel}>Dest Hash</Text>
              <Text style={styles.hashVal}>{MOCK_DEST_HASH.slice(0, 8)}…{MOCK_DEST_HASH.slice(-4)}</Text>
            </View>
            <MaterialIcons name="open-in-new" size={18} color={C.gray500} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ── Bottom Actions ──────────────────────────────────────── */}
      <View style={styles.bottomActions}>
        <TouchableOpacity
          style={styles.payAgainBtn}
          activeOpacity={0.85}
          onPress={() => router.replace('/(tabs)')}
        >
          <Text style={styles.payAgainText}>Pay Again</Text>
          <MaterialIcons name="payment" size={20} color={C.black} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.shareBtn}>
          <Text style={styles.shareText}>Share Receipt</Text>
          <MaterialIcons name="share" size={16} color={C.white} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

/* ─── Styles ───────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bgDarkAlt },

  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: S.lg, paddingTop: S.md, paddingBottom: S.sm,
  },
  topTitle: { fontSize: 13, fontWeight: '600', color: C.gray400, textTransform: 'uppercase', letterSpacing: 0.5 },
  closeBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center',
  },

  scroll: { paddingHorizontal: S.lg, paddingBottom: 200, alignItems: 'center' },

  /* Success */
  successWrap: { marginTop: 32, marginBottom: 20, position: 'relative', alignItems: 'center', justifyContent: 'center' },
  successGlow: {
    position: 'absolute', width: 100, height: 100, borderRadius: 50,
    backgroundColor: C.primary + '33',
  },
  successCircle: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: C.primary,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: C.primary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 20,
  },
  successTitle: { fontSize: 24, fontWeight: '700', color: C.white, marginBottom: 32 },

  /* Recipient */
  recipientSection: { alignItems: 'center', gap: 8, marginBottom: 32, width: '100%' },
  recipientAvatarRing: {
    width: 64, height: 64, borderRadius: 32, padding: 3,
    borderWidth: 2, borderColor: C.primary + '40',
  },
  recipientAvatar: { width: '100%', height: '100%', borderRadius: 28, backgroundColor: C.black },
  recipientNameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  recipientName: { fontSize: 16, fontWeight: '500', color: C.textSecondary },
  amountRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 4 },
  amountVal: { fontSize: 40, fontWeight: '800', color: C.white, letterSpacing: -2 },
  amountToken: { fontSize: 20, fontWeight: '700', color: C.gray400 },

  /* Route card */
  routeCard: {
    width: '100%', backgroundColor: C.cardDark, borderRadius: R.xxl,
    padding: 20, borderWidth: 1, borderColor: C.borderLight, marginBottom: S.lg,
  },
  routeTitle: { fontSize: 11, fontWeight: '700', color: C.gray400, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 },

  txRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  chainBadge: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: C.info, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: C.cardDark, position: 'relative',
  },
  chainBadgeText: { fontSize: 8, fontWeight: '700', color: C.white },
  tokenBadge: {
    position: 'absolute', bottom: -4, right: -4,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: '#1E293B', borderWidth: 1, borderColor: C.cardDark,
    alignItems: 'center', justifyContent: 'center',
  },
  tokenBadgeText: { fontSize: 8, fontWeight: '700', color: C.white },
  txRowMain: { fontSize: 14, fontWeight: '600', color: C.white },
  txRowSub: { fontSize: 12, color: C.gray500, marginTop: 2 },

  connector: { flexDirection: 'row', alignItems: 'center', paddingLeft: 20, height: 40 },
  connectorLine: {
    position: 'absolute', left: 19, top: 0, bottom: 0, width: 2,
    backgroundColor: C.primary,
  },
  connectorPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: C.surfaceDarker, borderRadius: R.full,
    paddingHorizontal: 12, paddingVertical: 4, marginLeft: 24,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  connectorDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.primary },
  connectorText: { fontSize: 10, fontWeight: '500', color: C.gray400 },

  feeDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 16 },
  feeRow: { flexDirection: 'row', justifyContent: 'space-between' },
  feeLabel: { fontSize: 12, color: C.gray500 },
  feeVal: { fontSize: 12, fontWeight: '500', color: C.textSecondary },

  /* Hashes */
  hashesSection: { width: '100%', gap: 12, paddingHorizontal: 8 },
  hashRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 8,
  },
  hashLabel: { fontSize: 10, color: C.gray500, textTransform: 'uppercase', letterSpacing: 1 },
  hashVal: { fontSize: 13, color: C.gray400, marginTop: 2 },

  /* Bottom */
  bottomActions: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: S.lg, paddingBottom: 40, paddingTop: S.md,
    backgroundColor: C.bgDarkAlt,
    gap: 12,
  },
  payAgainBtn: {
    height: 56, backgroundColor: C.primary, borderRadius: R.full,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    shadowColor: C.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 14,
  },
  payAgainText: { fontSize: 17, fontWeight: '700', color: C.black },
  shareBtn: {
    height: 48, borderRadius: R.full,
    borderWidth: 1, borderColor: C.gray700,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  shareText: { fontSize: 15, fontWeight: '600', color: C.white },
});
