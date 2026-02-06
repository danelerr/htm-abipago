/**
 * Profile — Settings & ENS profile screen.
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
import { MaterialIcons } from '@expo/vector-icons';
import { C, S, R } from '@/constants/theme';

const SETTINGS_ITEMS = [
  { icon: 'account-balance-wallet' as const, label: 'Connected Wallet', value: '0xA3…e7' },
  { icon: 'public' as const, label: 'Default Network', value: 'Base' },
  { icon: 'token' as const, label: 'Default Token', value: 'USDC' },
  { icon: 'tune' as const, label: 'Max Slippage', value: '0.5%' },
  { icon: 'notifications' as const, label: 'Notifications', value: 'On' },
];

export default function ProfileScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Profile</Text>

        {/* Avatar + ENS */}
        <View style={styles.profileSection}>
          <Image
            source={{ uri: 'https://i.pravatar.cc/128?u=cafeteria' }}
            style={styles.avatar}
          />
          <Text style={styles.ensName}>cafeteria.eth</Text>
          <Text style={styles.address}>0x84e5cA5c3a19…3a19</Text>
        </View>

        {/* ENS Payment Profile */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>ENS Payment Profile</Text>
          <View style={styles.recordRow}>
            <Text style={styles.recordKey}>pay.receiver</Text>
            <Text style={styles.recordVal}>0x84e5…3a19</Text>
          </View>
          <View style={styles.recordRow}>
            <Text style={styles.recordKey}>pay.chainId</Text>
            <Text style={styles.recordVal}>8453 (Base)</Text>
          </View>
          <View style={styles.recordRow}>
            <Text style={styles.recordKey}>pay.token</Text>
            <Text style={styles.recordVal}>USDC</Text>
          </View>
          <View style={styles.recordRow}>
            <Text style={styles.recordKey}>pay.slippageBps</Text>
            <Text style={styles.recordVal}>50 (0.5%)</Text>
          </View>
          <View style={styles.recordRow}>
            <Text style={styles.recordKey}>pay.memo</Text>
            <Text style={styles.recordVal}>Cafetería SCZ</Text>
          </View>
        </View>

        {/* Settings */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Settings</Text>
          {SETTINGS_ITEMS.map((item) => (
            <TouchableOpacity key={item.label} style={styles.settingRow}>
              <MaterialIcons name={item.icon} size={20} color={C.gray400} />
              <Text style={styles.settingLabel}>{item.label}</Text>
              <Text style={styles.settingVal}>{item.value}</Text>
              <MaterialIcons name="chevron-right" size={20} color={C.gray700} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Connect / Disconnect */}
        <TouchableOpacity style={styles.connectBtn}>
          <MaterialIcons name="link" size={20} color={C.primary} />
          <Text style={styles.connectText}>Connect Wallet (WalletConnect)</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bgDark },
  scroll: { paddingHorizontal: S.lg, paddingBottom: 120 },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: C.white,
    paddingTop: 20,
    paddingBottom: S.md,
  },

  /* Profile */
  profileSection: { alignItems: 'center', paddingVertical: S.xl },
  avatar: { width: 80, height: 80, borderRadius: 40, borderWidth: 2, borderColor: C.primary + '40' },
  ensName: { fontSize: 22, fontWeight: '700', color: C.white, marginTop: 12 },
  address: { fontSize: 12, color: C.gray500, marginTop: 4 },

  /* Cards */
  card: {
    backgroundColor: C.cardDark,
    borderRadius: R.lg,
    padding: S.md,
    marginBottom: S.md,
    borderWidth: 1,
    borderColor: C.borderLight,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: C.gray400,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  recordRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.borderLight,
  },
  recordKey: { fontSize: 13, color: C.textTertiary, fontFamily: 'monospace' },
  recordVal: { fontSize: 13, color: C.white, fontWeight: '500' },

  /* Settings */
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.borderLight,
  },
  settingLabel: { flex: 1, fontSize: 14, color: C.white },
  settingVal: { fontSize: 13, color: C.gray400, marginRight: 4 },

  /* Connect btn */
  connectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: R.full,
    borderWidth: 1,
    borderColor: C.primary + '40',
    marginTop: S.sm,
  },
  connectText: { fontSize: 14, fontWeight: '600', color: C.primary },
});
