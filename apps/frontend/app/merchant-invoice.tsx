/**
 * Merchant Create Invoice — amount input, note, generate QR or write NFC.
 * Adapted from: stitch/merchant_create_invoice/code.html
 *
 * The screen reads the connected wallet's ENS name / address/chainId and
 * builds a real `abipago://` URI that another AbiPago user can scan.
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Switch,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  Modal,
  FlatList,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import NfcManager, { NfcTech, Ndef } from 'react-native-nfc-manager';
import * as Haptics from 'expo-haptics';
import QRCode from 'react-native-qrcode-svg';
import { C, S, R } from '@/constants/theme';
import {
  PAY_ROUTER_ADDRESS,
  PAY_ROUTER_CHAIN_ID,
  getToken,
  getTokenAddress,
  getTokenDecimals,
} from '@/constants/contracts';
import { useAccount, useAppKit } from '@/services/appkit';
import {
  resolveName,
  resolveAvatar,
  getPaymentProfile,
  formatAddress,
  chainName,
} from '@/services/ens';
import type { PaymentProfile } from '@/types';

/* ─── Supported receive networks ─────────────────────────────────── */
interface NetworkOption {
  id: number;
  name: string;
  color: string;
}

const RECEIVE_NETWORKS: NetworkOption[] = [
  { id: 130, name: 'Unichain', color: '#FF007A' },
  { id: 8453, name: 'Base', color: '#0052FF' },
  { id: 42161, name: 'Arbitrum', color: '#28A0F0' },
  { id: 1, name: 'Ethereum', color: '#627EEA' },
  { id: 10, name: 'Optimism', color: '#FF0420' },
  { id: 137, name: 'Polygon', color: '#8247E5' },
];

/* ─── Supported assets ───────────────────────────────────────────── */
interface AssetOption {
  symbol: string;
  name: string;
  color: string;
}

const ASSETS: AssetOption[] = [
  { symbol: 'USDC', name: 'USD Coin', color: '#2775CA' },
  { symbol: 'USDT', name: 'Tether', color: '#50AF95' },
  { symbol: 'DAI', name: 'Dai', color: '#F5AC37' },
  { symbol: 'ETH', name: 'Ether', color: '#627EEA' },
  { symbol: 'UNI', name: 'Uniswap', color: '#FF007A' },
];

