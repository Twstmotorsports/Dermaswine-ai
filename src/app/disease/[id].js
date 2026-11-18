import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadow, severityColor } from '../../theme';
import { getRecommendations } from '../../services/YOLOService';

const SECTIONS = [
  { key: 'summary', title: 'Overview', icon: 'document-text-outline' },
  { key: 'treatment', title: 'Treatment', icon: 'medkit-outline' },
  { key: 'management', title: 'Management', icon: 'construct-outline' },
  { key: 'biosecurity', title: 'Biosecurity', icon: 'shield-checkmark-outline' },
];

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

export default function DiseaseDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const info = getRecommendations(String(id));

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <TouchableOpacity style={styles.back} onPress={goBack}>
          <Ionicons name="chevron-back" size={20} color={colors.primary} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
      </View>

      <View
        style={[
          styles.badge,
          { backgroundColor: `${severityColor(info.severity)}18` },
        ]}
      >
        <View
          style={[
            styles.badgeDot,
            { backgroundColor: severityColor(info.severity) },
          ]}
        />
        <Text style={[styles.badgeText, { color: severityColor(info.severity) }]}>
          {severityLabel(info.severity)}
        </Text>
      </View>

      <Text style={styles.title}>{info.title}</Text>
      <Text style={styles.subtitle}>{info.shortName}</Text>

      {SECTIONS.map((section) => (
        <View key={section.key} style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Ionicons name={section.icon} size={17} color={colors.accent} />
            <Text style={styles.cardTitle}>{section.title}</Text>
          </View>
          <Text style={styles.cardBody}>{info[section.key]}</Text>
        </View>
      ))}

      <View style={styles.notice}>
        <Ionicons name="information-circle-outline" size={16} color={colors.warning} />
        <Text style={styles.noticeText}>
          Reference guidance only. Confirm the diagnosis and any medication with
          a licensed veterinarian before treatment.
        </Text>
      </View>

      <TouchableOpacity
        style={styles.cta}
        activeOpacity={0.85}
        onPress={() => router.push('/detect')}
      >
        <Ionicons name="scan-outline" size={17} color={colors.white} />
        <Text style={styles.ctaText}>Screen for this Condition</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 18,
    paddingBottom: 32,
  },
  header: {
    marginBottom: 8,
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingRight: 10,
    gap: 2,
  },
  backText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  badgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 7,
  },
  badgeText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  title: {
    marginTop: 12,
    fontSize: 24,
    fontWeight: '900',
    color: colors.text,
  },
  subtitle: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent,
  },
  card: {
    marginTop: 12,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: 16,
    ...shadow.card,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: colors.text,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardBody: {
    marginTop: 8,
    fontSize: 12.5,
    lineHeight: 19,
    color: colors.textMuted,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 16,
    backgroundColor: '#FFF8E6',
    borderRadius: radius.md,
    padding: 12,
  },
  noticeText: {
    flex: 1,
    fontSize: 10.5,
    lineHeight: 16,
    color: '#8A5A00',
  },
  cta: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 14,
  },
  ctaText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '800',
  },
});