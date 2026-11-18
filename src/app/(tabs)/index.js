import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Logo from '../../components/Logo';
import { colors, radius, shadow, severityColor } from '../../theme';
import { FEATURED_CONDITIONS } from '../../services/YOLOService';
import {
  subscribeToDetections,
  subscribeToAuth,
  deleteDetection,
  historyBackend,
} from '../../services/FirebaseService';

const BENEFITS = [
  {
    icon: 'eye-outline',
    title: 'Early Detection',
    body: 'Spot visual signs of common swine skin diseases before they spread through the herd.',
  },
  {
    icon: 'flash-outline',
    title: 'Fast Results',
    body: 'Get a preliminary classification with a confidence score in seconds.',
  },
  {
    icon: 'clipboard-outline',
    title: 'Actionable Guidance',
    body: 'Receive treatment, management, and biosecurity steps for every result.',
  },
  {
    icon: 'phone-portrait-outline',
    title: 'Farm-Ready',
    body: 'Runs on any Android or iOS phone with a camera - no extra hardware.',
  },
];

const STEPS = [
  {
    icon: 'camera-outline',
    title: 'Capture',
    body: 'Give consent, then let the live camera auto-scan the skin or upload an existing image.',
  },
  {
    icon: 'hardware-chip-outline',
    title: 'AI Analysis',
    body: 'The YOLOv8 detector identifies skin conditions and ranks them by confidence.',
  },
  {
    icon: 'medkit-outline',
    title: 'Review & Act',
    body: 'Check the confidence score, alternatives, and recommended next steps.',
  },
];

