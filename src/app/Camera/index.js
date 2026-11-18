import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
  AppState,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useFocusEffect, useIsFocused, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import {
  detect,
  getRecommendations,
  getRecommendationSnapshot,
} from '../../services/YOLOService';
import {
  getCurrentUser,
  historyBackend,
  saveScreeningRecord,
} from '../../services/FirebaseService';
import { hasConsent, giveConsent, CONSENT_POINTS } from '../../services/consent';
import { colors, radius, shadow, severityColor } from '../../theme';

const SCAN_INTERVAL_MS = 3000;
const CAPTURE_QUALITY = 0.4;

const friendlyScanError = (message) => {
  const text = String(message || '');
  if (/could not confidently|no class reached|no detections?/i.test(text)) {
    return 'No confident match yet. Move closer to the affected skin and hold steady.';
  }
  if (/timed out|network|failed to fetch|connection/i.test(text)) {
    return 'The AI service is slow or offline. Auto-scan will retry.';
  }
  return text || 'Scan failed. Auto-scan will retry.';
};

const formatTime = (value) => {
  if (!value) return '';
  try {
    return new Date(value).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return '';
  }
};

export default function CameraScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const cameraRef = useRef(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [consented, setConsented] = useState(hasConsent());
  const [facing, setFacing] = useState('back');
  const [cameraReady, setCameraReady] = useState(false);
  const [autoScan, setAutoScan] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [preview, setPreview] = useState(null);
  const [savedPreviewId, setSavedPreviewId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [scanNote, setScanNote] = useState('Starting camera...');

  const autoScanRef = useRef(true);
  const cameraReadyRef = useRef(false);
  const analyzingRef = useRef(false);
  const focusedRef = useRef(false);
  const mountedRef = useRef(true);
  const savingRef = useRef(false);
  const previewIdRef = useRef(0);
  const appActiveRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      appActiveRef.current = nextState === 'active';
      if (nextState !== 'active') {
        setScanNote('Auto-scan pauses while the app is in the background.');
      } else {
        setScanNote(
          autoScanRef.current
            ? cameraReadyRef.current
              ? null
              : 'Starting camera...'
            : 'Auto-scan paused.'
        );
      }
    });
    return () => subscription.remove();
  }, []);

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  const scanFrame = useCallback(async () => {
    if (!focusedRef.current || !autoScanRef.current || !appActiveRef.current) return;
    if (analyzingRef.current || !cameraReadyRef.current) return;
    const camera = cameraRef.current;
    if (!camera) return;

    analyzingRef.current = true;
    if (mountedRef.current) setAnalyzing(true);

    try {
      const photo = await camera.takePictureAsync({
        quality: CAPTURE_QUALITY,
        exif: false,
        shutterSound: false,
        skipProcessing: false,
      });
      if (!photo?.uri) throw new Error('The camera did not return an image.');

      const result = await detect(photo.uri);
      if (!mountedRef.current || !focusedRef.current) return;

      previewIdRef.current += 1;
      setPreview({
        id: previewIdRef.current,
        uri: photo.uri,
        result,
        capturedAt: Date.now(),
      });
      setScanNote(null);
    } catch (error) {
      if (!mountedRef.current || !focusedRef.current) return;
      setScanNote(friendlyScanError(error.message));
    } finally {
      analyzingRef.current = false;
      if (mountedRef.current) setAnalyzing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      focusedRef.current = true;
      setScanNote((current) =>
        autoScanRef.current ? current || 'Starting camera...' : 'Auto-scan paused.'
      );

      let cancelled = false;
      let timer;

      const tick = async () => {
        if (cancelled) return;
        await scanFrame();
        if (!cancelled) {
          timer = setTimeout(tick, SCAN_INTERVAL_MS);
        }
      };

      timer = setTimeout(tick, 800);

      return () => {
        cancelled = true;
        focusedRef.current = false;
        cameraReadyRef.current = false;
        clearTimeout(timer);
        if (mountedRef.current) {
          setCameraReady(false);
          setAnalyzing(false);
        }
      };
    }, [scanFrame])
  );

  const handleCameraReady = () => {
    cameraReadyRef.current = true;
    setCameraReady(true);
    setScanNote(autoScanRef.current ? null : 'Auto-scan paused.');
  };

  const handleCameraError = (event) => {
    cameraReadyRef.current = false;
    setCameraReady(false);
    setScanNote(event?.message || 'The camera could not start.');
  };

  const toggleFacing = () => {
    cameraReadyRef.current = false;
    setCameraReady(false);
    setFacing((current) => (current === 'back' ? 'front' : 'back'));
    setScanNote('Switching camera...');
  };

  const toggleAutoScan = () => {
    const next = !autoScanRef.current;
    autoScanRef.current = next;
    setAutoScan(next);
    setScanNote(
      next
        ? cameraReadyRef.current
          ? null
          : 'Starting camera...'
        : 'Auto-scan paused.'
    );
  };

  const saveCurrentResult = async ({ silent = false } = {}) => {
    if (!preview || savingRef.current) return false;
    if (savedPreviewId === preview.id) return true;

    if (!getCurrentUser() && historyBackend !== 'local') {
      if (!silent) {
        Alert.alert(
          'Sign in to save',
          'Create an account or sign in to store this result in your history.',
          [
            { text: 'Not now', style: 'cancel' },
            { text: 'Sign in', onPress: () => router.push('/Auth') },
          ]
        );
      }
      return false;
    }

    const current = preview;
    savingRef.current = true;
    setSaving(true);

    try {
      const info = getRecommendations(current.result.label);
      const response = await saveScreeningRecord({
        imageUri: current.uri,
        annotatedImageUrl: current.result.annotatedImageUrl || '',
        predictedDisease: current.result.label,
        diseaseTitle: info.title,
        confidence: current.result.confidence,
        alternatives: current.result.alternatives || [],
        recommendation: getRecommendationSnapshot(current.result.label),
        screeningStatus: 'Completed',
        imageSource: 'captured',
        userDisplayName: getCurrentUser()?.displayName || '',
        userEmail: getCurrentUser()?.email || '',
      });

      if (!response?.success) {
        throw new Error(response?.error || 'Could not save the screening.');
      }

      if (mountedRef.current) {
        setSavedPreviewId(current.id);
        if (!silent) setScanNote('Screening saved to Screening History.');
      }
      return true;
    } catch (error) {
      if (mountedRef.current && !silent) {
        Alert.alert('Could not save', error.message);
      }
      return false;
    } finally {
      savingRef.current = false;
      if (mountedRef.current) setSaving(false);
    }
  };

  const openResults = async () => {
    if (!preview) return;
    const current = preview;
    if (savedPreviewId !== current.id) {
      await saveCurrentResult({ silent: true });
    }
    router.push({
      pathname: '/Results',
      params: {
        imageUri: current.uri,
        annotatedImageUrl: current.result.annotatedImageUrl || '',
        disease: current.result.label,
        confidence: String(current.result.confidence),
        alternatives: JSON.stringify(current.result.alternatives || []),
      },
    });
  };

  const resultInfo = preview ? getRecommendations(preview.result.label) : null;
  const currentSaved = Boolean(preview && savedPreviewId === preview.id);
  const scanNoteIsWarning = Boolean(
    scanNote && /no confident|slow|offline|failed|could not|error|timed out/i.test(scanNote)
  );
  const liveStatus = !autoScan
    ? 'Auto-scan paused'
    : analyzing
    ? 'Analyzing frame...'
    : cameraReady
    ? 'Auto-scanning live'
    : 'Starting camera...';
  const liveDotColor = !autoScan
    ? colors.textSoft
    : analyzing
    ? colors.warning
    : cameraReady
    ? colors.accent
    : colors.warning;

  /* Consent gate - protects direct links into the camera. */
  if (!consented) {
    return (
      <SafeAreaView style={styles.center} edges={['top', 'bottom']}>
        <View style={styles.consentIcon}>
          <Ionicons name="shield-checkmark-outline" size={30} color={colors.primary} />
        </View>
        <Text style={styles.centerTitle}>Consent required</Text>
        <Text style={styles.centerText}>
          The live camera can only open after you consent to automatic frame
          capture and analysis.
        </Text>

        <View style={styles.consentCard}>
          {CONSENT_POINTS.slice(0, 3).map((point) => (
            <View key={point} style={styles.consentPoint}>
              <Ionicons name="checkmark-circle" size={16} color={colors.accent} />
              <Text style={styles.consentPointText}>{point}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={styles.grant}
          onPress={() => {
            giveConsent();
            setConsented(true);
          }}
          activeOpacity={0.85}
        >
          <Text style={styles.grantText}>I Agree - Open Camera</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.link} onPress={goBack}>
          <Text style={styles.linkText}>Cancel</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
        <Text style={styles.centerText}>Checking camera permission...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.center} edges={['top', 'bottom']}>
        <View style={styles.consentIcon}>
          <Ionicons name="camera-outline" size={30} color={colors.primary} />
        </View>
        <Text style={styles.centerTitle}>Camera access needed</Text>
        <Text style={styles.centerText}>
          DermaSwine AI uses the camera to automatically scan swine skin images
          with the hosted YOLOv8 model. No shutter press is required.
        </Text>
        <TouchableOpacity style={styles.grant} onPress={requestPermission}>
          <Text style={styles.grantText}>Grant Camera Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.link} onPress={goBack}>
          <Text style={styles.linkText}>Go back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {isFocused ? (
        <CameraView
          key={facing}
          ref={cameraRef}
          style={styles.camera}
          facing={facing}
          animateShutter={false}
          onCameraReady={handleCameraReady}
          onMountError={handleCameraError}
        >
          <SafeAreaView style={styles.overlay} edges={['top', 'bottom']}>
            <View style={styles.topBar}>
              <TouchableOpacity style={styles.iconButton} onPress={goBack}>
                <Ionicons name="close" size={20} color={colors.white} />
              </TouchableOpacity>
              <View style={styles.topTitleWrap}>
                <Text style={styles.topTitle}>Live Auto Detection</Text>
                <View style={styles.liveLine}>
                  <View style={[styles.liveDot, { backgroundColor: liveDotColor }]} />
                  <Text style={styles.topSubtitle}>{liveStatus}</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.iconButton} onPress={toggleFacing}>
                <Ionicons
                  name="camera-reverse-outline"
                  size={20}
                  color={colors.white}
                />
              </TouchableOpacity>
            </View>

            <View style={styles.guideWrap} pointerEvents="none">
              <View style={styles.guide}>
                <View style={[styles.corner, styles.cornerTL]} />
                <View style={[styles.corner, styles.cornerTR]} />
                <View style={[styles.corner, styles.cornerBL]} />
                <View style={[styles.corner, styles.cornerBR]} />
              </View>
              <Text style={styles.guideText}>
                Hold the affected skin inside the frame.{'\n'}Auto-scan runs every
                few seconds - no shutter press.
              </Text>
            </View>

            <View style={styles.bottomBar}>
              <TouchableOpacity
                style={styles.sideButton}
                onPress={toggleAutoScan}
                activeOpacity={0.8}
              >
                <View style={styles.sideIcon}>
                  <Ionicons
                    name={autoScan ? 'pause' : 'play'}
                    size={20}
                    color={colors.white}
                  />
                </View>
                <Text style={styles.sideButtonText}>
                  {autoScan ? 'Pause' : 'Resume'}
                </Text>
              </TouchableOpacity>

              <View style={styles.scanIndicator}>
                <View style={[styles.scanOrb, analyzing && styles.scanOrbActive]}>
                  {analyzing ? (
                    <ActivityIndicator color={colors.primary} />
                  ) : (
                    <Ionicons name="scan-outline" size={26} color={colors.primary} />
                  )}
                </View>
                <Text style={styles.scanIndicatorText}>
                  {analyzing ? 'Analyzing...' : 'Auto-scan'}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.sideButton}
                onPress={() => router.push('/History')}
                activeOpacity={0.8}
              >
                <View style={styles.sideIcon}>
                  <Ionicons name="time-outline" size={20} color={colors.white} />
                </View>
                <Text style={styles.sideButtonText}>History</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </CameraView>
      ) : (
        <View style={styles.camera} />
      )}

      {preview && resultInfo && (
        <View style={styles.resultSheet}>
          <Image
            source={{ uri: preview.result.annotatedImageUrl || preview.uri }}
            style={styles.resultThumb}
          />
          <View style={styles.resultBody}>
            <View style={styles.resultHeader}>
              <Text style={styles.resultLabel} numberOfLines={1}>
                {resultInfo.title}
              </Text>
              <View
                style={[
                  styles.confidencePill,
                  { backgroundColor: severityColor(resultInfo.severity) },
                ]}
              >
                <Text style={styles.confidencePillText}>
                  {Math.round(preview.result.confidence * 100)}%
                </Text>
              </View>
            </View>
            <Text style={styles.resultMeta}>
              Last confident match - {formatTime(preview.capturedAt)}
            </Text>
            <Text style={styles.resultSummary} numberOfLines={2}>
              {resultInfo.summary}
            </Text>
            {scanNote ? (
              <Text
                style={[
                  styles.resultNote,
                  scanNoteIsWarning && styles.resultNoteWarning,
                ]}
                numberOfLines={2}
              >
                {scanNote}
              </Text>
            ) : null}
            <View style={styles.resultActions}>
              <TouchableOpacity
                style={styles.primaryAction}
                onPress={openResults}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryActionText}>Full result</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.secondaryAction,
                  (saving || currentSaved) && styles.secondaryActionDisabled,
                ]}
                onPress={() => saveCurrentResult()}
                disabled={saving || currentSaved}
                activeOpacity={0.85}
              >
                <Text style={styles.secondaryActionText}>
                  {currentSaved ? 'Saved' : saving ? 'Saving...' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {!preview && (
        <View style={styles.scanNoteCard}>
          <Ionicons
            name={analyzing ? 'hourglass-outline' : 'scan-circle-outline'}
            size={17}
            color={colors.primary}
          />
          <Text style={styles.scanNoteText}>
            {scanNote || 'Move the camera slowly over the affected skin.'}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitleWrap: {
    alignItems: 'center',
  },
  topTitle: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '800',
  },
  liveLine: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 5,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  topSubtitle: {
    color: 'rgba(255,255,255,0.74)',
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  guideWrap: {
    alignItems: 'center',
  },
  guide: {
    width: '78%',
    height: '58%',
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.04)',
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: colors.accent,
  },
  cornerTL: {
    top: -1,
    left: -1,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 20,
  },
  cornerTR: {
    top: -1,
    right: -1,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 20,
  },
  cornerBL: {
    bottom: -1,
    left: -1,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 20,
  },
  cornerBR: {
    bottom: -1,
    right: -1,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 20,
  },
  guideText: {
    marginTop: 12,
    color: colors.white,
    fontSize: 11.5,
    lineHeight: 17,
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 28,
    paddingBottom: 18,
  },
  sideButton: {
    width: 76,
    alignItems: 'center',
  },
  sideIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  sideButtonText: {
    color: colors.white,
    fontSize: 10.5,
    fontWeight: '700',
  },
  scanIndicator: {
    alignItems: 'center',
    width: 100,
  },
  scanOrb: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.45)',
  },
  scanOrbActive: {
    borderColor: colors.accent,
  },
  scanIndicatorText: {
    marginTop: 5,
    color: colors.white,
    fontSize: 10,
    fontWeight: '700',
  },
  resultSheet: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 108,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: 13,
    flexDirection: 'row',
    ...shadow.raised,
  },
  resultThumb: {
    width: 88,
    height: 88,
    borderRadius: radius.md,
    backgroundColor: colors.light,
  },
  resultBody: {
    flex: 1,
    marginLeft: 12,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  resultLabel: {
    flex: 1,
    marginRight: 8,
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
  },
  confidencePill: {
    borderRadius: radius.pill,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  confidencePillText: {
    color: colors.white,
    fontSize: 9.5,
    fontWeight: '800',
  },
  resultMeta: {
    marginTop: 3,
    fontSize: 9.5,
    color: colors.textSoft,
  },
  resultSummary: {
    marginTop: 5,
    fontSize: 10.5,
    lineHeight: 15,
    color: colors.textMuted,
  },
  resultNote: {
    marginTop: 4,
    fontSize: 9.5,
    lineHeight: 13,
    color: colors.textSoft,
  },
  resultNoteWarning: {
    color: colors.warning,
  },
  resultActions: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 8,
  },
  primaryAction: {
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flex: 1,
  },
  primaryActionText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
  },
  secondaryAction: {
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.light,
  },
  secondaryActionDisabled: {
    opacity: 0.55,
  },
  secondaryActionText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
  },
  scanNoteCard: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 108,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    paddingHorizontal: 13,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    ...shadow.card,
  },
  scanNoteText: {
    flex: 1,
    fontSize: 10.5,
    lineHeight: 15,
    color: colors.textMuted,
    fontWeight: '600',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: 28,
  },
  consentIcon: {
    width: 62,
    height: 62,
    borderRadius: 20,
    backgroundColor: colors.light,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerTitle: {
    marginTop: 14,
    fontSize: 20,
    fontWeight: '900',
    color: colors.text,
  },
  centerText: {
    marginTop: 10,
    fontSize: 12.5,
    lineHeight: 19,
    color: colors.textMuted,
    textAlign: 'center',
    maxWidth: 310,
  },
  consentCard: {
    marginTop: 18,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: 14,
    gap: 10,
    width: '100%',
    ...shadow.card,
  },
  consentPoint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  consentPointText: {
    flex: 1,
    fontSize: 11.5,
    lineHeight: 17,
    color: colors.textMuted,
  },
  grant: {
    marginTop: 20,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingHorizontal: 22,
    paddingVertical: 13,
  },
  grantText: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 13.5,
  },
  link: {
    marginTop: 14,
  },
  linkText: {
    color: colors.primary,
    fontSize: 12.5,
    fontWeight: '700',
  },
});
