import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getRecommendations } from '../../services/YOLOService';
import { colors, radius, shadow, severityColor } from '../../theme';

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

export default function Results() {
  const router = useRouter();
  const {
    imageUri,
    annotatedImageUrl,
    disease,
    confidence,
    alternatives,
  } = useLocalSearchParams();
  const [annotatedImageFailed, setAnnotatedImageFailed] = useState(false);

  const parsedAlternatives = useMemo(() => {
    if (!alternatives) return [];
    try {
      const value = JSON.parse(String(alternatives));
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }, [alternatives]);

  const goHome = () => {
    if (router.canDismiss()) {
      router.dismissAll();
    } else {
      router.replace('/');
    }
  };

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      goHome();
    }
  };

  if (!disease) {
    return (
      <SafeAreaView style={styles.center} edges={['top', 'bottom']}>
        <View style={styles.emptyIcon}>
          <Ionicons name="scan-outline" size={30} color={colors.primary} />
        </View>
        <Text style={styles.centerTitle}>No detection data</Text>
        <Text style={styles.centerText}>
          Run a new screening from the Detection tab or open a saved scan from
          the Home screen.
        </Text>
        <TouchableOpacity style={styles.primary} onPress={goHome}>
          <Text style={styles.primaryText}>Back to Home</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const info = getRecommendations(String(disease));
  const confidenceValue = Math.min(
    1,
    Math.max(0, Number(confidence) || 0)
  );
  const confidencePercent = Math.round(confidenceValue * 100);
  const accent = severityColor(info.severity);
  const displayImageUri =
    annotatedImageUrl && !annotatedImageFailed
      ? String(annotatedImageUrl)
      : imageUri
        ? String(imageUri)
        : '';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.back}
            onPress={goBack}
            hitSlop={8}
          >
            <Ionicons name="chevron-back" size={20} color={colors.primary} />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Screening Result</Text>
          <View style={styles.backSpacer} />
        </View>

        {/* Image + top prediction */}
        <View style={styles.imageCard}>
          {displayImageUri ? (
            <Image
              source={{ uri: displayImageUri }}
              style={styles.image}
              onError={() => {
                if (annotatedImageUrl) setAnnotatedImageFailed(true);
              }}
            />
          ) : (
            <View style={[styles.image, styles.imageEmpty]}>
              <Ionicons name="image-outline" size={26} color={colors.textSoft} />
              <Text style={styles.imageEmptyText}>Image unavailable</Text>
            </View>
          )}
          <View style={styles.imageOverlay}>
            <View style={[styles.overlayBadge, { backgroundColor: accent }]}>
              <Text style={styles.overlayBadgeText}>
                {severityLabel(info.severity)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.resultCard}>
          <Text style={styles.resultEyebrow}>TOP PREDICTION</Text>
          <Text style={styles.resultTitle}>{info.title}</Text>
          <Text style={styles.resultSubtitle}>{info.shortName}</Text>

          <View style={styles.confidenceRow}>
            <Text style={styles.confidenceLabel}>Model confidence</Text>
            <Text style={styles.confidenceValue}>{confidencePercent}%</Text>
          </View>
          <View style={styles.barTrack}>
            <View
              style={[
                styles.barFill,
                { width: `${confidencePercent}%`, backgroundColor: accent },
              ]}
            />
          </View>
        </View>

        {/* Alternative possibilities */}
        {parsedAlternatives.length > 0 && (
          <View style={styles.altCard}>
            <View style={styles.altHeader}>
              <Ionicons name="git-compare-outline" size={16} color={colors.primary} />
              <Text style={styles.altTitle}>Alternative possibilities</Text>
            </View>
            <Text style={styles.altSubtitle}>
              Lower-ranked classes from the same analysis. Use these to judge how
              certain the model is.
            </Text>

            {parsedAlternatives.map((alt) => {
              const altInfo = getRecommendations(alt.label);
              const altPercent = Math.round(
                Math.min(1, Math.max(0, Number(alt.confidence) || 0)) * 100
              );
              return (
                <View key={alt.label} style={styles.altRow}>
                  <View style={styles.altRowTop}>
                    <Text style={styles.altName}>{altInfo.title}</Text>
                    <Text style={styles.altPercent}>{altPercent}%</Text>
                  </View>
                  <View style={styles.altBarTrack}>
                    <View
                      style={[styles.altBarFill, { width: `${altPercent}%` }]}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Recommendations */}
        <Text style={styles.sectionEyebrow}>RECOMMENDATIONS</Text>
        {SECTIONS.map((section) => (
          <View key={section.key} style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name={section.icon} size={17} color={colors.accent} />
              <Text style={styles.sectionTitle}>{section.title}</Text>
            </View>
            <Text style={styles.sectionBody}>{info[section.key]}</Text>
          </View>
        ))}

        <View style={styles.disclaimer}>
          <Ionicons name="alert-circle-outline" size={16} color={colors.warning} />
          <Text style={styles.disclaimerText}>
            DermaSwine AI provides AI-assisted screening only. Confirm findings
            with a licensed veterinarian before applying any treatment.
          </Text>
        </View>

        <TouchableOpacity
          style={styles.primary}
          onPress={goBack}
          activeOpacity={0.85}
        >
          <Ionicons name="scan-outline" size={17} color={colors.white} />
          <Text style={styles.primaryText}>Screen Another</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondary} onPress={goHome} activeOpacity={0.85}>
          <Text style={styles.secondaryText}>Back to Home</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 30,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingRight: 10,
    width: 70,
  },
  backText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  backSpacer: {
    width: 70,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: colors.text,
  },
  imageCard: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.light,
    ...shadow.card,
  },
  image: {
    width: '100%',
    height: 230,
    backgroundColor: colors.light,
  },
  imageEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  imageEmptyText: {
    fontSize: 11.5,
    color: colors.textSoft,
  },
  imageOverlay: {
    position: 'absolute',
    left: 12,
    bottom: 12,
  },
  overlayBadge: {
    borderRadius: radius.pill,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  overlayBadgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '800',
  },
  resultCard: {
    marginTop: 14,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: 16,
    ...shadow.card,
  },
  resultEyebrow: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.1,
    color: colors.textSoft,
  },
  resultTitle: {
    marginTop: 5,
    fontSize: 21,
    fontWeight: '900',
    color: colors.text,
  },
  resultSubtitle: {
    marginTop: 2,
    fontSize: 11.5,
    fontWeight: '700',
    color: colors.accent,
  },
  confidenceRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  confidenceLabel: {
    fontSize: 11.5,
    color: colors.textMuted,
  },
  confidenceValue: {
    fontSize: 15,
    fontWeight: '900',
    color: colors.primary,
  },
  barTrack: {
    marginTop: 7,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.light,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 5,
  },
  altCard: {
    marginTop: 12,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: 15,
    ...shadow.card,
  },
  altHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  altTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: colors.text,
  },
  altSubtitle: {
    marginTop: 5,
    fontSize: 10.5,
    lineHeight: 15,
    color: colors.textMuted,
  },
  altRow: {
    marginTop: 12,
  },
  altRowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  altName: {
    fontSize: 11.5,
    fontWeight: '700',
    color: colors.text,
  },
  altPercent: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textSoft,
  },
  altBarTrack: {
    marginTop: 5,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.lightAlt,
    overflow: 'hidden',
  },
  altBarFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: colors.accent,
    opacity: 0.55,
  },
  sectionEyebrow: {
    marginTop: 22,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.1,
    color: colors.accent,
  },
  section: {
    marginTop: 10,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: 15,
    ...shadow.card,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  sectionTitle: {
    fontSize: 12.5,
    fontWeight: '900',
    color: colors.text,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionBody: {
    marginTop: 7,
    fontSize: 12.5,
    lineHeight: 19,
    color: colors.textMuted,
  },
  disclaimer: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FFF8E6',
    borderRadius: radius.md,
    padding: 12,
  },
  disclaimerText: {
    flex: 1,
    fontSize: 10.5,
    lineHeight: 16,
    color: '#8A5A00',
  },
  primary: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 14,
  },
  primaryText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '800',
  },
  secondary: {
    marginTop: 9,
    borderRadius: radius.md,
    paddingVertical: 13,
    alignItems: 'center',
    backgroundColor: colors.light,
  },
  secondaryText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: 28,
  },
  emptyIcon: {
    width: 62,
    height: 62,
    borderRadius: 20,
    backgroundColor: colors.light,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerTitle: {
    marginTop: 14,
    fontSize: 19,
    fontWeight: '900',
    color: colors.text,
  },
  centerText: {
    marginTop: 8,
    fontSize: 12.5,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 300,
  },
});
