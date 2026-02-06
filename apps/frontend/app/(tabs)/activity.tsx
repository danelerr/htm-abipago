/**
 * Activity — Transaction history placeholder.
 */
import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { C, S, R } from '@/constants/theme';

interface TxItem {
  id: string;
  label: string;
  ens: string;
  amount: string;
  token: string;
  date: string;
  direction: 'sent' | 'received';
}

const MOCK_TXS: TxItem[] = [
  { id: '1', label: 'Coffee', ens: 'cafeteria.eth', amount: '3.50', token: 'USDC', date: 'Today, 09:41', direction: 'sent' },
  { id: '2', label: 'Lunch', ens: 'resto.eth', amount: '12.00', token: 'USDC', date: 'Yesterday', direction: 'sent' },
  { id: '3', label: 'Payment received', ens: 'alice.eth', amount: '25.00', token: 'USDC', date: 'Feb 4', direction: 'received' },
];

export default function ActivityScreen() {
  const renderItem = ({ item }: { item: TxItem }) => (
    <View style={styles.txRow}>
      <View style={[styles.txIcon, { backgroundColor: item.direction === 'sent' ? C.error + '20' : C.success + '20' }]}>
        <MaterialIcons
          name={item.direction === 'sent' ? 'arrow-upward' : 'arrow-downward'}
          size={20}
          color={item.direction === 'sent' ? C.error : C.success}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.txLabel}>{item.label}</Text>
        <Text style={styles.txEns}>{item.ens}</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={styles.txAmount}>
          {item.direction === 'sent' ? '-' : '+'}{item.amount} {item.token}
        </Text>
        <Text style={styles.txDate}>{item.date}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <Text style={styles.title}>Activity</Text>
      <FlatList
        data={MOCK_TXS}
        keyExtractor={(i) => i.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialIcons name="receipt-long" size={48} color={C.gray700} />
            <Text style={styles.emptyText}>No transactions yet</Text>
          </View>
        }
      />
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
