import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Logo from './Logo';
import { colors, radius, shadow } from '../theme';
import {
  getCurrentUser,
  subscribeToAuth,
  logOut,
} from '../services/FirebaseService';

/**
 * Top navigation bar shown on every tab.
 * Brand on the left, authentication action on the right.
 */
export default function AppHeader() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [user, setUser] = useState(getCurrentUser());

  useEffect(() => {
    const unsubscribe = subscribeToAuth((nextUser) => setUser(nextUser));
    return unsubscribe;
  }, []);

  const handleAuthPress = () => {
    if (!user) {
      router.push('/Auth');
      return;
    }
    Alert.alert(
      'Account',
      user.email || 'Signed in',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out',
          style: 'destructive',
          onPress: async () => {
            await logOut();
            setUser(null);
          },
        },
      ]
    );
  };

  const initial = (user?.email || 'G').charAt(0).toUpperCase();

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <TouchableOpacity
        style={styles.brand}
        activeOpacity={0.8}
        onPress={() => router.navigate('/')}
      >
        <Logo size={34} showWordmark={false} />
        <View style={styles.brandText}>
          <Text style={styles.title}>
            Derma<Text style={styles.titleAccent}>Swine</Text> AI
          </Text>
          <Text style={styles.subtitle}>Swine skin screening</Text>
        </View>
      </TouchableOpacity>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.cameraButton}
          onPress={() => router.push('/History')}
          activeOpacity={0.8}
          accessibilityLabel="Open detection history"
        >
          <Ionicons name="time-outline" size={18} color={colors.primary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.cameraButton}
          onPress={() => router.push('/Camera')}
          activeOpacity={0.8}
          accessibilityLabel="Open live camera detection"
        >
          <Ionicons name="camera-outline" size={18} color={colors.primary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={user ? styles.avatar : styles.signIn}
          onPress={handleAuthPress}
          activeOpacity={0.8}
        >
          {user ? (
            user.photoURL ? (
              <Image source={{ uri: user.photoURL }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>{initial}</Text>
            )
          ) : (
            <Text style={styles.signInText}>Login / Register</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 10,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  brandText: {
    marginLeft: 9,
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.primary,
    letterSpacing: 0.2,
  },
  titleAccent: {
    color: colors.accent,
  },
  subtitle: {
    fontSize: 10,
    color: colors.textSoft,
    marginTop: 1,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cameraButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.light,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  signIn: {
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
    ...shadow.card,
  },
  signInText: {
    color: colors.white,
    fontSize: 10.5,
    fontWeight: '800',
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.light,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.accent,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '900',
    color: colors.primary,
  },
});