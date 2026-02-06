/**
 * Routing Progress — step-by-step payment processing indicator.
 * Adapted from: stitch/routing_progress_stepper/code.html
 */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { C, S, R } from '@/constants/theme';
import type { StepInfo } from '@/types';

const INITIAL_STEPS: StepInfo[] = [
  { id: 'preparing', title: 'Preparing route', subtitle: 'Route found via LI.FI', status: 'completed' },
  { id: 'swapping', title: 'Swapping / Bridging', subtitle: 'Estimated time: ~2 mins', status: 'in-progress' },
  { id: 'settling', title: 'Settling on destination', subtitle: 'Pending confirmation', status: 'pending' },
  { id: 'completed', title: 'Payment sent', subtitle: 'Pending', status: 'pending' },
];

export default function RoutingProgressScreen() {
  const router = useRouter();
  const [steps, setSteps] = useState<StepInfo[]>(INITIAL_STEPS);

  // Simulate progress for demo
  useEffect(() => {
    const t1 = setTimeout(() => {
      setSteps((prev) =>
        prev.map((s) => {
          if (s.id === 'swapping') return { ...s, status: 'completed', subtitle: 'Bridge complete' };
          if (s.id === 'settling') return { ...s, status: 'in-progress', subtitle: 'Confirming on Base...' };
          return s;
        }),
      );
    }, 4000);

    const t2 = setTimeout(() => {
      setSteps((prev) =>
        prev.map((s) => {
          if (s.id === 'settling') return { ...s, status: 'completed', subtitle: 'Settlement confirmed' };
          if (s.id === 'completed') return { ...s, status: 'completed', subtitle: 'Payment delivered' };
          return s;
        }),
      );
    }, 7000);

    const t3 = setTimeout(() => {
      router.replace('/payment-success');
    }, 8500);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  const allDone = steps.every((s) => s.status === 'completed');

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={C.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Processing Payment</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Stepper */}
      <View style={styles.stepperWrap}>
        {steps.map((step, i) => {
          const isLast = i === steps.length - 1;
          return (
            <View key={step.id} style={styles.stepRow}>
              {/* Left: icon + line */}
              <View style={styles.stepLeft}>
                {step.status === 'completed' ? (
                  <View style={styles.stepDone}>
                    <MaterialIcons name="check" size={18} color={C.primaryDark} />
                  </View>
                ) : step.status === 'in-progress' ? (
                  <View style={styles.stepActive}>
                    <ActivityIndicator size="small" color={C.primary} />
                  </View>
                ) : (
                  <View style={styles.stepPending}>
                    <View style={styles.pendingDot} />
                  </View>
                )}
                {!isLast && (
                  <View
                    style={[
                      styles.stepLine,
                      step.status === 'completed' && { backgroundColor: C.primary },
                    ]}
                  />
                )}
              </View>

              {/* Right: content */}
              <View style={[styles.stepContent, step.status === 'pending' && { opacity: 0.4 }]}>
                <Text style={styles.stepTitle}>{step.title}</Text>
                <Text
                  style={[
                    styles.stepSub,
                    step.status === 'completed' && { color: C.primary },
                    step.status === 'in-progress' && { color: C.primary + 'CC' },
                  ]}
                >
                  {step.subtitle}
                </Text>

                {/* Bridge detail box (only for swapping step in-progress) */}
                {step.id === 'swapping' && step.status === 'in-progress' && (
                  <View style={styles.detailBox}>
                    <View style={styles.detailIcon}>
                      <MaterialIcons name="swap-horiz" size={18} color={C.blue400} />
                    </View>
                    <View>
                      <Text style={styles.detailLabel}>Bridge</Text>
                      <Text style={styles.detailVal}>
                        Arbitrum <Text style={{ color: C.gray500 }}>→</Text> Base
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            </View>
          );
        })}
      </View>

      {/* Bottom section */}
      <View style={styles.bottom}>
        {/* Status card */}
        <View style={styles.statusCard}>
          <View>
            <Text style={styles.statusTitle}>
              {allDone ? 'Payment complete!' : 'Bridging via LI.FI...'}
            </Text>
            <Text style={styles.statusSub}>
              {allDone ? 'Redirecting...' : 'Finding best rates & routes'}
            </Text>
          </View>
        </View>

        {/* Disabled button */}
        <View style={styles.processingBtn}>
          {!allDone && <ActivityIndicator size="small" color={C.textTertiary} />}
          <Text style={styles.processingText}>
            {allDone ? 'Complete ✓' : 'Processing...'}
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

/* ─── Styles ───────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bgDarkAlt },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: S.md,
    paddingVertical: S.md,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: C.white },

  /* Stepper */
  stepperWrap: { flex: 1, paddingHorizontal: S.lg, paddingTop: S.xl },

  stepRow: { flexDirection: 'row' },
  stepLeft: { alignItems: 'center', width: 32, marginRight: S.md },

  stepDone: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center',
    shadowColor: C.primary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 10,
  },
  stepActive: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: C.bgDarkAlt, borderWidth: 2, borderColor: C.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  stepPending: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: C.bgDarkAlt, borderWidth: 1, borderColor: C.gray700,
    alignItems: 'center', justifyContent: 'center',
  },
  pendingDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.gray700 },

  stepLine: {
    width: 2, flex: 1, minHeight: 24,
    backgroundColor: C.gray700, marginVertical: 4, borderRadius: 1,
  },

  stepContent: { flex: 1, paddingBottom: 28, paddingTop: 4 },
  stepTitle: { fontSize: 15, fontWeight: '600', color: C.white },
  stepSub: { fontSize: 13, color: C.gray500, marginTop: 4 },

  detailBox: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: C.borderLight,
    borderRadius: R.xl, padding: 12, marginTop: 12,
  },
  detailIcon: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: C.blue500 + '33', alignItems: 'center', justifyContent: 'center',
  },
  detailLabel: { fontSize: 10, color: C.gray400, textTransform: 'uppercase', letterSpacing: 1 },
  detailVal: { fontSize: 13, fontWeight: '500', color: C.white, marginTop: 2 },

  /* Bottom */
  bottom: { padding: S.lg, gap: S.md },

  statusCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#2A3022', borderWidth: 1, borderColor: '#3F4A30',
    borderRadius: R.xl, padding: S.md,
  },
  statusTitle: { fontSize: 14, fontWeight: '700', color: C.white },
  statusSub: { fontSize: 12, color: C.gray400, marginTop: 2 },

  processingBtn: {
    height: 56, borderRadius: R.full,
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: C.borderLight,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12,
  },
  processingText: { fontSize: 15, fontWeight: '700', color: C.textTertiary },
});
