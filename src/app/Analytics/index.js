import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadow } from '../../theme';
import {
  subscribeToAuth,
  getCurrentUser,
  subscribeToScreenings,
  subscribeToPigs,
  getScreeningAnalytics,
} from '../../services/FirebaseService';

function StatCard({ icon, label, value, tint }) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: `${tint}18` }]}>
        <Ionicons name={icon} size={18} color={tint} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function Analytics() {
  const router = useRouter();
  const [user, setUser] = useState(getCurrentUser());
  const [screenings, setScreenings] = useState([]);
  const [pigs, setPigs] = useState([]);

  useEffect(() => {
    const unsubAuth = subscribeToAuth(setUser);
    const unsubScreenings = subscribeToScreenings(setScreenings);
    const unsubPigs = subscribeToPigs(setPigs);
    return () => {
      unsubAuth?.();
      unsubScreenings?.();
      unsubPigs?.();
    };
  }, []);

  const analytics = useMemo(() => getScreeningAnalytics(screenings, pigs), [screenings, pigs]);
  const maxTrend = Math.max(1, ...analytics.monthlyTrends.map((t) => t.count));
  const maxDisease = Math.max(1, ...analytics.diseaseDistribution.map((d) => d.count));

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.back} onPress={goBack}>
          <Ionicons name="chevron-back" size={20} color={colors.primary} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Analytics</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.eyebrow}>DASHBOARD</Text>
        <Text style={styles.title}>Screening analytics</Text>
        <Text style={styles.subtitle}>
          Overview of total screenings, pig health, disease distribution, and screening trends.
        </Text>

        {!user && (
          <View style={styles.notice}>
            <Ionicons name="phone-portrait-outline" size={15} color={colors.primary} />
            <Text style={styles.noticeText}>
              Showing analytics from records stored on this device. Sign in to sync and aggregate cloud records.
            </Text>
          </View>
        )}

        <View style={styles.grid}>
          <StatCard icon="scan-outline" label="Total screenings" value={analytics.totalScreenings} tint={colors.primary} />
          <StatCard icon="leaf-outline" label="Healthy pigs" value={analytics.healthyPigs} tint={colors.healthy} />
          <StatCard icon="alert-circle-outline" label="Suspected cases" value={analytics.suspectedCases} tint={colors.danger} />
          <StatCard icon="paw-outline" label="Pigs with concern" value={analytics.suspectedPigs} tint={colors.warning} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Disease distribution</Text>
          {analytics.diseaseDistribution.length === 0 ? (
            <Text style={styles.empty}>No screening data yet. Run and save screenings to see distribution.</Text>
          ) : (
            analytics.diseaseDistribution
              .sort((a, b) => b.count - a.count)
              .map((item) => (
                <View key={item.label} style={styles.barRow}>
                  <View style={styles.barHeader}>
                    <Text style={styles.barLabel} numberOfLines={1}>{item.label}</Text>
                    <Text style={styles.barValue}>{item.count}</Text>
                  </View>
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, { width: `${(item.count / maxDisease) * 100}%` }]} />
                  </View>
                </View>
              ))
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Monthly screening trends</Text>
          {analytics.monthlyTrends.length === 0 ? (
            <Text style={styles.empty}>No monthly trend data yet.</Text>
          ) : (
            <View style={styles.trendWrap}>
              {analytics.monthlyTrends.map((item) => (
                <View key={item.month} style={styles.trendCol}>
                  <View style={styles.trendBarArea}>
                    <View style={[styles.trendBar, { height: `${Math.max(8, (item.count / maxTrend) * 100)}%` }]} />
                  </View>
                  <Text style={styles.trendCount}>{item.count}</Text>
                  <Text style={styles.trendMonth} numberOfLines={1}>{item.month}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Summary</Text>
          <Text style={styles.summaryText}>Healthy screening results: {analytics.healthyScreenings}</Text>
          <Text style={styles.summaryText}>Suspected screening cases: {analytics.suspectedCases}</Text>
          <Text style={styles.summaryText}>Tracked pigs: {pigs.length}</Text>
          <Text style={styles.summaryNote}>
            Suspected cases are screenings predicted as Exudative Epidermitis, Sarcoptic Mange, or Swine Pox. Pig health status updates after linked screenings.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  back: { width: 70, flexDirection: 'row', alignItems: 'center' },
  backText: { marginLeft: 2, fontSize: 12.5, fontWeight: '700', color: colors.primary },
  headerTitle: { fontSize: 15, fontWeight: '900', color: colors.text },
  headerSpacer: { width: 70 },
  content: { padding: 18, paddingBottom: 36 },
  eyebrow: { fontSize: 9.5, fontWeight: '800', letterSpacing: 1.2, color: colors.accent },
  title: { marginTop: 4, fontSize: 24, fontWeight: '900', color: colors.text },
  subtitle: { marginTop: 6, fontSize: 12.5, lineHeight: 19, color: colors.textMuted },
  notice: { marginTop: 14, flexDirection: 'row', gap: 8, backgroundColor: colors.light, borderRadius: radius.md, padding: 12 },
  noticeText: { flex: 1, fontSize: 10.5, lineHeight: 15, color: colors.primary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 14 },
  statCard: { width: '48.5%', backgroundColor: colors.white, borderRadius: radius.lg, padding: 14, marginBottom: 10, ...shadow.card },
  statIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  statValue: { marginTop: 10, fontSize: 22, fontWeight: '900', color: colors.text },
  statLabel: { marginTop: 2, fontSize: 10.5, color: colors.textMuted, fontWeight: '700' },
  card: { marginTop: 12, backgroundColor: colors.white, borderRadius: radius.lg, padding: 15, ...shadow.card },
  cardTitle: { fontSize: 14.5, fontWeight: '900', color: colors.text, marginBottom: 10 },
  empty: { fontSize: 11.5, lineHeight: 17, color: colors.textMuted },
  barRow: { marginBottom: 10 },
  barHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  barLabel: { flex: 1, fontSize: 11, fontWeight: '700', color: colors.text, marginRight: 8 },
  barValue: { fontSize: 11, fontWeight: '900', color: colors.primary },
  barTrack: { height: 8, borderRadius: 999, backgroundColor: colors.light, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 999, backgroundColor: colors.accent },
  trendWrap: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, minHeight: 150 },
  trendCol: { flex: 1, alignItems: 'center' },
  trendBarArea: { height: 90, width: '100%', justifyContent: 'flex-end', alignItems: 'center' },
  trendBar: { width: '70%', borderRadius: 8, backgroundColor: colors.primary },
  trendCount: { marginTop: 6, fontSize: 10, fontWeight: '800', color: colors.text },
  trendMonth: { marginTop: 2, fontSize: 9, color: colors.textSoft },
  summaryText: { fontSize: 11.5, color: colors.text, marginBottom: 4, fontWeight: '600' },
  summaryNote: { marginTop: 8, fontSize: 10.5, lineHeight: 15, color: colors.textMuted },
});