export default function MerchantInvoiceScreen() {
  const router = useRouter();
  const { address, isConnected, chainId } = useAccount();
  const { open } = useAppKit();

  /* ── Form state ────────────────────────────────────────────── */
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [tipEnabled, setTipEnabled] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<AssetOption>(ASSETS[0]);
  const [selectedNetwork, setSelectedNetwork] = useState<NetworkOption>(RECEIVE_NETWORKS[0]);

  /* ── Dropdowns ─────────────────────────────────────────────── */
  const [showAssetPicker, setShowAssetPicker] = useState(false);
  const [showNetworkPicker, setShowNetworkPicker] = useState(false);

  /* ── QR Modal ──────────────────────────────────────────────── */
  const [showQR, setShowQR] = useState(false);

  /* ── Derived wallet identity ───────────────────────────────── */
  const [ensName, setEnsName] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [profile, setProfile] = useState<PaymentProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  /* ── NFC ────────────────────────────────────────────────────── */
  const [nfcSupported, setNfcSupported] = useState<boolean | null>(null);
  const [nfcWriting, setNfcWriting] = useState(false);

  /* Resolve ENS name + avatar when wallet connects */
  useEffect(() => {
    if (!address) {
      setEnsName(null);
      setAvatarUrl(null);
      setProfile(null);
      return;
    }
    (async () => {
      try {
        const name = await resolveName(address as `0x${string}`);
        setEnsName(name);
        if (name) {
          const [avatar, prof] = await Promise.all([
            resolveAvatar(name),
            getPaymentProfile(name),
          ]);
          setAvatarUrl(avatar);
          if (prof) setProfile(prof);
        }
      } catch {
        /* silent */
      }
    })();
  }, [address]);

  /* Check NFC support */
  useEffect(() => {
    (async () => {
      try {
        const supported = await NfcManager.isSupported();
        setNfcSupported(supported);
        if (supported) await NfcManager.start();
      } catch {
        setNfcSupported(false);
      }
    })();
  }, []);

  /* Display values */
  const displayName = ensName ?? (address ? formatAddress(address) : 'Not Connected');
  const displayAddr = address ? formatAddress(address) : '—';
  const networkLabel = chainId ? chainName(Number(chainId)) : '—';

  /* Build the invoice URI — includes real token address + router for on-chain settlement */
  const invoiceUri = useMemo(() => {
    const name = ensName ?? address ?? '';
    const ref = note || `inv-${Date.now()}`;
    const tokenAddr = getTokenAddress(selectedNetwork.id, selectedAsset.symbol) ?? '';
    const tokenDec = getTokenDecimals(selectedNetwork.id, selectedAsset.symbol);
    return (
      `abipago://pay?ens=${encodeURIComponent(name)}` +
      `&amount=${amount || '0'}` +
      `&ref=${encodeURIComponent(ref)}` +
      `&asset=${selectedAsset.symbol}` +
      `&chainId=${selectedNetwork.id}` +
      `&token=${tokenAddr}` +
      `&decimals=${tokenDec}` +
      `&router=${PAY_ROUTER_ADDRESS}` +
      `&receiver=${address ?? ''}`
    );
  }, [ensName, address, amount, note, selectedAsset, selectedNetwork]);

  /* Manually reload ENS payment profile */
  const handleLoadProfile = useCallback(async () => {
    const name = ensName;
    if (!name) {
      Alert.alert('No ENS', 'Connect a wallet with an ENS name first.');
      return;
    }
    setLoadingProfile(true);
    try {
      const prof = await getPaymentProfile(name);
      if (prof) {
        setProfile(prof);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Alert.alert('No Profile', `No AbiPago payment records found for ${name}`);
      }
    } catch {
      Alert.alert('Error', 'Could not fetch ENS payment profile.');
    } finally {
      setLoadingProfile(false);
    }
  }, [ensName]);

  /* ── Actions ───────────────────────────────────────────────── */
  const handleGenerateQR = () => {
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Amount required', 'Enter an amount to generate the QR code.');
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowQR(true);
  };

  const handleWriteNFC = async () => {
    if (!nfcSupported) {
      Alert.alert('NFC Not Available', 'This device does not support NFC.');
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Amount required', 'Enter an amount before writing NFC tag.');
      return;
    }
    try {
      setNfcWriting(true);
      await NfcManager.requestTechnology(NfcTech.Ndef);
      const bytes = Ndef.encodeMessage([Ndef.textRecord(invoiceUri)]);
      if (bytes) {
        await NfcManager.ndefHandler.writeNdefMessage(bytes);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Success', 'Invoice written to NFC tag!');
      }
    } catch (e: any) {
      if (!e?.message?.includes('cancelled')) {
        Alert.alert('NFC Write Error', e?.message || 'Could not write to NFC tag.');
      }
    } finally {
      NfcManager.cancelTechnologyRequest().catch(() => {});
      setNfcWriting(false);
    }
  };

  /* ── Picker Modal ──────────────────────────────────────────── */
  const renderPickerModal = <T extends { name?: string; symbol?: string; color: string }>(
    visible: boolean,
    onClose: () => void,
    items: T[],
    onSelect: (item: T) => void,
    title: string,
  ) => (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <View style={styles.pickerSheet}>
          <Text style={styles.pickerTitle}>{title}</Text>
          <FlatList
            data={items}
            keyExtractor={(_, i) => String(i)}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.pickerRow}
                onPress={() => {
                  onSelect(item);
                  onClose();
                }}
              >
                <View style={[styles.pickerDot, { backgroundColor: item.color }]} />
                <Text style={styles.pickerRowText}>
                  {'symbol' in item ? `${(item as any).symbol} — ${(item as any).name}` : (item as any).name}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </Pressable>
    </Modal>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
            <MaterialIcons name="arrow-back" size={24} color={C.white} />
          </TouchableOpacity>
          <Text style={styles.title}>Receive</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* ── Merchant Identity Card ──────────────────────────── */}
          {!isConnected ? (
            <TouchableOpacity style={styles.connectCard} activeOpacity={0.7} onPress={() => open()}>
              <MaterialIcons name="account-balance-wallet" size={32} color={C.primary} />
              <Text style={styles.connectTitle}>Connect Wallet</Text>
              <Text style={styles.connectSub}>
                Connect your wallet to create invoices with your ENS identity.
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.merchantCard}>
              <View style={styles.merchantLeft}>
                <View style={{ position: 'relative' }}>
                  {avatarUrl ? (
                    <Image source={{ uri: avatarUrl }} style={styles.merchantAvatar} />
                  ) : (
                    <View style={[styles.merchantAvatar, styles.merchantAvatarPlaceholder]}>
                      <MaterialIcons name="person" size={24} color={C.gray500} />
                    </View>
                  )}
                  {ensName && (
                    <View style={styles.ensBadge}>
                      <Text style={styles.ensBadgeText}>ENS</Text>
                    </View>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.merchantName} numberOfLines={1}>
                    {displayName}
                  </Text>
                  <Text style={styles.merchantAddr}>
                    {displayAddr} · {networkLabel}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.loadProfileBtn}
                onPress={handleLoadProfile}
                disabled={loadingProfile}
              >
                {loadingProfile ? (
                  <ActivityIndicator size="small" color={C.textSecondary} />
                ) : (
                  <Text style={styles.loadProfileText}>
                    {profile ? 'Refresh' : 'Load profile'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* ── Profile info (if loaded) ───────────────────────── */}
          {profile && (
            <View style={styles.profileInfo}>
              <View style={styles.profileRow}>
                <Text style={styles.profileLabel}>Receiver</Text>
                <Text style={styles.profileValue}>{formatAddress(profile.receiver)}</Text>
              </View>
              <View style={styles.profileRow}>
                <Text style={styles.profileLabel}>Chain</Text>
                <Text style={styles.profileValue}>{chainName(profile.chainId)}</Text>
              </View>
              <View style={styles.profileRow}>
                <Text style={styles.profileLabel}>Token</Text>
                <Text style={styles.profileValue}>{formatAddress(profile.token)}</Text>
              </View>
              {profile.slippageBps != null && (
                <View style={styles.profileRow}>
                  <Text style={styles.profileLabel}>Slippage</Text>
                  <Text style={styles.profileValue}>{profile.slippageBps / 100}%</Text>
                </View>
              )}
              {profile.memo != null && (
                <View style={styles.profileRow}>
                  <Text style={styles.profileLabel}>Memo</Text>
                  <Text style={styles.profileValue}>{profile.memo}</Text>
                </View>
              )}
            </View>
          )}

          {/* ── Invoice Creation Card ──────────────────────────── */}
          <View style={styles.invoiceCard}>
            {/* Network + Asset selectors row */}
            <View style={styles.selectorRow}>
              <TouchableOpacity
                style={styles.selectorBtn}
                onPress={() => setShowNetworkPicker(true)}
              >
                <View style={[styles.selectorDot, { backgroundColor: selectedNetwork.color }]} />
                <Text style={styles.selectorLabel}>{selectedNetwork.name}</Text>
                <MaterialIcons name="expand-more" size={16} color={C.textMuted} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.selectorBtn}
                onPress={() => setShowAssetPicker(true)}
              >
                <View style={[styles.selectorDot, { backgroundColor: selectedAsset.color }]} />
                <Text style={styles.selectorLabel}>{selectedAsset.symbol}</Text>
                <MaterialIcons name="expand-more" size={16} color={C.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Amount input */}
            <View style={styles.amountRow}>
              <Text style={styles.dollarSign}>$</Text>
              <TextInput
                style={styles.amountInput}
                value={amount}
                onChangeText={(v) => setAmount(v.replace(/[^0-9.]/g, ''))}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={C.textMuted}
              />
            </View>
            <Text style={styles.conversionHint}>
              {amount && parseFloat(amount) > 0
                ? `${selectedAsset.symbol} on ${selectedNetwork.name}`
                : 'Enter amount'}
            </Text>

            {/* Note */}
            <View style={styles.noteWrap}>
              <MaterialIcons name="edit-note" size={20} color={C.textMuted} style={{ marginLeft: 16 }} />
              <TextInput
                style={styles.noteInput}
                value={note}
                onChangeText={setNote}
                placeholder="Add a note (optional)"
                placeholderTextColor={C.textMuted}
              />
            </View>

            {/* Tip toggle */}
            <View style={styles.tipRow}>
              <MaterialIcons name="savings" size={20} color={C.primary} />
              <Text style={styles.tipLabel}>Enable tip</Text>
              <Switch
                value={tipEnabled}
                onValueChange={setTipEnabled}
                trackColor={{ false: C.inputDark, true: C.primary }}
                thumbColor={C.white}
              />
            </View>
          </View>
        </ScrollView>

        {/* ── Bottom Actions ────────────────────────────────────── */}
        <View style={styles.bottomActions}>
          <TouchableOpacity
            style={[styles.qrBtn, (!isConnected || !amount) && { opacity: 0.5 }]}
            onPress={handleGenerateQR}
            activeOpacity={0.85}
            disabled={!isConnected || !amount}
          >
            <MaterialIcons name="qr-code-2" size={22} color={C.black} />
            <Text style={styles.qrBtnText}>Generate QR</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.nfcBtn, (!isConnected || !amount) && { opacity: 0.5 }]}
            onPress={handleWriteNFC}
            activeOpacity={0.85}
            disabled={nfcWriting || !isConnected || !amount}
          >
            {nfcWriting ? (
              <ActivityIndicator size="small" color={C.white} />
            ) : (
              <MaterialIcons name="contactless" size={22} color={C.white} />
            )}
            <Text style={styles.nfcBtnText}>{nfcWriting ? 'Hold near tag…' : 'Write NFC Tag'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* ── QR Code Modal ───────────────────────────────────────── */}
      <Modal visible={showQR} transparent animationType="fade" onRequestClose={() => setShowQR(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowQR(false)}>
          <View style={styles.qrSheet}>
            <Text style={styles.qrSheetTitle}>Scan to Pay</Text>
            <Text style={styles.qrSheetSub}>
              ${amount} {selectedAsset.symbol} on {selectedNetwork.name}
            </Text>
            <View style={styles.qrContainer}>
              <QRCode
                value={invoiceUri}
                size={220}
                backgroundColor="white"
                color="black"
              />
            </View>
            {ensName && <Text style={styles.qrEns}>{ensName}</Text>}
            <Text style={styles.qrAddr}>{address ? formatAddress(address, 6) : ''}</Text>
            <TouchableOpacity style={styles.qrCloseBtn} onPress={() => setShowQR(false)}>
              <Text style={styles.qrCloseBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* ── Picker Modals ───────────────────────────────────────── */}
      {renderPickerModal(
        showNetworkPicker,
        () => setShowNetworkPicker(false),
        RECEIVE_NETWORKS,
        (n) => setSelectedNetwork(n),
        'Select Network',
      )}
      {renderPickerModal(
        showAssetPicker,
        () => setShowAssetPicker(false),
        ASSETS,
        (a) => setSelectedAsset(a),
        'Select Asset',
      )}
    </SafeAreaView>
  );
}

