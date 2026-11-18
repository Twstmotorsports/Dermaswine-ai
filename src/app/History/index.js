import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadow, severityColor } from '../../theme';
import { getRecommendations } from '../../services/YOLOService';
import {
  subscribeToAuth,
  getCurrentUser,
  subscribeToScreenings,
  deleteScreening,
  historyBackend,
} from '../../services/FirebaseService';

const formatDate = (value) => {
  if (!value) return 'N/A';
  const date = value?.toMillis ? new Date(value.toMillis()) : new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const guidanceFor = (item) => {
  const base = getRecommendations(item.predictedDisease || item.label);
  const saved = item.recommendation || {};
  return {
    ...base,
    summary: saved.summary || base.summary,
    treatment: saved.treatment || base.treatment,
    management: saved.management || base.management,
    biosecurity: saved.biosecurity || base.biosecurity,
  };
};

function Row({ label, value }) {
  if (!value) return null;
  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{String(value)}</Text>
    </View>
  );
}

function GuidanceBlock({ icon, label, value }) {
  return (
    <View style={styles.guidanceBlock}>
      <View style={styles.guidanceLabelRow}>
        <Ionicons name={icon} size={13} color={colors.accent} />
        <Text style={styles.guidanceLabel}>{label}</Text>
      </View>
      <Text style={styles.guidanceText}>{value}</Text>
    </View>
  );
}