export default function Home() {
  const router = useRouter();
  const [recent, setRecent] = useState([]);

  useEffect(() => {
    let unsubscribeDetections = () => {};
    // Re-subscribe whenever the signed-in user changes so the history query
    // runs with the restored Firebase uid, not the initial anonymous one.
    const unsubscribeAuth = subscribeToAuth((nextUser) => {
      unsubscribeDetections();
      // Local history is keyed per device and works for guests. Firestore
      // history needs an authenticated uid for ownership rules.
      if (!nextUser && historyBackend !== 'local') {
        setRecent([]);
        return;
      }
      unsubscribeDetections = subscribeToDetections((items) => {
        setRecent(items.slice(0, 3));
      });
    });
    return () => {
      unsubscribeAuth();
      unsubscribeDetections();
    };
  }, []);

  const confirmDelete = (item) => {
    Alert.alert(
      'Delete this scan?',
      'The detection record will be removed from your history.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteDetection(item.id);
          },
        },
      ]
    );
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* ---------------------------------------------------------- */}
      {/* Hero                                                       */}
      {/* ---------------------------------------------------------- */}
      <LinearGradient
        colors={[colors.primaryDeep, colors.primary, colors.accent]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.heroBadge}>
          <View style={styles.heroBadgeDot} />
          <Text style={styles.heroBadgeText}>AI-POWERED SWINE HEALTH</Text>
        </View>

        <Logo size={78} showWordmark={false} />

        <Text style={styles.heroTitle}>
          Derma<Text style={styles.heroTitleAccent}>Swine</Text> AI
        </Text>
        <Text style={styles.heroSubtitle}>
          Automated early visual screening for common swine skin diseases using
          a YOLOv8 convolutional neural network.
        </Text>

        <View style={styles.heroActions}>
          <TouchableOpacity
            style={styles.heroPrimary}
            activeOpacity={0.85}
            onPress={() => router.push('/detect')}
          >
            <Ionicons name="scan-outline" size={17} color={colors.primary} />
            <Text style={styles.heroPrimaryText}>Start Screening</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.heroSecondary}
            activeOpacity={0.85}
            onPress={() => router.push('/Camera')}
          >
            <Ionicons name="camera-outline" size={16} color={colors.white} />
            <Text style={styles.heroSecondaryText}>Live Camera</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.heroLink}
          activeOpacity={0.8}
          onPress={() => router.push('/HowItWorks')}
        >
          <Text style={styles.heroLinkText}>See how it works</Text>
          <Ionicons name="arrow-forward" size={13} color={colors.light} />
        </TouchableOpacity>

        <View style={styles.heroChips}>
          {['YOLOv8 CNN', '3 Diseases + Healthy', 'Davao Region'].map((chip) => (
            <View key={chip} style={styles.heroChip}>
              <Text style={styles.heroChipText}>{chip}</Text>
            </View>
          ))}
        </View>
      </LinearGradient>

      {/* ---------------------------------------------------------- */}
      {/* Key benefits                                               */}
      {/* ---------------------------------------------------------- */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionEyebrow}>WHY DERMASWINE AI</Text>
        <Text style={styles.sectionTitle}>Built for timely, informed decisions</Text>
      </View>

      <View style={styles.benefitGrid}>
        {BENEFITS.map((benefit) => (
          <View key={benefit.title} style={styles.benefitCard}>
            <View style={styles.benefitIcon}>
              <Ionicons name={benefit.icon} size={20} color={colors.primary} />
            </View>
            <Text style={styles.benefitTitle}>{benefit.title}</Text>
            <Text style={styles.benefitBody}>{benefit.body}</Text>
          </View>
        ))}
      </View>

      {/* ---------------------------------------------------------- */}
      {/* How it works                                               */}
      {/* ---------------------------------------------------------- */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionEyebrow}>HOW IT WORKS</Text>
        <Text style={styles.sectionTitle}>Three steps from image to insight</Text>
      </View>

      <View style={styles.stepsCard}>
        {STEPS.map((step, index) => (
          <View key={step.title} style={styles.stepRow}>
            <View style={styles.stepNumberWrap}>
              <Text style={styles.stepNumber}>{index + 1}</Text>
              {index < STEPS.length - 1 && <View style={styles.stepLine} />}
            </View>
            <View style={styles.stepBody}>
              <View style={styles.stepTitleRow}>
                <Ionicons name={step.icon} size={15} color={colors.accent} />
                <Text style={styles.stepTitle}>{step.title}</Text>
              </View>
              <Text style={styles.stepText}>{step.body}</Text>
            </View>
          </View>
        ))}
        <TouchableOpacity
          style={styles.stepsLink}
          onPress={() => router.push('/HowItWorks')}
        >
          <Text style={styles.stepsLinkText}>See the full process</Text>
          <Ionicons name="arrow-forward" size={14} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* ---------------------------------------------------------- */}
      {/* Featured skin conditions                                   */}
      {/* ---------------------------------------------------------- */}
      <View style={styles.sectionHeaderRow}>
        <View>
          <Text style={styles.sectionEyebrow}>FEATURED CONDITIONS</Text>
          <Text style={styles.sectionTitle}>What DermaSwine AI screens</Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/Diseases')}>
          <Text style={styles.sectionLink}>View all</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.conditionGrid}>
        {FEATURED_CONDITIONS.map((condition) => (
          <TouchableOpacity
            key={condition.id}
            style={styles.conditionCard}
            activeOpacity={0.85}
            onPress={() => router.push(`/disease/${condition.id}`)}
          >
            <View style={styles.conditionTop}>
              <View
                style={[
                  styles.conditionDot,
                  { backgroundColor: severityColor(condition.severity) },
                ]}
              />
              <Ionicons name="chevron-forward" size={14} color={colors.textSoft} />
            </View>
            <Text style={styles.conditionTitle} numberOfLines={2}>
              {condition.title}
            </Text>
            <Text style={styles.conditionBody} numberOfLines={2}>
              {condition.summary}
            </Text>
            <View style={styles.conditionTag}>
              <Text style={styles.conditionTagText}>
                {condition.severity === 'none'
                  ? 'No disease'
                  : condition.severity === 'high'
                  ? 'High concern'
                  : 'Moderate concern'}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* ---------------------------------------------------------- */}
      {/* Recent scans                                               */}
      {/* ---------------------------------------------------------- */}
      {recent.length > 0 && (
        <>
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.sectionEyebrow}>YOUR HISTORY</Text>
              <Text style={styles.sectionTitle}>Recent scans</Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/History')}>
              <Text style={styles.sectionLink}>View all</Text>
            </TouchableOpacity>
          </View>

          {recent.map((item) => {
            const condition = FEATURED_CONDITIONS.find(
              (c) => c.id === item.label
            );
            return (
              <TouchableOpacity
                key={item.id}
                style={styles.recentCard}
                activeOpacity={0.85}
                onLongPress={() => confirmDelete(item)}
                onPress={() =>
                  router.push({
                    pathname: '/Results',
                    params: {
                      imageUri: item.imageUrl || '',
                      disease: item.label,
                      confidence: String(item.confidence ?? ''),
                      alternatives: JSON.stringify(item.alternatives || []),
                    },
                  })
                }
              >
                {item.imageUrl ? (
                  <Image source={{ uri: item.imageUrl }} style={styles.recentThumb} />
                ) : (
                  <View style={[styles.recentThumb, styles.recentThumbEmpty]}>
                    <Ionicons name="image-outline" size={18} color={colors.textSoft} />
                  </View>
                )}
                <View style={styles.recentBody}>
                  <Text style={styles.recentTitle}>
                    {condition?.title || item.label}
                  </Text>
                  <Text style={styles.recentMeta}>
                    {Math.round((item.confidence || 0) * 100)}% confidence
                  </Text>
                </View>
                <View
                  style={[
                    styles.recentBadge,
                    {
                      backgroundColor:
                        (condition && severityColor(condition.severity)) ||
                        colors.textSoft,
                    },
                  ]}
                >
                  <Text style={styles.recentBadgeText}>
                    {Math.round((item.confidence || 0) * 100)}%
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
          <Text style={styles.recentHint}>Long-press a scan to delete it.</Text>
        </>
      )}

      {/* ---------------------------------------------------------- */}
      {/* Farm, screening & analytics                                */}
      {/* ---------------------------------------------------------- */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionEyebrow}>MANAGE & TRACK</Text>
        <Text style={styles.sectionTitle}>Farm records, history, and analytics</Text>
      </View>
      <View style={styles.manageGrid}>
        {[
          { title: 'Farm Management', body: 'Register farms and pigs, track health status.', icon: 'leaf-outline', route: '/FarmManagement' },
          { title: 'Screening History', body: 'View saved screenings, IDs, images, and guidance.', icon: 'time-outline', route: '/History' },
          { title: 'Analytics Dashboard', body: 'Totals, healthy/suspected cases, and trends.', icon: 'bar-chart-outline', route: '/Analytics' },
          { title: 'Contact', body: 'Get support and send feedback.', icon: 'mail-outline', route: '/Contact' },
        ].map((item) => (
          <TouchableOpacity key={item.title} style={styles.manageCard} activeOpacity={0.85} onPress={() => router.push(item.route)}>
            <View style={styles.manageIcon}><Ionicons name={item.icon} size={18} color={colors.primary} /></View>
            <Text style={styles.manageTitle}>{item.title}</Text>
            <Text style={styles.manageBody}>{item.body}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {/* ---------------------------------------------------------- */}
      {/* CTA banner                                                 */}
      {/* ---------------------------------------------------------- */}
      <View style={styles.ctaBanner}>
        <Ionicons name="shield-checkmark-outline" size={30} color={colors.accent} />
        <Text style={styles.ctaTitle}>Ready to screen your herd?</Text>
        <Text style={styles.ctaBody}>
          Capture an image, review the AI classification, and act early.
        </Text>
        <TouchableOpacity
          style={styles.ctaButton}
          activeOpacity={0.85}
          onPress={() => router.push('/detect')}
        >
          <Text style={styles.ctaButtonText}>Open Disease Detection</Text>
        </TouchableOpacity>
      </View>

      {/* ---------------------------------------------------------- */}
      {/* Footer                                                     */}
      {/* ---------------------------------------------------------- */}
      <View style={styles.footer}>
        <Logo size={30} showWordmark={false} />
        <Text style={styles.footerTitle}>
          Derma<Text style={styles.footerAccent}>Swine</Text> AI
        </Text>
        <Text style={styles.footerText}>
          AI-assisted swine skin disease screening for producers and animal
          health workers in the Davao Region.
        </Text>
        <Text style={styles.footerNote}>
          Preliminary results only. Always confirm with a licensed veterinarian.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingBottom: 30,
  },
  hero: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: radius.xl,
    padding: 22,
    alignItems: 'center',
    overflow: 'hidden',
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 16,
  },
  heroBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.light,
    marginRight: 6,
  },
  heroBadgeText: {
    color: colors.light,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  heroTitle: {
    marginTop: 14,
    fontSize: 32,
    fontWeight: '900',
    color: colors.white,
    letterSpacing: 0.3,
  },
  heroTitleAccent: {
    color: colors.light,
  },
  heroSubtitle: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 20,
    color: 'rgba(255,255,255,0.86)',
    textAlign: 'center',
    maxWidth: 300,
  },
  heroActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 18,
    gap: 10,
  },
  heroPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.light,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 11,
    gap: 6,
  },
  heroPrimaryText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800',
  },
  heroSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  heroSecondaryText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '700',
  },
  heroLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 14,
    paddingVertical: 2,
  },
  heroLinkText: {
    color: colors.light,
    fontSize: 11.5,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  heroChips: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 8,
  },
  heroChip: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  heroChipText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 9.5,
    fontWeight: '700',
  },
  sectionHeader: {
    marginTop: 28,
    marginHorizontal: 18,
  },
  sectionHeaderRow: {
    marginTop: 28,
    marginHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  sectionEyebrow: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: colors.accent,
  },
  sectionTitle: {
    marginTop: 4,
    fontSize: 18,
    fontWeight: '900',
    color: colors.text,
  },
  sectionLink: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primary,
  },
  benefitGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    marginTop: 12,
  },
  benefitCard: {
    width: '50%',
    paddingHorizontal: 6,
    marginBottom: 12,
  },
  benefitIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.light,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  benefitTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
  },
  benefitBody: {
    marginTop: 4,
    fontSize: 11.5,
    lineHeight: 17,
    color: colors.textMuted,
  },
  stepsCard: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: 16,
    ...shadow.card,
  },
  stepRow: {
    flexDirection: 'row',
  },
  stepNumberWrap: {
    alignItems: 'center',
    width: 28,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.light,
    color: colors.primary,
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 24,
    overflow: 'hidden',
  },
  stepLine: {
    flex: 1,
    width: 2,
    backgroundColor: colors.light,
    marginVertical: 3,
  },
  stepBody: {
    flex: 1,
    paddingLeft: 10,
    paddingBottom: 14,
  },
  stepTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  stepTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
  },
  stepText: {
    marginTop: 3,
    fontSize: 11.5,
    lineHeight: 17,
    color: colors.textMuted,
  },
  stepsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  stepsLinkText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primary,
  },
  conditionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 12,
  },
  conditionCard: {
    width: '48.5%',
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: 12,
    marginBottom: 10,
    ...shadow.card,
  },
  conditionTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  conditionDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  conditionTitle: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
    minHeight: 34,
  },
  conditionBody: {
    marginTop: 4,
    fontSize: 11,
    lineHeight: 16,
    color: colors.textMuted,
    minHeight: 32,
  },
  conditionTag: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: colors.light,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  conditionTagText: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.primary,
  },
  recentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.md,
    marginHorizontal: 16,
    marginTop: 8,
    padding: 10,
    ...shadow.card,
  },
  recentThumb: {
    width: 46,
    height: 46,
    borderRadius: 10,
    backgroundColor: colors.lightAlt,
  },
  recentThumbEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentBody: {
    flex: 1,
    marginLeft: 10,
  },
  recentTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.text,
  },
  recentMeta: {
    marginTop: 2,
    fontSize: 10.5,
    color: colors.textSoft,
  },
  recentBadge: {
    borderRadius: radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  recentBadgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '800',
  },
  recentHint: {
    marginTop: 8,
    marginHorizontal: 18,
    fontSize: 9.5,
    color: colors.textSoft,
  },
  ctaBanner: {
    marginHorizontal: 16,
    marginTop: 28,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    padding: 20,
    alignItems: 'center',
    ...shadow.raised,
  },
  ctaTitle: {
    marginTop: 8,
    fontSize: 17,
    fontWeight: '900',
    color: colors.white,
  },
  ctaBody: {
    marginTop: 5,
    fontSize: 12,
    lineHeight: 18,
    color: 'rgba(255,255,255,0.82)',
    textAlign: 'center',
    maxWidth: 280,
  },
  ctaButton: {
    marginTop: 14,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingHorizontal: 22,
    paddingVertical: 11,
  },
  ctaButtonText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '800',
  },
  manageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 12,
  },
  manageCard: {
    width: '48.5%',
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: 13,
    marginBottom: 10,
    ...shadow.card,
  },
  manageIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: colors.light,
    alignItems: 'center',
    justifyContent: 'center',
  },
  manageTitle: {
    marginTop: 8,
    fontSize: 12.5,
    fontWeight: '800',
    color: colors.text,
  },
  manageBody: {
    marginTop: 3,
    fontSize: 10.5,
    lineHeight: 15,
    color: colors.textMuted,
  },
  footer: {
    marginTop: 30,
    marginHorizontal: 24,
    alignItems: 'center',
  },
  footerTitle: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '900',
    color: colors.primary,
  },
  footerAccent: {
    color: colors.accent,
  },
  footerText: {
    marginTop: 6,
    fontSize: 11,
    lineHeight: 16,
    color: colors.textMuted,
    textAlign: 'center',
  },
  footerNote: {
    marginTop: 8,
    fontSize: 9.5,
    color: colors.textSoft,
    textAlign: 'center',
  },
});