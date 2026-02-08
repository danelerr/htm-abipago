/**
 * Home Dashboard — main screen showing wallet status, ENS identity,
 * and primary actions (Pay / Receive).
 * Adapted from: stitch/home_dashboard/code.html
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { C, S, R } from '@/constants/theme';
import { useAppKit, useAccount } from '@/services/appkit';
import { resolveName, resolveAvatar, formatAddress } from '@/services/ens';
import { getTokenBalance, getNativeBalance, formatTokenAmount } from '@/services/payrouter';
import {
  PAY_ROUTER_CHAIN_ID,
  NATIVE_ETH,
  getTokensForChain,
  type TokenInfo,
} from '@/constants/contracts';

export default function HomeDashboard() {
  const router = useRouter();
  const { open } = useAppKit();
  const { address, isConnected, chainId } = useAccount();

  const [ensName, setEnsName] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [balances, setBalances] = useState<{ token: TokenInfo; balance: string; raw: bigint }[]>([]);
  const [loadingBalances, setLoadingBalances] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Resolve ENS reverse name + avatar when address changes
  useEffect(() => {
    if (!address) {
      setEnsName(null);
      setAvatarUrl(null);
      return;
    }
    (async () => {
      try {
        const name = await resolveName(address as `0x${string}`);
        setEnsName(name);
        if (name) {
          const avatar = await resolveAvatar(name);
          setAvatarUrl(avatar);
        }
      } catch {
        // ENS resolution may fail silently
      }
    })();
  }, [address]);

  // Fetch token balances on Unichain
  const fetchBalances = useCallback(async () => {
    if (!address) {
      setBalances([]);
      return;
    }
    setLoadingBalances(true);
    try {
      const tokens = getTokensForChain(PAY_ROUTER_CHAIN_ID);
      const results = await Promise.allSettled(
        tokens.map(async (token) => {
          const isNative = token.address.toLowerCase() === NATIVE_ETH.toLowerCase();
          const raw = isNative
            ? await getNativeBalance(address as `0x${string}`)
            : await getTokenBalance(token.address as `0x${string}`, address as `0x${string}`);
          return { token, balance: formatTokenAmount(raw, token.decimals, 4), raw };
        }),
      );
      const resolved = results
        .filter((r): r is PromiseFulfilledResult<{ token: TokenInfo; balance: string; raw: bigint }> => r.status === 'fulfilled')
        .map((r) => r.value)
        .filter((b) => b.raw > 0n); // Only show tokens with balance
      setBalances(resolved);
    } catch (err) {
      console.warn('[home] balance fetch error:', err);
    } finally {
      setLoadingBalances(false);
    }
  }, [address]);

  useEffect(() => { fetchBalances(); }, [fetchBalances]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchBalances();
    setRefreshing(false);
  }, [fetchBalances]);

  const CHAIN_MAP: Record<number, string> = {
    1: 'Ethereum',
    10: 'Optimism',
    130: 'Unichain',
    137: 'Polygon',
    8453: 'Base',
    42161: 'Arbitrum',
  };

  const networkLabel = chainId ? CHAIN_MAP[chainId as number] ?? `#${chainId}` : '—';
  const displayName = ensName ?? (address ? formatAddress(address) : 'Not Connected');
  const displayAddr = address ? formatAddress(address) : '—';

  return (
    <SafeAreaView style={styles.safe}>
      {/* ── Header ──────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Text style={styles.logo}>AbiPago</Text>
        <TouchableOpacity style={styles.iconBtn}>
          <MaterialIcons name="settings" size={24} color={C.gray400} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={C.primary}
            colors={[C.primary]}
          />
        }
      >
        {/* ── Connection Status Card ────────────────────────────── */}
        <TouchableOpacity style={styles.statusCard} activeOpacity={0.7} onPress={() => open()}>
          <View style={styles.statusCol}>
            <View style={styles.statusRow}>
              <MaterialIcons
                name={isConnected ? 'check-circle' : 'error-outline'}
                size={16}
                color={isConnected ? C.success : C.gray500}
              />
              <Text style={[styles.statusVal, { color: isConnected ? C.success : C.gray500 }]}>
                {isConnected ? 'Active' : 'Disconnected'}
              </Text>
            </View>
            <Text style={styles.statusLabel}>Status</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.statusCol}>
            <View style={styles.statusRow}>
              <MaterialIcons name="public" size={16} color={C.blue400} />
              <Text style={[styles.statusVal, { color: C.blue400 }]}>{networkLabel}</Text>
            </View>
            <Text style={styles.statusLabel}>Network</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.statusCol}>
            <View style={styles.statusRow}>
              <MaterialIcons name="account-balance-wallet" size={16} color={C.white} />
              <Text style={styles.statusVal}>{displayAddr}</Text>
            </View>
            <Text style={styles.statusLabel}>Wallet</Text>
          </View>
        </TouchableOpacity>

        {/* ── ENS Identity ──────────────────────────────────────── */}
        <View style={styles.identitySection}>
          <View style={styles.avatarRing}>
            <Image
              source={{ uri: avatarUrl ?? `https://i.pravatar.cc/128?u=${address ?? 'default'}` }}
              style={styles.avatar}
            />
          </View>
          <Text style={styles.ensName}>{displayName}</Text>
          {ensName ? (
            <View style={styles.ensBadge}>
              <View style={styles.ensDot} />
              <Text style={styles.ensBadgeText}>Primary ENS</Text>
            </View>
          ) : !isConnected ? (
            <TouchableOpacity style={styles.ensBadge} onPress={() => open()}>
              <MaterialIcons name="link" size={14} color={C.primary} />
              <Text style={[styles.ensBadgeText, { color: C.primary }]}>Connect Wallet</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* ── Action Buttons ────────────────────────────────────── */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.actionBtn}
            activeOpacity={0.85}
            onPress={() => router.push('/(tabs)/pay')}
          >
            <View style={styles.actionIconWrap}>
              <MaterialIcons
                name="arrow-upward"
                size={32}
                color={C.primaryDark}
                style={{ transform: [{ rotate: '45deg' }] }}
              />
            </View>
            <Text style={styles.actionLabel}>Pay</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            activeOpacity={0.85}
            onPress={() => router.push('/merchant-invoice')}
          >
            <View style={styles.actionIconWrap}>
              <MaterialIcons
                name="arrow-downward"
                size={32}
                color={C.primaryDark}
                style={{ transform: [{ rotate: '45deg' }] }}
              />
            </View>
            <Text style={styles.actionLabel}>Receive</Text>
          </TouchableOpacity>
        </View>

        {/* ── Token Balances ────────────────────────────────────── */}
        {isConnected && (
          <View style={styles.balanceSection}>
            <View style={styles.balanceHeader}>
              <Text style={styles.balanceSectionTitle}>Balances on Unichain</Text>
              {loadingBalances && <ActivityIndicator size="small" color={C.primary} />}
            </View>
            {balances.length === 0 && !loadingBalances ? (
              <View style={styles.emptyBalance}>
                <MaterialIcons name="account-balance-wallet" size={32} color={C.gray700} />
                <Text style={styles.emptyBalanceText}>No tokens found</Text>
              </View>
            ) : (
              balances.map((b) => (
                <View key={b.token.symbol} style={styles.balanceRow}>
                  <View style={[styles.tokenDot, { backgroundColor: b.token.color }]} />
                  <Text style={styles.tokenSymbol}>{b.token.symbol}</Text>
                  <Text style={styles.tokenName}>{b.token.name}</Text>
                  <Text style={styles.tokenBalance}>{b.balance}</Text>
                </View>
              ))
            )}
          </View>
        )}

        {/* ── History link ──────────────────────────────────────── */}
        <TouchableOpacity
          style={styles.historyBtn}
          onPress={() => router.push('/(tabs)/activity')}
        >
          <MaterialIcons name="history" size={20} color={C.gray400} />
          <Text style={styles.historyText}>View Transaction History</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ─── Styles ───────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bgDark },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: S.lg,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: C.borderDark + '80',
  },
  logo: { fontSize: 24, fontWeight: '700', color: C.white, letterSpacing: -0.5 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: R.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { paddingHorizontal: S.lg, paddingTop: S.lg, paddingBottom: 120 },

  statusCard: {
    backgroundColor: C.surfaceDark,
    borderWidth: 1,
    borderColor: C.borderDark,
    borderRadius: R.lg,
    padding: S.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusCol: { flex: 1, alignItems: 'center', gap: 4 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statusVal: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', color: C.white },
  statusLabel: { fontSize: 10, color: C.gray400, fontWeight: '500' },
  divider: { width: 1, height: 32, backgroundColor: C.borderDark + '80' },

  identitySection: { alignItems: 'center', paddingVertical: S.xl },
  avatarRing: {
    width: 128,
    height: 128,
    borderRadius: 64,
    borderWidth: 2,
    borderColor: C.borderDark,
    backgroundColor: C.surfaceDark,
    padding: 4,
  },
  avatar: { width: '100%', height: '100%', borderRadius: 60 },
  ensName: {
    marginTop: 20,
    fontSize: 28,
    fontWeight: '700',
    color: C.white,
    letterSpacing: -0.5,
  },
  ensBadge: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surfaceDark,
    borderWidth: 1,
    borderColor: C.borderDark,
    borderRadius: R.full,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  ensDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.primary, marginRight: 8 },
  ensBadgeText: { fontSize: 13, color: C.gray400, fontWeight: '500' },

  actionsRow: { flexDirection: 'row', gap: S.md, marginTop: S.sm },
  actionBtn: {
    flex: 1,
    height: 130,
    backgroundColor: C.primary,
    borderRadius: R.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(27,33,18,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: { fontSize: 18, fontWeight: '700', color: C.primaryDark },

  balanceSection: {
    marginTop: S.xl,
    backgroundColor: C.surfaceDark,
    borderWidth: 1,
    borderColor: C.borderDark,
    borderRadius: R.lg,
    padding: S.md,
  },
  balanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: S.sm,
  },
  balanceSectionTitle: { fontSize: 15, fontWeight: '700', color: C.white },
  emptyBalance: { alignItems: 'center', paddingVertical: S.lg, gap: 8 },
  emptyBalanceText: { fontSize: 13, color: C.gray400, fontWeight: '500' },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: C.borderDark + '60',
  },
  tokenDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  tokenSymbol: { fontSize: 15, fontWeight: '700', color: C.white, width: 60 },
  tokenName: { flex: 1, fontSize: 13, color: C.gray400, fontWeight: '500' },
  tokenBalance: { fontSize: 15, fontWeight: '600', color: C.white },

  historyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: S.md,
    marginTop: S.md,
  },
  historyText: { fontSize: 13, fontWeight: '600', color: C.gray400 },
});