export default function History() {
  const router = useRouter();
  const [user, setUser] = useState(getCurrentUser());
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeScreenings = () => {};

    const unsubscribeAuth = subscribeToAuth((nextUser) => {
      setUser(nextUser);
      unsubscribeScreenings();
      // Screenings are stored locally for guests and synced for signed-in users.
      setLoading(true);
      unsubscribeScreenings = subscribeToScreenings((nextItems) => {
        setItems(nextItems || []);
        setLoading(false);
      });
    });

    return () => {
      unsubscribeAuth();
      unsubscribeScreenings();
    };
  }, []);

  const confirmDelete = (item) => {
    Alert.alert('Delete this screening?', 'The screening record and its recommendations will be removed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteScreening(item.id);
        },
      },
    ]);
  };

  const openRecord = (item) => {
    router.push({
      pathname: '/Results',
      params: {
        imageUri: item.annotatedImageUrl || item.uploadedImageUrl || item.imageUri || '',
        disease: item.predictedDisease || item.label,
        confidence: String(item.confidence ?? ''),
        alternatives: JSON.stringify(item.alternatives || []),
      },
    });
  };

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.back} onPress={goBack} hitSlop={8}>
          <Ionicons name="chevron-back" size={20} color={colors.primary} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Screening History</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.eyebrow}>SCREENING RECORDS</Text>
        <Text style={styles.title}>Results and recommendations</Text>
        <Text style={styles.subtitle}>
          Saved screenings include Screening ID, image, predicted disease, confidence, date, user/farm details, status, and guidance.
        </Text>

        {!user && historyBackend === 'local' && (
          <View style={styles.localNotice}>
            <Ionicons name="phone-portrait-outline" size={15} color={colors.primary} />
            <Text style={styles.localNoticeText}>
              Records are stored on this device. Sign in to sync screenings, farms, pigs, and reports with Firebase.
            </Text>
          </View>
        )}

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.accent} />
            <Text style={styles.loadingText}>Loading screenings...</Text>
          </View>
        ) : items.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="time-outline" size={29} color={colors.primary} />
            <Text style={styles.emptyTitle}>No saved screenings yet</Text>
            <Text style={styles.emptyText}>
              Run a screening and save the result to create a screening record with disease prediction and recommendations.
            </Text>
            <TouchableOpacity style={styles.primary} onPress={() => router.push('/detect')} activeOpacity={0.85}>
              <Text style={styles.primaryText}>Start a Screening</Text>
            </TouchableOpacity>
          </View>
        ) : (
          items.map((item) => {
            const info = guidanceFor(item);
            const confidence = Math.round((Number(item.confidence) || 0) * 100);
            const imageUri = item.annotatedImageUrl || item.uploadedImageUrl || '';
            return (
              <TouchableOpacity
                key={item.id}
                style={styles.card}
                activeOpacity={0.9}
                onPress={() => openRecord(item)}
                onLongPress={() => confirmDelete(item)}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.cardTitleWrap}>
                    <View style={[styles.severityDot, { backgroundColor: severityColor(info.severity) }]} />
                    <Text style={styles.cardTitle} numberOfLines={1}>{info.title}</Text>
                  </View>
                  <View style={styles.cardActions}>
                    <View style={[styles.confidencePill, { backgroundColor: severityColor(info.severity) }]}>
                      <Text style={styles.confidenceText}>{confidence}%</Text>
                    </View>
                    <TouchableOpacity
                      onPress={(event) => {
                        event.stopPropagation?.();
                        confirmDelete(item);
                      }}
                      hitSlop={8}
                    >
                      <Ionicons name="trash-outline" size={17} color={colors.textSoft} />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.statusRow}>
                  <View style={styles.statusPill}>
                    <Text style={styles.statusPillText}>{item.screeningStatus || 'Completed'}</Text>
                  </View>
                  <Text style={styles.date}>{formatDate(item.screeningDate || item.createdAt)}</Text>
                </View>

                {imageUri ? (
                  <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" />
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <Ionicons name="image-outline" size={22} color={colors.textSoft} />
                    <Text style={styles.imagePlaceholderText}>
                      {item.imageSource === 'captured' ? 'Captured image (local)' : item.imageSource === 'uploaded' ? 'Uploaded image (local)' : 'Image not stored'}
                    </Text>
                  </View>
                )}

                <View style={styles.metaBox}>
                  <Row label="Screening ID" value={item.screeningId || item.id} />
                  <Row label="Predicted disease" value={item.predictedDisease || item.label} />
                  <Row label="Confidence score" value={`${confidence}%`} />
                  <Row label="Screening date" value={formatDate(item.screeningDate || item.createdAt)} />
                  <Row label="User" value={item.userDisplayName || item.userEmail || (user ? (user.displayName || user.email) : 'Guest (this device)')} />
                  <Row label="Farm" value={item.farmName || item.farmIdentification || 'Not specified'} />
                  <Row label="Pig ID" value={item.pigId || item.pigTag || 'Not specified'} />
                  <Row label="Screening status" value={item.screeningStatus || 'Completed'} />
                </View>

                {item.alternatives?.length > 0 && (
                  <Text style={styles.alternatives} numberOfLines={2}>
                    Also considered: {item.alternatives.map((a) => `${getRecommendations(a.label).shortName} ${Math.round((Number(a.confidence) || 0) * 100)}%`).join(' · ')}
                  </Text>
                )}

                <View style={styles.guidanceGrid}>
                  <GuidanceBlock icon="medkit-outline" label="Treatment" value={info.treatment} />
                  <GuidanceBlock icon="construct-outline" label="Management" value={info.management} />
                  <GuidanceBlock icon="shield-checkmark-outline" label="Biosecurity" value={info.biosecurity} />
                </View>

                <View style={styles.openRow}>
                  <Text style={styles.openText}>Open full result</Text>
                  <Ionicons name="arrow-forward" size={14} color={colors.primary} />
                </View>
              </TouchableOpacity>
            );
          })
        )}

        {items.length > 0 && (
          <Text style={styles.hint}>Tap a record to open it. Long-press or use the trash icon to delete.</Text>
        )}
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
  localNotice: { marginTop: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: colors.light, borderRadius: radius.md, padding: 12 },
  localNoticeText: { flex: 1, fontSize: 10.5, lineHeight: 15, color: colors.primary, fontWeight: '600' },
  loading: { marginTop: 30, alignItems: 'center', gap: 10 },
  loadingText: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  emptyCard: { marginTop: 22, backgroundColor: colors.white, borderRadius: radius.lg, padding: 22, alignItems: 'center', ...shadow.card },
  emptyTitle: { marginTop: 10, fontSize: 16, fontWeight: '900', color: colors.text, textAlign: 'center' },
  emptyText: { marginTop: 7, fontSize: 11.5, lineHeight: 17, color: colors.textMuted, textAlign: 'center', maxWidth: 290 },
  primary: { marginTop: 16, backgroundColor: colors.accent, borderRadius: radius.md, paddingHorizontal: 18, paddingVertical: 11 },
  primaryText: { color: colors.white, fontSize: 12, fontWeight: '800' },
  card: { marginTop: 14, backgroundColor: colors.white, borderRadius: radius.lg, padding: 14, ...shadow.card },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitleWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', marginRight: 8 },
  severityDot: { width: 9, height: 9, borderRadius: 5, marginRight: 8 },
  cardTitle: { flex: 1, fontSize: 14, fontWeight: '900', color: colors.text },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  confidencePill: { borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3 },
  confidenceText: { color: colors.white, fontSize: 9.5, fontWeight: '800' },
  statusRow: { marginTop: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusPill: { backgroundColor: colors.light, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3 },
  statusPillText: { fontSize: 9.5, fontWeight: '800', color: colors.primary },
  date: { fontSize: 9.5, color: colors.textSoft },
  image: { marginTop: 10, width: '100%', height: 160, borderRadius: radius.md, backgroundColor: colors.lightAlt },
  imagePlaceholder: { marginTop: 10, height: 90, borderRadius: radius.md, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  imagePlaceholderText: { marginTop: 6, fontSize: 10, color: colors.textSoft },
  metaBox: { marginTop: 10, backgroundColor: colors.background, borderRadius: radius.md, padding: 10 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginBottom: 5 },
  metaLabel: { fontSize: 10, color: colors.textSoft, fontWeight: '700', flex: 1 },
  metaValue: { fontSize: 10.5, color: colors.text, fontWeight: '700', flex: 1.2, textAlign: 'right' },
  alternatives: { marginTop: 8, fontSize: 9.5, lineHeight: 14, color: colors.textSoft },
  guidanceGrid: { marginTop: 10, gap: 8 },
  guidanceBlock: { backgroundColor: colors.background, borderRadius: radius.md, padding: 10 },
  guidanceLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  guidanceLabel: { fontSize: 9.5, fontWeight: '800', color: colors.primary, letterSpacing: 0.3, textTransform: 'uppercase' },
  guidanceText: { marginTop: 5, fontSize: 10.5, lineHeight: 15, color: colors.textMuted },
  openRow: { marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  openText: { fontSize: 11, fontWeight: '800', color: colors.primary },
  hint: { marginTop: 14, fontSize: 9.5, lineHeight: 14, color: colors.textSoft, textAlign: 'center' },
});
