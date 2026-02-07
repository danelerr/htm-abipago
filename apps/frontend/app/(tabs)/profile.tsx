/**
 * Profile — Settings & ENS profile screen.
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
import { MaterialIcons } from '@expo/vector-icons';
import { C, S, R } from '@/constants/theme';
import { useAppKit, useAccount } from '@/services/appkit';
import {
  resolveName,
  resolveAvatar,
  getPaymentProfile,
  formatAddress,
  chainName,
} from '@/services/ens';
import type { PaymentProfile } from '@/types';

export default function ProfileScreen() {
  const { open } = useAppKit();
  const { address, isConnected, chainId } = useAccount();

  const [ensName, setEnsName] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [payProfile, setPayProfile] = useState<PaymentProfile | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!address) {
      setEnsName(null);
      setAvatarUrl(null);
      setPayProfile(null);
      return;
    }
    (async () => {
      setLoading(true);
      try {
        const name = await resolveName(address as `0x${string}`);
        setEnsName(name);
        if (name) {
          const [avatar, profile] = await Promise.all([
            resolveAvatar(name),
            getPaymentProfile(name),
          ]);
          setAvatarUrl(avatar);
          setPayProfile(profile);
        }
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    })();
  }, [address]);

  const displayAddr = address ? formatAddress(address) : '—';
  const networkLabel = chainId ? chainName(chainId) : '—';

  const SETTINGS_ITEMS = [
    { icon: 'account-balance-wallet' as const, label: 'Connected Wallet', value: displayAddr },
    { icon: 'public' as const, label: 'Default Network', value: networkLabel },
    { icon: 'token' as const, label: 'Default Token', value: 'USDC' },
    { icon: 'tune' as const, label: 'Max Slippage', value: `${(payProfile?.slippageBps ?? 50) / 100}%` },
    { icon: 'notifications' as const, label: 'Notifications', value: 'On' },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Profile</Text>

        {/* Avatar + ENS */}
        <View style={styles.profileSection}>
          <Image
            source={{ uri: avatarUrl ?? `https://i.pravatar.cc/128?u=${address ?? 'default'}` }}
            style={styles.avatar}
          />
          <Text style={styles.ensName}>{ensName ?? (isConnected ? displayAddr : 'Not Connected')}</Text>
          <Text style={styles.address}>{isConnected ? displayAddr : 'Connect a wallet to get started'}</Text>
        </View>

        {/* ENS Payment Profile */}
        {loading ? (
          <View style={[styles.card, { alignItems: 'center', paddingVertical: 24 }]}>
            <ActivityIndicator color={C.primary} />
            <Text style={[styles.cardTitle, { marginTop: 8, marginBottom: 0 }]}>Loading ENS profile…</Text>
          </View>
        ) : payProfile ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>ENS Payment Profile</Text>
            <View style={styles.recordRow}>
              <Text style={styles.recordKey}>pay.receiver</Text>
              <Text style={styles.recordVal}>{formatAddress(payProfile.receiver)}</Text>
            </View>
            <View style={styles.recordRow}>
              <Text style={styles.recordKey}>pay.chainId</Text>
              <Text style={styles.recordVal}>{payProfile.chainId} ({chainName(payProfile.chainId)})</Text>
            </View>
            <View style={styles.recordRow}>
              <Text style={styles.recordKey}>pay.token</Text>
              <Text style={styles.recordVal}>{formatAddress(payProfile.token)}</Text>
            </View>
            {payProfile.slippageBps !== undefined && (
              <View style={styles.recordRow}>
                <Text style={styles.recordKey}>pay.slippageBps</Text>
                <Text style={styles.recordVal}>{payProfile.slippageBps} ({payProfile.slippageBps / 100}%)</Text>
              </View>
            )}
            {payProfile.memo && (
              <View style={styles.recordRow}>
                <Text style={styles.recordKey}>pay.memo</Text>
                <Text style={styles.recordVal}>{payProfile.memo}</Text>
              </View>
            )}
          </View>
        ) : isConnected && ensName ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>ENS Payment Profile</Text>
            <Text style={{ color: C.textTertiary, fontSize: 13, textAlign: 'center', paddingVertical: 12 }}>
              No AbiPago payment records found for {ensName}
            </Text>
          </View>
        ) : null}

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
        <TouchableOpacity style={styles.connectBtn} onPress={() => open()}>
          <MaterialIcons name="link" size={20} color={C.primary} />
          <Text style={styles.connectText}>
            {isConnected ? 'Wallet Options' : 'Connect Wallet (WalletConnect)'}
          </Text>
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
