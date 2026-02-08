/**
 * Pay — Scan QR code or Tap NFC to read a merchant invoice.
 * Adapted from: stitch/pay_-_scan_qr/nfc/code.html
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';
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
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import NfcManager, { NfcTech, Ndef } from 'react-native-nfc-manager';
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
    const chainIdStr = url.searchParams.get('chainId');
    const chainId = chainIdStr ? parseInt(chainIdStr, 10) : undefined;
    const token = url.searchParams.get('token') ?? undefined;
    const decimalsStr = url.searchParams.get('decimals');
    const decimals = decimalsStr ? parseInt(decimalsStr, 10) : undefined;
    const router = url.searchParams.get('router') ?? undefined;
    const receiver = url.searchParams.get('receiver') ?? undefined;
    if (!ens || !amount) return null;
    return { ens, amount, ref, assetHint, chainId, token, decimals, router, receiver };
  } catch {
    return null;
  }
}

export default function ScanPayScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<ScanMode>('qr');
  const [resolving, setResolving] = useState(false);
  const [torch, setTorch] = useState(false);
  const hasScanned = useRef(false);          // debounce rapid scans
  const [nfcReading, setNfcReading] = useState(false);

  /* ── Camera permissions ─────────────────────────────────────── */
  const [permission, requestPermission] = useCameraPermissions();

  /* ── NFC: start/stop reading when mode changes ──────────────── */
  useEffect(() => {
    if (mode !== 'nfc') return;
    let cancelled = false;

    (async () => {
      const supported = await NfcManager.isSupported();
      if (!supported) {
        Alert.alert('NFC not supported', 'This device does not support NFC.');
        return;
      }
      await NfcManager.start();
    })();

    return () => {
      cancelled = true;
      NfcManager.cancelTechnologyRequest().catch(() => {});
    };
  }, [mode]);

  /* ── Handle decoded payload (QR or NFC) ─────────────────────── */
  const handlePayload = useCallback(
    async (data: string) => {
      // Try to parse as abipago:// URI
      const invoice = parseAbipagoUri(data);

      if (invoice && isEnsName(invoice.ens)) {
        setResolving(true);
        try {
          const profile = await getPaymentProfile(invoice.ens);
          // QR fields take priority over ENS profile values
          const destChainId = invoice.chainId ?? profile?.chainId;
          router.push({
            pathname: '/confirm-payment',
            params: {
              ens: invoice.ens,
              amount: invoice.amount,
              ref: invoice.ref,
              assetHint: invoice.assetHint ?? '',
              receiver: invoice.receiver ?? profile?.receiver ?? '',
              destChainId: destChainId?.toString() ?? '',
              destToken: invoice.token ?? profile?.token ?? '',
              token: invoice.token ?? '',
              decimals: invoice.decimals?.toString() ?? '',
              slippageBps: profile?.slippageBps?.toString() ?? '',
              memo: profile?.memo ?? '',
              routerAddr: invoice.router ?? profile?.router ?? '',
            },
          });
        } catch {
          Alert.alert('Error', 'Failed to resolve ENS payment profile');
        } finally {
          setResolving(false);
          // Allow scanning again after navigating back
          setTimeout(() => { hasScanned.current = false; }, 2000);
        }
      } else if (invoice) {
        // No ENS name but valid abipago URI (e.g. raw address in QR)
        router.push({
          pathname: '/confirm-payment',
          params: {
            ens: invoice.ens,
            amount: invoice.amount,
            ref: invoice.ref,
            assetHint: invoice.assetHint ?? '',
            receiver: invoice.receiver ?? '',
            destChainId: invoice.chainId?.toString() ?? '',
            destToken: invoice.token ?? '',
            token: invoice.token ?? '',
            decimals: invoice.decimals?.toString() ?? '',
            routerAddr: invoice.router ?? '',
          },
        });
        setTimeout(() => { hasScanned.current = false; }, 2000);
      } else {
        router.push('/confirm-payment');
        setTimeout(() => { hasScanned.current = false; }, 2000);
      }
    },
    [router],
  );

  /* ── QR barcode scanned ─────────────────────────────────────── */
  const onBarcodeScanned = useCallback(
    (result: BarcodeScanningResult) => {
      if (hasScanned.current || resolving) return;
      hasScanned.current = true;
      handlePayload(result.data);
    },
    [handlePayload, resolving],
  );

  /* ── NFC tap ────────────────────────────────────────────────── */
  const startNfcRead = useCallback(async () => {
    if (nfcReading) return;
    setNfcReading(true);
    try {
      await NfcManager.requestTechnology(NfcTech.Ndef);
      const tag = await NfcManager.getTag();
      if (tag?.ndefMessage && tag.ndefMessage.length > 0) {
        const record = tag.ndefMessage[0];
        const text = Ndef.text.decodePayload(new Uint8Array(record.payload));
        if (text) {
          await handlePayload(text);
        } else {
          Alert.alert('NFC', 'Could not read NFC tag payload.');
        }
      } else {
        Alert.alert('NFC', 'No NDEF data found on tag.');
      }
    } catch (e: any) {
      if (e?.message !== 'cancelled') {
        Alert.alert('NFC Error', e?.message ?? 'Failed to read NFC tag');
      }
    } finally {
      NfcManager.cancelTechnologyRequest().catch(() => {});
      setNfcReading(false);
    }
  }, [handlePayload, nfcReading]);

  /* ── Permission not yet determined → show prompt ────────────── */
  const renderPermissionGate = () => (
    <View style={styles.permissionGate}>
      <MaterialIcons name="camera-alt" size={56} color={C.gray500} />
      <Text style={styles.permTitle}>Camera access needed</Text>
      <Text style={styles.permSub}>
        AbiPago uses the camera to scan merchant QR codes.
      </Text>
      <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
        <Text style={styles.permBtnText}>Grant Camera Access</Text>
      </TouchableOpacity>
    </View>
  );

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
            {/* Real camera or permission gate */}
            {!permission?.granted ? (
              renderPermissionGate()
            ) : (
              <CameraView
                style={StyleSheet.absoluteFill}
                facing="back"
                enableTorch={torch}
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                onBarcodeScanned={onBarcodeScanned}
              />
            )}

            {/* QR Viewfinder overlay (always on top of camera) */}
            {permission?.granted && (
              <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
                <View style={styles.viewfinderWrap}>
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
                </View>
              </View>
            )}

            {/* Resolving overlay */}
            {resolving && (
              <View style={styles.resolvingOverlay}>
                <ActivityIndicator size="large" color={C.primary} />
                <Text style={styles.resolvingText}>Resolving merchant…</Text>
              </View>
            )}

            {/* Camera controls */}
            {permission?.granted && (
              <View style={styles.controlsOverlay} pointerEvents="box-none">
                <View style={styles.controls}>
                  <View style={styles.controlBtn} />
                  <TouchableOpacity
                    style={[styles.flashBtn, torch && styles.flashBtnActive]}
                    onPress={() => setTorch((t) => !t)}
                  >
                    <MaterialIcons
                      name={torch ? 'flash-on' : 'flash-off'}
                      size={32}
                      color={torch ? C.black : C.white}
                    />
                  </TouchableOpacity>
                  <View style={styles.controlBtn} />
                </View>
              </View>
            )}
          </>
        ) : (
          /* NFC Tap mode */
          <View style={styles.nfcArea}>
            <View style={styles.nfcCircle}>
              <MaterialIcons name="contactless" size={64} color={C.primary} />
            </View>
            <Text style={styles.nfcTitle}>
              {nfcReading ? 'Listening…' : 'Hold near NFC tag'}
            </Text>
            <Text style={styles.nfcSub}>
              Place your phone close to the merchant&apos;s NFC tag to read the invoice.
            </Text>
            <TouchableOpacity
              style={[styles.nfcSimBtn, (nfcReading || resolving) && { opacity: 0.6 }]}
              onPress={startNfcRead}
              disabled={nfcReading || resolving}
            >
              {nfcReading || resolving ? (
                <ActivityIndicator size="small" color={C.primaryDark} />
              ) : (
                <Text style={styles.nfcSimText}>Start NFC Scan</Text>
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
  },

  /* Permission gate (shown when camera access not granted) */
  permissionGate: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 32,
  },
  permTitle: { fontSize: 18, fontWeight: '700', color: C.white },
  permSub: { fontSize: 13, color: C.gray400, textAlign: 'center', lineHeight: 20 },
  permBtn: {
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: R.full,
    backgroundColor: C.primary,
  },
  permBtnText: { color: C.primaryDark, fontWeight: '700', fontSize: 14 },

  /* Viewfinder overlay (sits on top of camera) */
  viewfinderWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
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

  /* Resolving overlay */
  resolvingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    zIndex: 10,
  } as any,
  resolvingText: { color: C.white, fontSize: 14, fontWeight: '600' },

  /* Controls overlay (bottom of camera area) */
  controlsOverlay: {
    position: 'absolute',
    bottom: 80,
    left: 0,
    right: 0,
    alignItems: 'center',
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
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flashBtnActive: {
    backgroundColor: C.primary,
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
