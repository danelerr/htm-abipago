/**
 * Merchant Create Invoice — amount input, note, generate QR or write NFC.
 * Adapted from: stitch/merchant_create_invoice/code.html
 */
import React, { useState } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { C, S, R } from '@/constants/theme';

export default function MerchantInvoiceScreen() {
  const router = useRouter();
  const [amount, setAmount] = useState('15.00');
  const [note, setNote] = useState('');
  const [tipEnabled, setTipEnabled] = useState(false);

  const handleGenerateQR = () => {
    // TODO: generate QR with abipago:// deep link
    Alert.alert(
      'Invoice QR',
      `abipago://pay?ens=cafeteria.eth&amount=${amount}&ref=${note || 'inv-' + Date.now()}&assetHint=USDC`,
    );
  };

  const handleWriteNFC = () => {
    // TODO: write NDEF tag using react-native-nfc-manager
    Alert.alert('NFC', 'NFC write – requires native build with react-native-nfc-manager');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Receive</Text>
          <TouchableOpacity style={styles.iconBtn}>
            <MaterialIcons name="notifications" size={24} color={C.textTertiary} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* ── Merchant Identity Card ──────────────────────────── */}
          <View style={styles.merchantCard}>
            <View style={styles.merchantLeft}>
              <View style={{ position: 'relative' }}>
                <Image
                  source={{ uri: 'https://i.pravatar.cc/64?u=cafeteria' }}
                  style={styles.merchantAvatar}
                />
                <View style={styles.ensBadge}>
                  <Text style={styles.ensBadgeText}>ENS</Text>
                </View>
              </View>
              <View>
                <Text style={styles.merchantName}>cafeteria.eth</Text>
                <Text style={styles.merchantAddr}>0x84…3a19</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.loadProfileBtn}>
              <Text style={styles.loadProfileText}>Load profile</Text>
            </TouchableOpacity>
          </View>

          {/* ── Invoice Creation Card ──────────────────────────── */}
          <View style={styles.invoiceCard}>
            {/* Currency selector */}
            <View style={{ alignItems: 'center' }}>
              <TouchableOpacity style={styles.currencyBtn}>
                <View style={styles.currencyDot} />
                <Text style={styles.currencyLabel}>USD</Text>
                <MaterialIcons name="expand-more" size={18} color={C.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Amount input */}
            <View style={styles.amountRow}>
              <Text style={styles.dollarSign}>$</Text>
              <TextInput
                style={styles.amountInput}
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={C.textMuted}
              />
            </View>
            <Text style={styles.conversionHint}>≈ 0.0042 ETH</Text>

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
          <TouchableOpacity style={styles.qrBtn} onPress={handleGenerateQR} activeOpacity={0.85}>
            <MaterialIcons name="qr-code-2" size={22} color={C.black} />
            <Text style={styles.qrBtnText}>Generate QR</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.nfcBtn} onPress={handleWriteNFC} activeOpacity={0.85}>
            <MaterialIcons name="contactless" size={22} color={C.white} />
            <Text style={styles.nfcBtnText}>Write NFC Tag</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
  title: { fontSize: 24, fontWeight: '700', color: C.white },
  iconBtn: { padding: 8, borderRadius: R.full },
  scroll: { paddingHorizontal: S.md, paddingBottom: 200, gap: S.md },

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
  merchantLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  merchantAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: C.primary + '33',
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
  currencyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.inputDark,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: R.full,
    borderWidth: 1,
    borderColor: C.borderLight,
  },
  currencyDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: C.blue500,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currencyLabel: { fontSize: 14, fontWeight: '700', color: C.white },
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
});
