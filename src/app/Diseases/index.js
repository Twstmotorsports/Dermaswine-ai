import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadow, severityColor } from '../../theme';
import { FEATURED_CONDITIONS } from '../../services/YOLOService';

const severityLabel = (severity) => {
  switch (severity) {
    case 'none':
      return 'Healthy reference';
    case 'high':
      return 'High concern';
    case 'medium':
      return 'Moderate concern';
    default:
      return 'Reference';
  }
};

export default function Diseases() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.back} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}>
          <Ionicons name="chevron-back" size={20} color={colors.primary} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Diseases</Text>
        <View style={styles.headerSpacer} />
      </View>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.eyebrow}>DISEASE INFORMATION</Text>
        <Text style={styles.title}>Conditions DermaSwine AI screens</Text>
        <Text style={styles.subtitle}>
          The model is trained on 4 classes: Healthy skin and three common swine skin diseases
          (Exudative Epidermitis, Sarcoptic Mange, and Swine Pox). Tap a condition for full guidance.
        </Text>

        {FEATURED_CONDITIONS.map((condition) => (
          <TouchableOpacity
            key={condition.id}
            style={styles.card}
            activeOpacity={0.85}
            onPress={() => router.push(`/disease/${condition.id}`)}
          >
            <View style={styles.cardTop}>
              <View style={[styles.iconWrap, { backgroundColor: `${severityColor(condition.severity)}18` }]}>
                <Ionicons
                  name={condition.severity === 'none' ? 'leaf-outline' : 'alert-circle-outline'}
                  size={22}
                  color={severityColor(condition.severity)}
                />
              </View>
              <View style={styles.cardTitleWrap}>
                <Text style={styles.cardTitle}>{condition.title}</Text>
                <Text style={[styles.cardSeverity, { color: severityColor(condition.severity) }]}>
                  {severityLabel(condition.severity)}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textSoft} />
            </View>

            <Text style={styles.cardSummary} numberOfLines={3}>{condition.summary}</Text>

            <View style={styles.cardFooter}>
              <View style={styles.tag}>
                <Text style={styles.tagText}>{condition.id === 'healthy' ? 'Baseline class' : 'Screened disease'}</Text>
              </View>
              <Text style={styles.detailLink}>View guidance</Text>
            </View>
          </TouchableOpacity>
        ))}

        <View style={styles.notice}>
          <Ionicons name="information-circle-outline" size={16} color={colors.primary} />
          <Text style={styles.noticeText}>
            Treatment and biosecurity guidance is general reference material. Always confirm diagnosis and medication with a licensed veterinarian.
          </Text>
        </View>

        <TouchableOpacity style={styles.cta} activeOpacity={0.85} onPress={() => router.push('/detect')}>
          <Ionicons name="scan-outline" size={17} color={colors.white} />
          <Text style={styles.ctaText}>Screen an Image</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  back: { width: 70, flexDirection: 'row', alignItems: 'center' },
  backText: { marginLeft: 2, fontSize: 12.5, fontWeight: '700', color: colors.primary },
  headerTitle: { fontSize: 15, fontWeight: '900', color: colors.text },
  headerSpacer: { width: 70 },
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 18, paddingBottom: 32 },
  eyebrow: { fontSize: 9.5, fontWeight: '800', letterSpacing: 1.2, color: colors.accent },
  title: { marginTop: 4, fontSize: 23, fontWeight: '900', color: colors.text },
  subtitle: { marginTop: 6, marginBottom: 6, fontSize: 12.5, lineHeight: 19, color: colors.textMuted },
  card: { backgroundColor: colors.white, borderRadius: radius.lg, padding: 15, marginTop: 12, ...shadow.card },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  iconWrap: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  cardTitleWrap: { flex: 1, marginLeft: 11 },
  cardTitle: { fontSize: 14.5, fontWeight: '800', color: colors.text },
  cardSeverity: { marginTop: 2, fontSize: 10.5, fontWeight: '700' },
  cardSummary: { marginTop: 10, fontSize: 11.5, lineHeight: 18, color: colors.textMuted },
  cardFooter: { marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tag: { backgroundColor: colors.light, borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 4 },
  tagText: { fontSize: 9, fontWeight: '800', color: colors.primary },
  detailLink: { fontSize: 11, fontWeight: '800', color: colors.primary },
  notice: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 18,
    backgroundColor: colors.lightAlt, borderRadius: radius.md, padding: 12, borderWidth: 1, borderColor: colors.border,
  },
  noticeText: { flex: 1, fontSize: 10.5, lineHeight: 16, color: colors.textMuted },
  cta: {
    marginTop: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    backgroundColor: colors.accent, borderRadius: radius.md, paddingVertical: 14,
  },
  ctaText: { color: colors.white, fontSize: 14, fontWeight: '800' },
});
