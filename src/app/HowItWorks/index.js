import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadow } from '../../theme';

const PIPELINE = [
  { icon: 'shield-checkmark-outline', title: '1. Consent & Capture', body: 'You review and accept the consent notice. The live camera auto-scans frames or you upload an existing photo for analysis.' },
  { icon: 'options-outline', title: '2. Preprocessing', body: 'The image is prepared for the YOLOv8 detector so the model sees consistent input.' },
  { icon: 'hardware-chip-outline', title: '3. YOLOv8 Inference', body: 'The model screens for Healthy skin, Exudative Epidermitis, Sarcoptic Mange, and Swine Pox.' },
  { icon: 'stats-chart-outline', title: '4. Classification Output', body: 'You get the predicted disease/class, confidence score, alternatives, and the annotated image when available.' },
  { icon: 'medkit-outline', title: '5. Guidance, Records & Analytics', body: 'Results include treatment/management/biosecurity guidance. Saved screenings store IDs, images, dates, farm/pig context, and status, and feed the analytics dashboard.' },
];

const METRICS = [
  { label: 'Accuracy', icon: 'checkmark-done-outline' },
  { label: 'Precision', icon: 'locate-outline' },
  { label: 'Recall', icon: 'repeat-outline' },
  { label: 'F1-score', icon: 'analytics-outline' },
  { label: 'mAP', icon: 'trending-up-outline' },
];

export default function HowItWorks() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.back} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}>
          <Ionicons name="chevron-back" size={20} color={colors.primary} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>How It Works</Text>
        <View style={styles.headerSpacer} />
      </View>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.eyebrow}>HOW IT WORKS</Text>
        <Text style={styles.title}>From image to decision support</Text>
        <Text style={styles.subtitle}>
          DermaSwine AI combines a YOLOv8 model with farm records so screenings, pig health status, and trends stay connected.
        </Text>

        <View style={styles.pipelineCard}>
          {PIPELINE.map((step, index) => (
            <View key={step.title} style={styles.stepRow}>
              <View style={styles.stepIcon}><Ionicons name={step.icon} size={18} color={colors.primary} /></View>
              <View style={styles.stepBody}>
                <Text style={styles.stepTitle}>{step.title}</Text>
                <Text style={styles.stepText}>{step.body}</Text>
              </View>
              {index < PIPELINE.length - 1 && <View style={styles.stepConnector} />}
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Model and evaluation</Text>
        <Text style={styles.sectionBody}>
          The detector is trained on healthy swine skin and three disease classes. To avoid data leakage, split training/testing data by individual pig or farm and remove duplicate or near-duplicate images across splits.
        </Text>

        <View style={styles.metricsWrap}>
          {METRICS.map((metric) => (
            <View key={metric.label} style={styles.metricChip}>
              <Ionicons name={metric.icon} size={14} color={colors.primary} />
              <Text style={styles.metricText}>{metric.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Ionicons name="layers-outline" size={18} color={colors.accent} />
            <Text style={styles.cardTitle}>Screened classes</Text>
          </View>
          <Text style={styles.cardBody}>
            4 classes: Healthy Skin, Exudative Epidermitis (Greasy Pig Disease), Sarcoptic Mange (Scabies), and Swine Pox.
          </Text>
        </View>

        <View style={styles.notice}>
          <Ionicons name="alert-circle-outline" size={16} color={colors.warning} />
          <Text style={styles.noticeText}>
            DermaSwine AI supports - but never replaces - veterinary judgment. Preliminary classifications should be confirmed in the field.
          </Text>
        </View>

        <TouchableOpacity style={styles.cta} activeOpacity={0.85} onPress={() => router.push('/detect')}>
          <Ionicons name="scan-outline" size={17} color={colors.white} />
          <Text style={styles.ctaText}>Try a Screening</Text>
        </TouchableOpacity>
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
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 18, paddingBottom: 32 },
  eyebrow: { fontSize: 9.5, fontWeight: '800', letterSpacing: 1.2, color: colors.accent },
  title: { marginTop: 4, fontSize: 23, fontWeight: '900', color: colors.text },
  subtitle: { marginTop: 6, fontSize: 12.5, lineHeight: 19, color: colors.textMuted },
  pipelineCard: { marginTop: 16, backgroundColor: colors.white, borderRadius: radius.lg, padding: 16, ...shadow.card },
  stepRow: { flexDirection: 'row', position: 'relative', paddingBottom: 16 },
  stepIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.light, alignItems: 'center', justifyContent: 'center' },
  stepBody: { flex: 1, marginLeft: 12, paddingBottom: 4 },
  stepTitle: { fontSize: 13.5, fontWeight: '800', color: colors.text },
  stepText: { marginTop: 3, fontSize: 11.5, lineHeight: 18, color: colors.textMuted },
  stepConnector: { position: 'absolute', left: 17, top: 38, bottom: 2, width: 2, backgroundColor: colors.light },
  sectionTitle: { marginTop: 24, fontSize: 17, fontWeight: '900', color: colors.text },
  sectionBody: { marginTop: 6, fontSize: 12, lineHeight: 19, color: colors.textMuted },
  metricsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  metricChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.light, borderRadius: radius.pill, paddingHorizontal: 11, paddingVertical: 7 },
  metricText: { fontSize: 10.5, fontWeight: '800', color: colors.primary },
  card: { marginTop: 12, backgroundColor: colors.white, borderRadius: radius.lg, padding: 15, ...shadow.card },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  cardTitle: { fontSize: 13.5, fontWeight: '800', color: colors.text },
  cardBody: { marginTop: 7, fontSize: 11.5, lineHeight: 18, color: colors.textMuted },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 16, backgroundColor: '#FFF8E6', borderRadius: radius.md, padding: 12 },
  noticeText: { flex: 1, fontSize: 10.5, lineHeight: 16, color: '#8A5A00' },
  cta: { marginTop: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: colors.accent, borderRadius: radius.md, paddingVertical: 14 },
  ctaText: { color: colors.white, fontSize: 14, fontWeight: '800' },
});