/* ─── Styles ───────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bgDarkAlt },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: S.lg,
    paddingVertical: S.md,
  },
  title: { fontSize: 20, fontWeight: '700', color: C.white },
  scroll: { paddingHorizontal: S.md, paddingBottom: 200, gap: S.md },

  /* Connect wallet CTA */
  connectCard: {
    backgroundColor: C.cardDark,
    borderRadius: R.xl,
    padding: S.xl,
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: C.primary + '33',
  },
  connectTitle: { fontSize: 18, fontWeight: '700', color: C.white },
  connectSub: { fontSize: 13, color: C.textTertiary, textAlign: 'center', lineHeight: 20 },

  /* Merchant card */
  merchantCard: {
    backgroundColor: C.cardDark,
    borderRadius: R.xl,
    padding: S.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: C.borderLight,
  },
  merchantLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  merchantAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: C.primary + '33',
  },
  merchantAvatarPlaceholder: {
    backgroundColor: C.inputDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ensBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: C.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: R.full,
    borderWidth: 2,
    borderColor: C.bgDarkAlt,
  },
  ensBadgeText: { fontSize: 8, fontWeight: '700', color: C.black },
  merchantName: { fontSize: 17, fontWeight: '700', color: C.white },
  merchantAddr: { fontSize: 11, color: C.textTertiary, marginTop: 2 },
  loadProfileBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: R.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  loadProfileText: { fontSize: 12, fontWeight: '600', color: C.textSecondary },

  /* Profile info */
  profileInfo: {
    backgroundColor: C.cardDark,
    borderRadius: R.xl,
    padding: S.md,
    gap: 8,
    borderWidth: 1,
    borderColor: C.borderLight,
  },
  profileRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  profileLabel: { fontSize: 12, color: C.textTertiary, fontWeight: '500' },
  profileValue: { fontSize: 12, color: C.white, fontWeight: '600' },

  /* Invoice card */
  invoiceCard: {
    backgroundColor: C.cardDark,
    borderRadius: R.xxl,
    padding: S.lg,
    gap: S.md,
    borderWidth: 1,
    borderColor: C.borderLight,
    minHeight: 340,
    justifyContent: 'center',
  },

  /* Selector row (network + asset side by side) */
  selectorRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  selectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.inputDark,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: R.full,
    borderWidth: 1,
    borderColor: C.borderLight,
  },
  selectorDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  selectorLabel: { fontSize: 13, fontWeight: '700', color: C.white },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  dollarSign: { fontSize: 40, fontWeight: '700', color: C.primary },
  amountInput: {
    fontSize: 52,
    fontWeight: '700',
    color: C.white,
    textAlign: 'center',
    minWidth: 120,
    padding: 0,
  },
  conversionHint: { textAlign: 'center', fontSize: 14, color: C.textTertiary },
  noteWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.inputDark,
    borderRadius: R.xl,
    overflow: 'hidden',
  },
  noteInput: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 12,
    fontSize: 14,
    color: C.white,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
  },
  tipLabel: { flex: 1, fontSize: 14, fontWeight: '500', color: C.white },

  /* Bottom actions */
  bottomActions: {
    position: 'absolute',
    bottom: 100,
    left: S.md,
    right: S.md,
    gap: 12,
  },
  qrBtn: {
    height: 56,
    backgroundColor: C.primary,
    borderRadius: R.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  qrBtnText: { fontSize: 16, fontWeight: '700', color: C.black },
  nfcBtn: {
    height: 56,
    backgroundColor: C.cardDark,
    borderRadius: R.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  nfcBtnText: { fontSize: 16, fontWeight: '700', color: C.white },

  /* Modal backdrop */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* QR sheet */
  qrSheet: {
    backgroundColor: C.cardDark,
    borderRadius: R.xxl,
    padding: S.xl,
    alignItems: 'center',
    gap: 12,
    width: '85%',
    maxWidth: 340,
  },
  qrSheetTitle: { fontSize: 20, fontWeight: '700', color: C.white },
  qrSheetSub: { fontSize: 14, color: C.textTertiary },
  qrContainer: {
    padding: 16,
    borderRadius: R.xl,
    backgroundColor: '#FFFFFF',
    marginVertical: 8,
  },
  qrEns: { fontSize: 16, fontWeight: '700', color: C.primary },
  qrAddr: { fontSize: 12, color: C.gray400 },
  qrCloseBtn: {
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 40,
    borderRadius: R.full,
    backgroundColor: C.primary,
  },
  qrCloseBtnText: { fontSize: 14, fontWeight: '700', color: C.black },

  /* Picker sheet */
  pickerSheet: {
    backgroundColor: C.cardDark,
    borderRadius: R.xxl,
    padding: S.lg,
    width: '80%',
    maxWidth: 320,
    maxHeight: 400,
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: C.white,
    marginBottom: 12,
    textAlign: 'center',
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.borderLight,
  },
  pickerDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  pickerRowText: { fontSize: 15, fontWeight: '600', color: C.white },
});
