import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { colors, radius, shadow } from '../../theme';
import {
  detect,
  getRecommendations,
  getRecommendationSnapshot,
} from '../../services/YOLOService';
import {
  getCurrentUser,
  historyBackend,
  subscribeToAuth,
  subscribeToFarms,
  subscribeToPigs,
  saveScreeningRecord,
} from '../../services/FirebaseService';
import {
  hasConsent,
  giveConsent,
  revokeConsent,
  CONSENT_POINTS,
} from '../../services/consent';

export default function Detect() {
  const router = useRouter();
  const [consented, setConsented] = useState(hasConsent());
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [user, setUser] = useState(getCurrentUser());
  const [farms, setFarms] = useState([]);
  const [pigs, setPigs] = useState([]);
  const [selectedFarmId, setSelectedFarmId] = useState('');
  const [selectedPigDocId, setSelectedPigDocId] = useState('');

  useEffect(() => {
    const unsubAuth = subscribeToAuth((nextUser) => setUser(nextUser));
    const unsubFarms = subscribeToFarms(setFarms);
    const unsubPigs = subscribeToPigs(setPigs);
    return () => {
      unsubAuth?.();
      unsubFarms?.();
      unsubPigs?.();
    };
  }, []);

  const farmPigs = useMemo(
    () => pigs.filter((p) => !selectedFarmId || p.farmId === selectedFarmId),
    [pigs, selectedFarmId]
  );

  const selectedFarm = useMemo(
    () => farms.find((f) => f.id === selectedFarmId) || null,
    [farms, selectedFarmId]
  );
  const selectedPig = useMemo(
    () => pigs.find((p) => p.id === selectedPigDocId) || null,
    [pigs, selectedPigDocId]
  );

  const acceptConsent = () => {
    if (!checked) {
      Alert.alert(
        'Consent required',
        'Please confirm that you understand how images and results are used.'
      );
      return;
    }
    giveConsent();
    setConsented(true);
  };

  const analyze = async (uri) => {
    setBusy(true);
    try {
      const result = await detect(uri);
      const info = getRecommendations(result.label);

      await saveScreeningRecord({
        imageUri: uri,
        annotatedImageUrl: result.annotatedImageUrl || '',
        predictedDisease: result.label,
        diseaseTitle: info.title,
        confidence: result.confidence,
        alternatives: result.alternatives || [],
        recommendation: getRecommendationSnapshot(result.label),
        screeningStatus: 'Completed',
        imageSource: 'uploaded',
        farmId: selectedFarm?.id || '',
        farmName: selectedFarm?.name || '',
        farmIdentification: selectedFarm?.farmIdentification || '',
        pigDocId: selectedPig?.id || '',
        pigId: selectedPig?.pigId || '',
        userDisplayName: getCurrentUser()?.displayName || '',
        userEmail: getCurrentUser()?.email || '',
      });

      router.push({
        pathname: '/Results',
        params: {
          imageUri: uri,
          annotatedImageUrl: result.annotatedImageUrl || '',
          disease: result.label,
          confidence: String(result.confidence),
          alternatives: JSON.stringify(result.alternatives || []),
        },
      });
    } catch (error) {
      Alert.alert('Analysis failed', error?.message || 'Could not analyze the image.');
    } finally {
      setBusy(false);
    }
  };

  const uploadPhoto = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.7,
      });
      if (!result.canceled && result.assets?.length) {
        await analyze(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Upload failed', error.message);
    }
  };

  const openCamera = () => {
    router.push('/Camera');
  };

  /* ------------------------------------------------------------ */
  /* Consent gate                                                 */
  /* ------------------------------------------------------------ */
  if (!consented) {
    return (
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.consentHeader}>
          <View style={styles.consentIcon}>
            <Ionicons name="shield-checkmark-outline" size={28} color={colors.primary} />
          </View>
          <Text style={styles.consentTitle}>Before we begin</Text>
          <Text style={styles.consentSubtitle}>
            Your consent is required before the live camera opens or an uploaded
            image is analyzed.
          </Text>
        </View>

        <View style={styles.consentCard}>
          {CONSENT_POINTS.map((point) => (
            <View key={point} style={styles.consentPoint}>
              <Ionicons name="checkmark-circle" size={17} color={colors.accent} />
              <Text style={styles.consentPointText}>{point}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={styles.checkRow}
          activeOpacity={0.8}
          onPress={() => setChecked(!checked)}
        >
          <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
            {checked && <Ionicons name="checkmark" size={14} color={colors.white} />}
          </View>
          <Text style={styles.checkText}>
            I understand and consent to image capture, analysis, and storage for
            swine skin disease screening.
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.primaryButton, !checked && styles.primaryButtonDisabled]}
          onPress={acceptConsent}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryButtonText}>I Agree & Continue</Text>
        </TouchableOpacity>

        <Text style={styles.consentFootnote}>
          You can withdraw consent at any time from this screen.
        </Text>
      </ScrollView>
    );
  }

  /* ------------------------------------------------------------ */
  /* Detection options                                            */
  /* ------------------------------------------------------------ */
  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.eyebrow}>DISEASE DETECTION</Text>
        <Text style={styles.pageTitle}>Screen swine skin</Text>
        <Text style={styles.pageSubtitle}>
          Upload an existing photo or use the live camera. The AI returns a
          preliminary classification, a confidence score, and alternative
          possibilities.
        </Text>

        <View style={styles.consentChip}>
          <Ionicons name="shield-checkmark" size={14} color={colors.primary} />
          <Text style={styles.consentChipText}>Consent granted</Text>
          <TouchableOpacity
            onPress={() => {
              revokeConsent();
              setConsented(false);
              setChecked(false);
            }}
          >
            <Text style={styles.revokeText}>Withdraw</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.contextCard}>
          <View style={styles.contextHeader}>
            <Ionicons name="leaf-outline" size={16} color={colors.primary} />
            <Text style={styles.contextTitle}>Link to farm / pig (optional)</Text>
          </View>
          <Text style={styles.contextText}>
            Link this screening to a registered pig to auto-update its health status after analysis.
          </Text>
          {farms.length === 0 ? (
            <TouchableOpacity style={styles.contextLinkBtn} onPress={() => router.push('/FarmManagement')}>
              <Text style={styles.contextLinkText}>Register farm and pigs</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.primary} />
            </TouchableOpacity>
          ) : (
            <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
                <TouchableOpacity
                  style={[styles.chip, !selectedFarmId && styles.chipActive]}
                  onPress={() => { setSelectedFarmId(''); setSelectedPigDocId(''); }}
                >
                  <Text style={[styles.chipText, !selectedFarmId && styles.chipTextActive]}>No farm</Text>
                </TouchableOpacity>
                {farms.map((farm) => (
                  <TouchableOpacity
                    key={farm.id}
                    style={[styles.chip, selectedFarmId === farm.id && styles.chipActive]}
                    onPress={() => { setSelectedFarmId(farm.id); setSelectedPigDocId(''); }}
                  >
                    <Text style={[styles.chipText, selectedFarmId === farm.id && styles.chipTextActive]} numberOfLines={1}>
                      {farm.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              {selectedFarmId ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
                  <TouchableOpacity
                    style={[styles.chip, !selectedPigDocId && styles.chipActive]}
                    onPress={() => setSelectedPigDocId('')}
                  >
                    <Text style={[styles.chipText, !selectedPigDocId && styles.chipTextActive]}>No pig</Text>
                  </TouchableOpacity>
                  {farmPigs.map((pig) => (
                    <TouchableOpacity
                      key={pig.id}
                      style={[styles.chip, selectedPigDocId === pig.id && styles.chipActive]}
                      onPress={() => setSelectedPigDocId(pig.id)}
                    >
                      <Text style={[styles.chipText, selectedPigDocId === pig.id && styles.chipTextActive]} numberOfLines={1}>
                        {pig.pigId}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              ) : null}
            </>
          )}
        </View>

        {!user && (
          <TouchableOpacity
            style={styles.signInHint}
            activeOpacity={0.85}
            onPress={() => router.push('/Auth')}
          >
            <Ionicons name="cloud-upload-outline" size={17} color={colors.primary} />
            <Text style={styles.signInHintText}>
              {historyBackend === 'local'
                ? 'Screening works as a guest and saves records on this device. Login or register to sync across devices.'
                : 'Screening works as a guest. Login or register to save records to your account.'}
            </Text>
            <Ionicons name="chevron-forward" size={15} color={colors.primary} />
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.actionCard}
          activeOpacity={0.85}
          onPress={uploadPhoto}
          disabled={busy}
        >
          <View style={[styles.actionIcon, { backgroundColor: colors.light }]}>
            <Ionicons name="images-outline" size={26} color={colors.primary} />
          </View>
          <View style={styles.actionBody}>
            <Text style={styles.actionTitle}>Upload a Photo</Text>
            <Text style={styles.actionText}>
              Choose an image from your gallery to analyze.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textSoft} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionCard}
          activeOpacity={0.85}
          onPress={openCamera}
          disabled={busy}
        >
          <View style={[styles.actionIcon, { backgroundColor: colors.primary }]}>
            <Ionicons name="camera-outline" size={26} color={colors.white} />
          </View>
          <View style={styles.actionBody}>
            <Text style={styles.actionTitle}>Live Camera Detection</Text>
            <Text style={styles.actionText}>
              Capture the affected skin area in real time.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textSoft} />
        </TouchableOpacity>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>How analysis works</Text>
          <Text style={styles.infoText}>
            1. The image is sent to the hosted YOLOv8 detector.{'\n'}
            2. Detected skin conditions are ranked by confidence, with the
            strongest match first.{'\n'}
            3. You review the result, annotated image, recommendations, and
            history.
          </Text>
          <TouchableOpacity onPress={() => router.push('/how-it-works')}>
            <Text style={styles.infoLink}>Read the full pipeline</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.notice}>
          <Ionicons name="information-circle-outline" size={16} color={colors.warning} />
          <Text style={styles.noticeText}>
            Results are preliminary and must be confirmed by a licensed
            veterinarian.
          </Text>
        </View>
      </ScrollView>

      {busy && (
        <View style={styles.busyOverlay}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.busyText}>Running YOLOv8 detection...</Text>
        </View>
      )}
    </View>
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
  eyebrow: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: colors.accent,
  },
  pageTitle: {
    marginTop: 4,
    fontSize: 24,
    fontWeight: '900',
    color: colors.text,
  },
  pageSubtitle: {
    marginTop: 6,
    fontSize: 12.5,
    lineHeight: 19,
    color: colors.textMuted,
  },
  consentChip: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.light,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  consentChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  revokeText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: colors.high,
    marginLeft: 4,
  },
  contextCard: {
    marginTop: 14,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: 14,
    ...shadow.card,
  },
  contextHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  contextTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: colors.text,
  },
  contextText: {
    marginTop: 4,
    fontSize: 10.5,
    lineHeight: 15,
    color: colors.textMuted,
  },
  contextLinkBtn: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.light,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  contextLinkText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: colors.primary,
  },
  chipsRow: {
    gap: 8,
    paddingTop: 10,
  },
  chip: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: colors.text,
    maxWidth: 140,
  },
  chipTextActive: {
    color: colors.white,
  },
  signInHint: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.light,
    borderRadius: radius.md,
    padding: 12,
  },
  signInHintText: {
    flex: 1,
    fontSize: 10.5,
    lineHeight: 15,
    color: colors.primary,
    fontWeight: '600',
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: 16,
    marginTop: 14,
    ...shadow.card,
  },
  actionIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBody: {
    flex: 1,
    marginLeft: 13,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  actionText: {
    marginTop: 3,
    fontSize: 11.5,
    lineHeight: 17,
    color: colors.textMuted,
  },
  infoCard: {
    marginTop: 20,
    backgroundColor: colors.lightAlt,
    borderRadius: radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primary,
  },
  infoText: {
    marginTop: 6,
    fontSize: 11.5,
    lineHeight: 18,
    color: colors.textMuted,
  },
  infoLink: {
    marginTop: 8,
    fontSize: 11.5,
    fontWeight: '800',
    color: colors.primary,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    backgroundColor: '#FFF8E6',
    borderRadius: radius.md,
    padding: 11,
    gap: 7,
  },
  noticeText: {
    flex: 1,
    fontSize: 10.5,
    lineHeight: 15,
    color: '#8A5A00',
  },
  busyOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  busyText: {
    marginTop: 12,
    fontSize: 13,
    fontWeight: '700',
    color: colors.white,
  },
  consentHeader: {
    alignItems: 'center',
    marginTop: 8,
  },
  consentIcon: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: colors.light,
    alignItems: 'center',
    justifyContent: 'center',
  },
  consentTitle: {
    marginTop: 14,
    fontSize: 22,
    fontWeight: '900',
    color: colors.text,
  },
  consentSubtitle: {
    marginTop: 6,
    fontSize: 12.5,
    lineHeight: 19,
    color: colors.textMuted,
    textAlign: 'center',
    maxWidth: 310,
  },
  consentCard: {
    marginTop: 20,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: 16,
    gap: 12,
    ...shadow.card,
  },
  consentPoint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
  },
  consentPointText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: colors.textMuted,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 18,
    gap: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxChecked: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  checkText: {
    flex: 1,
    fontSize: 11.5,
    lineHeight: 17,
    color: colors.text,
  },
  primaryButton: {
    marginTop: 18,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.45,
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '800',
  },
  consentFootnote: {
    marginTop: 10,
    fontSize: 10,
    color: colors.textSoft,
    textAlign: 'center',
  },
});