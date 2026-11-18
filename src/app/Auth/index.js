import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Logo from '../../components/Logo';
import { colors, radius, shadow } from '../../theme';
import { signIn, signUp, isImageStorageEnabled } from '../../services/FirebaseService';

export default function Auth() {
  const router = useRouter();
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [loading, setLoading] = useState(false);

  const isLogin = mode === 'login';

  const close = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  const pickPhoto = async (fromCamera) => {
    try {
      const options = {
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      };
      const result = fromCamera
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);

      if (!result.canceled && result.assets?.length) {
        setPhoto(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Photo error', error.message);
    }
  };

  const validate = () => {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      Alert.alert('Invalid email', 'Please enter a valid email address.');
      return false;
    }
    if (password.length < 6) {
      Alert.alert('Weak password', 'Password must be at least 6 characters.');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);

    const result = isLogin
      ? await signIn(email.trim(), password)
      : await signUp(email.trim(), password, { imageUri: photo });

    setLoading(false);

    if (!result.success) {
      Alert.alert(isLogin ? 'Sign in failed' : 'Sign up failed', result.error);
      return;
    }

    if (router.canDismiss()) {
      router.dismissAll();
    } else {
      router.replace('/');
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity style={styles.back} onPress={close}>
            <Ionicons name="chevron-back" size={20} color={colors.primary} />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>

          <View style={styles.header}>
            <Logo size={64} showWordmark={false} />
            <Text style={styles.brand}>
              Derma<Text style={styles.brandAccent}>Swine</Text> AI
            </Text>
            <Text style={styles.title}>
              {isLogin ? 'Welcome back' : 'Create your account'}
            </Text>
            <Text style={styles.subtitle}>
              {isLogin
                ? 'Sign in to sync detections and recommendations across devices.'
                : 'Register to keep your farm screening records in one place.'}
            </Text>
          </View>

          {!isLogin && isImageStorageEnabled && (
            <View style={styles.photoSection}>
              <TouchableOpacity
                style={styles.avatarWrap}
                onPress={() => pickPhoto(false)}
                activeOpacity={0.8}
              >
                {photo ? (
                  <Image source={{ uri: photo }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Ionicons
                      name="person-outline"
                      size={30}
                      color={colors.primary}
                    />
                  </View>
                )}
                <View style={styles.avatarBadge}>
                  <Ionicons name="camera" size={11} color={colors.white} />
                </View>
              </TouchableOpacity>
              <View style={styles.photoButtons}>
                <TouchableOpacity
                  style={styles.photoButton}
                  onPress={() => pickPhoto(true)}
                >
                  <Ionicons name="camera-outline" size={13} color={colors.primary} />
                  <Text style={styles.photoButtonText}>Camera</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.photoButton}
                  onPress={() => pickPhoto(false)}
                >
                  <Ionicons name="images-outline" size={13} color={colors.primary} />
                  <Text style={styles.photoButtonText}>Gallery</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <View style={styles.form}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="you@farm.ph"
              placeholderTextColor={colors.textSoft}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
            />

            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordWrap}>
              <TextInput
                style={styles.passwordInput}
                placeholder="At least 6 characters"
                placeholderTextColor={colors.textSoft}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                textContentType={isLogin ? 'password' : 'newPassword'}
              />
              <TouchableOpacity
                style={styles.eye}
                onPress={() => setShowPassword((value) => !value)}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={18}
                  color={colors.textSoft}
                />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.submit, loading && styles.submitDisabled]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <>
                <Ionicons
                  name={isLogin ? 'log-in-outline' : 'person-add-outline'}
                  size={17}
                  color={colors.white}
                />
                <Text style={styles.submitText}>
                  {isLogin ? 'Sign In' : 'Create Account'}
                </Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.switchRow}>
            <Text style={styles.switchText}>
              {isLogin ? "Don't have an account? " : 'Already registered? '}
            </Text>
            <TouchableOpacity
              onPress={() => {
                setMode(isLogin ? 'signup' : 'login');
                setPhoto(null);
              }}
            >
              <Text style={styles.switchAction}>
                {isLogin ? 'Sign Up' : 'Sign In'}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.terms}>
            By continuing you agree to use DermaSwine AI as a screening aid only.
            Results must be confirmed by a licensed veterinarian.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 32,
  },
  back: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingRight: 12,
  },
  backText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '700',
  },
  header: {
    alignItems: 'center',
    marginTop: 8,
  },
  brand: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: '900',
    color: colors.primary,
    letterSpacing: 0.2,
  },
  brandAccent: {
    color: colors.accent,
  },
  title: {
    marginTop: 14,
    fontSize: 24,
    fontWeight: '900',
    color: colors.text,
  },
  subtitle: {
    marginTop: 6,
    fontSize: 12.5,
    lineHeight: 19,
    color: colors.textMuted,
    textAlign: 'center',
    maxWidth: 300,
  },
  photoSection: {
    alignItems: 'center',
    marginTop: 20,
  },
  avatarWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
    borderColor: colors.accent,
    backgroundColor: colors.light,
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 42,
  },
  avatarPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.white,
  },
  photoButtons: {
    flexDirection: 'row',
    marginTop: 10,
    gap: 10,
  },
  photoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.light,
  },
  photoButtonText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: colors.primary,
  },
  form: {
    marginTop: 24,
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 14.5,
    color: colors.text,
  },
  passwordWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 14.5,
    color: colors.text,
  },
  eye: {
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  submit: {
    marginTop: 26,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 14,
    ...shadow.card,
  },
  submitDisabled: {
    opacity: 0.65,
  },
  submitText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '800',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 18,
  },
  switchText: {
    fontSize: 12.5,
    color: colors.textMuted,
  },
  switchAction: {
    fontSize: 12.5,
    fontWeight: '800',
    color: colors.primary,
  },
  terms: {
    marginTop: 22,
    fontSize: 9.5,
    lineHeight: 14,
    color: colors.textSoft,
    textAlign: 'center',
  },
});
