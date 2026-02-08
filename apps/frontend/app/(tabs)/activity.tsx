/**
 * Activity — On-chain transaction history from PayRouter events.
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { C, S, R } from '@/constants/theme';
import { useAccount } from '@/services/appkit';
import {
  getPaymentHistory,
  PaymentEvent,
  formatTokenAmount,
} from '@/services/payrouter';
import {
  getTokenByAddress,
  PAY_ROUTER_CHAIN_ID,
  NATIVE_ETH,
} from '@/constants/contracts';
import { formatAddress } from '@/services/ens';

/* ── helpers ──────────────────────────────────────────────── */

function resolveTokenSymbol(tokenAddr: string): string {
  const info = getTokenByAddress(PAY_ROUTER_CHAIN_ID, tokenAddr);
  return info?.symbol ?? 'TOKEN';
}

function resolveTokenDecimals(tokenAddr: string): number {
  const info = getTokenByAddress(PAY_ROUTER_CHAIN_ID, tokenAddr);
  return info?.decimals ?? 18;
}

function formatTimestamp(ts: bigint): string {
  const date = new Date(Number(ts) * 1000);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffDays === 0) {
    return `Today, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

/* ── component ────────────────────────────────────────────── */

export default function ActivityScreen() {
  const { address, isConnected } = useAccount();
  const [events, setEvents] = useState<PaymentEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchHistory = useCallback(async () => {
    if (!address) {
      setEvents([]);
      return;
    }
    try {
      setLoading(true);
      const history = await getPaymentHistory(address as `0x${string}`);
      setEvents(history);
    } catch (err) {
      console.warn('Failed to fetch payment history:', err);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchHistory();
    setRefreshing(false);
  }, [fetchHistory]);

  const renderItem = ({ item }: { item: PaymentEvent }) => {
    const isSent = item.direction === 'sent';
    const tokenAddr = isSent ? item.tokenIn : item.tokenOut;
    const rawAmount = isSent ? item.amountIn : item.amountOut;
    const symbol = resolveTokenSymbol(tokenAddr);
    const decimals = resolveTokenDecimals(tokenAddr);
    const amount = formatTokenAmount(rawAmount, decimals);
    const counterparty = isSent ? item.receiver : item.payer;

    return (
      <View style={styles.txRow}>
        <View
          style={[
            styles.txIcon,
            { backgroundColor: isSent ? C.error + '20' : C.success + '20' },
          ]}
        >
          <MaterialIcons
            name={isSent ? 'arrow-upward' : 'arrow-downward'}
            size={20}
            color={isSent ? C.error : C.success}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.txLabel}>{isSent ? 'Sent' : 'Received'}</Text>
          <Text style={styles.txEns}>{formatAddress(counterparty)}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.txAmount}>
            {isSent ? '-' : '+'}
            {amount} {symbol}
          </Text>
          <Text style={styles.txDate}>{formatTimestamp(item.timestamp)}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <Text style={styles.title}>Activity</Text>

      {!isConnected ? (
        <View style={styles.empty}>
          <MaterialIcons name="account-balance-wallet" size={48} color={C.gray700} />
          <Text style={styles.emptyText}>Connect wallet to see history</Text>
        </View>
      ) : loading && events.length === 0 ? (
        <View style={styles.empty}>
          <ActivityIndicator size="large" color={C.primary} />
          <Text style={styles.emptyText}>Loading history…</Text>
        </View>
      ) : (
        <FlatList
          data={events}
          keyExtractor={(e) => `${e.txHash}-${e.direction}`}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={C.primary}
              colors={[C.primary]}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialIcons name="receipt-long" size={48} color={C.gray700} />
              <Text style={styles.emptyText}>No transactions yet</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bgDark },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: C.white,
    paddingHorizontal: S.lg,
    paddingTop: 20,
    paddingBottom: S.md,
  },
  list: { paddingHorizontal: S.lg, paddingBottom: 100 },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: S.md,
  },
  txIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txLabel: { fontSize: 15, fontWeight: '600', color: C.white },
  txEns: { fontSize: 12, color: C.gray400, marginTop: 2 },
  txAmount: { fontSize: 15, fontWeight: '600', color: C.white },
  txDate: { fontSize: 11, color: C.gray500, marginTop: 2 },
  sep: { height: 1, backgroundColor: C.borderDark + '60' },
  empty: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 15, color: C.gray500 },
});
