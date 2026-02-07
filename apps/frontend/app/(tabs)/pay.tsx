/**
 * Pay — Scan QR code or Tap NFC to read a merchant invoice.
 * Adapted from: stitch/pay_-_scan_qr/nfc/code.html
 */
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { C, S, R } from '@/constants/theme';
import { getPaymentProfile, isEnsName } from '@/services/ens';
import type { Invoice } from '@/types';

type ScanMode = 'qr' | 'nfc';

/** Parse an abipago:// URI into an Invoice object */
function parseAbipagoUri(raw: string): Invoice | null {
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== 'abipago:') return null;
    const ens = url.searchParams.get('ens');
    const amount = url.searchParams.get('amount');
    const ref = url.searchParams.get('ref') ?? '';
    const assetHint = url.searchParams.get('asset') ?? undefined;
    if (!ens || !amount) return null;
    return { ens, amount, ref, assetHint };
  } catch {
    return null;
  }
}

export default function ScanPayScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<ScanMode>('qr');
  const [resolving, setResolving] = useState(false);

  /** Handle decoded payload from QR or NFC */
  const handlePayload = useCallback(
    async (data: string) => {
      // Try to parse as abipago:// URI
      const invoice = parseAbipagoUri(data);

      if (invoice && isEnsName(invoice.ens)) {
        setResolving(true);
        try {
          const profile = await getPaymentProfile(invoice.ens);
          // Navigate with invoice + profile params
          router.push({
            pathname: '/confirm-payment',
            params: {
              ens: invoice.ens,
              amount: invoice.amount,
              ref: invoice.ref,
              assetHint: invoice.assetHint ?? '',
              // pass profile if resolved
              receiver: profile?.receiver ?? '',
              destChainId: profile?.chainId?.toString() ?? '',
              destToken: profile?.token ?? '',
              slippageBps: profile?.slippageBps?.toString() ?? '',
              memo: profile?.memo ?? '',
              routerAddr: profile?.router ?? '',
            },
          });
        } catch {
          Alert.alert('Error', 'Failed to resolve ENS payment profile');
        } finally {
          setResolving(false);
        }
      } else {
        // Fallback: navigate without profile
        router.push('/confirm-payment');
      }
    },
    [router],
  );

  const handleScanComplete = () => {
    // Simulate scanning an abipago URI
    handlePayload('abipago://pay?ens=cafeteria.eth&amount=3.50&ref=coffee42&asset=USDC');
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* ── Header ──────────────────────────────────────────────── */}
      <Text style={styles.title}>Pay</Text>

      {/* ── Segmented Control ───────────────────────────────────── */}
      <View style={styles.segmentWrap}>
        <View style={styles.segmentTrack}>
          <TouchableOpacity
            style={[styles.segmentBtn, mode === 'qr' && styles.segmentActive]}
            onPress={() => setMode('qr')}
          >
            <Text style={[styles.segmentText, mode === 'qr' && styles.segmentTextActive]}>
              Scan QR
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segmentBtn, mode === 'nfc' && styles.segmentActive]}
            onPress={() => setMode('nfc')}
          >
            <Text style={[styles.segmentText, mode === 'nfc' && styles.segmentTextActive]}>
              Tap NFC
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Camera / NFC Area ───────────────────────────────────── */}
      <View style={styles.cameraArea}>
        {mode === 'qr' ? (
          <>
            {/* QR Viewfinder */}
            <View style={styles.viewfinder}>
              {/* Corner markers */}
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />

              {/* Scan line */}
              <View style={styles.scanLine} />

              <View style={styles.helperPill}>
                <Text style={styles.helperText}>Point at QR Code</Text>
              </View>
            </View>

            {/* Camera controls */}
            <View style={styles.controls}>
              <TouchableOpacity style={styles.controlBtn}>
                <MaterialIcons name="image" size={24} color={C.white} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.flashBtn} onPress={handleScanComplete}>
                <MaterialIcons name="flash-on" size={32} color={C.black} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.controlBtn}>
                <MaterialIcons name="flip-camera-ios" size={24} color={C.white} />
              </TouchableOpacity>
            </View>
          </>
        ) : (
          /* NFC Tap mode */
          <View style={styles.nfcArea}>
            <View style={styles.nfcCircle}>
              <MaterialIcons name="contactless" size={64} color={C.primary} />
            </View>
            <Text style={styles.nfcTitle}>Hold near NFC tag</Text>
            <Text style={styles.nfcSub}>
              Place your phone close to the merchant&apos;s NFC tag to read the invoice.
            </Text>
            <TouchableOpacity
              style={[styles.nfcSimBtn, resolving && { opacity: 0.6 }]}
              onPress={handleScanComplete}
              disabled={resolving}
            >
              {resolving ? (
                <ActivityIndicator size="small" color={C.primaryDark} />
              ) : (
                <Text style={styles.nfcSimText}>Simulate NFC Read</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* ── Info Card ─────────────────────────────────────────── */}
        <View style={styles.infoCard}>
          <View style={styles.infoBolt}>
            <MaterialIcons name="flash-on" size={18} color={C.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.infoTitle}>Smart Routing Active</Text>
            <Text style={styles.infoSub}>
              AbiPago reads merchant ENS profiles and auto-routes your payment via LI.FI
              cross-chain protocol.
            </Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

/* ─── Styles ───────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bgDark },
  title: {
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '700',
    color: C.white,
    paddingTop: S.md,
    paddingBottom: S.sm,
  },

  /* Segment control */
  segmentWrap: { paddingHorizontal: S.lg, paddingBottom: S.lg },
  segmentTrack: {
    flexDirection: 'row',
    backgroundColor: C.surfaceDark,
    borderRadius: R.full,
    padding: 4,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: R.full,
    alignItems: 'center',
  },
  segmentActive: { backgroundColor: '#2C2C2C' },
  segmentText: { fontSize: 14, fontWeight: '500', color: C.gray500 },
  segmentTextActive: { color: C.white },

  /* Camera area */
  cameraArea: {
    flex: 1,
    marginHorizontal: S.md,
    marginBottom: S.md,
    borderRadius: R.xxl,
    backgroundColor: C.black,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* Viewfinder */
  viewfinder: {
    width: '78%',
    aspectRatio: 1,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: R.xxl,
    position: 'relative',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 20,
  },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
  },
  cornerTL: {
    top: -1, left: -1,
    borderTopWidth: 4, borderLeftWidth: 4,
    borderColor: C.primary,
    borderTopLeftRadius: 16,
  },
  cornerTR: {
    top: -1, right: -1,
    borderTopWidth: 4, borderRightWidth: 4,
    borderColor: C.primary,
    borderTopRightRadius: 16,
  },
  cornerBL: {
    bottom: -1, left: -1,
    borderBottomWidth: 4, borderLeftWidth: 4,
    borderColor: C.primary,
    borderBottomLeftRadius: 16,
  },
  cornerBR: {
    bottom: -1, right: -1,
    borderBottomWidth: 4, borderRightWidth: 4,
    borderColor: C.primary,
    borderBottomRightRadius: 16,
  },
  scanLine: {
    position: 'absolute',
    top: '45%',
    left: '5%',
    right: '5%',
    height: 2,
    backgroundColor: C.primary,
    borderRadius: 1,
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 15,
  },
  helperPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: R.full,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  helperText: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '500' },

  /* Camera controls */
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 32,
    marginTop: 32,
  },
  controlBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flashBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* NFC */
  nfcArea: { alignItems: 'center', gap: 16, paddingHorizontal: 32 },
  nfcCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: C.primary + '40',
    backgroundColor: C.primary + '10',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nfcTitle: { fontSize: 18, fontWeight: '700', color: C.white },
  nfcSub: { fontSize: 13, color: C.textTertiary, textAlign: 'center', lineHeight: 20 },
  nfcSimBtn: {
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: R.full,
    backgroundColor: C.primary,
  },
  nfcSimText: { color: C.primaryDark, fontWeight: '700', fontSize: 14 },

  /* Info card */
  infoCard: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    backgroundColor: C.surfaceDark + 'E6',
    borderWidth: 1,
    borderColor: C.borderLight,
    borderRadius: R.lg,
    padding: S.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  infoBolt: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: C.primary + '33',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoTitle: { fontSize: 13, fontWeight: '600', color: C.white, marginBottom: 2 },
  infoSub: { fontSize: 11, color: C.gray400, lineHeight: 16 },
});
