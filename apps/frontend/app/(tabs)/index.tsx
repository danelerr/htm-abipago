/**
 * Home Dashboard — main screen showing wallet status, ENS identity,
 * and primary actions (Pay / Receive).
 * Adapted from: stitch/home_dashboard/code.html
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
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { C, S, R } from '@/constants/theme';

export default function HomeDashboard() {
  const router = useRouter();

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
      >
        {/* ── Connection Status Card ────────────────────────────── */}
        <View style={styles.statusCard}>
          <View style={styles.statusCol}>
            <View style={styles.statusRow}>
              <MaterialIcons name="check-circle" size={16} color={C.success} />
              <Text style={[styles.statusVal, { color: C.success }]}>Active</Text>
            </View>
            <Text style={styles.statusLabel}>Status</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.statusCol}>
            <View style={styles.statusRow}>
              <MaterialIcons name="public" size={16} color={C.blue400} />
              <Text style={[styles.statusVal, { color: C.blue400 }]}>Base</Text>
            </View>
            <Text style={styles.statusLabel}>Network</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.statusCol}>
            <View style={styles.statusRow}>
              <MaterialIcons name="account-balance-wallet" size={16} color={C.white} />
              <Text style={styles.statusVal}>0xA3…e7</Text>
            </View>
            <Text style={styles.statusLabel}>Wallet</Text>
          </View>
        </View>

        {/* ── ENS Identity ──────────────────────────────────────── */}
        <View style={styles.identitySection}>
          <View style={styles.avatarRing}>
            <Image
              source={{ uri: 'https://i.pravatar.cc/128?u=cafeteria' }}
              style={styles.avatar}
            />
          </View>
          <Text style={styles.ensName}>cafeteria.eth</Text>
          <View style={styles.ensBadge}>
            <View style={styles.ensDot} />
            <Text style={styles.ensBadgeText}>Primary ENS</Text>
          </View>
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
