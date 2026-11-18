import React, { useCallback, useEffect, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { colors } from '../theme';
import { isFirebaseConfigured } from '../services/FirebaseService';
import AnimatedLaunchScreen from '../components/AnimatedLaunchScreen';

void SplashScreen.preventAutoHideAsync().catch(() => {
  // Ignore if the native splash screen is already controlled.
});

export default function RootLayout() {
  const [launchDone, setLaunchDone] = useState(false);
  const [appReady, setAppReady] = useState(false);
  const [contentOpacity] = useState(() => new Animated.Value(0));

  useEffect(() => {
    let mounted = true;

    const prepare = async () => {
      try {
        // Keep the native splash only until the JS tree is ready, then show
        // the in-app animated launch experience.
        await SplashScreen.hideAsync();
      } catch {
        // Ignore splash errors; the animated launch can still render.
      } finally {
        if (mounted) setAppReady(true);
      }
    };

    prepare();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (launchDone) {
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 420,
        useNativeDriver: true,
      }).start();
    }
  }, [contentOpacity, launchDone]);

  const handleLaunchFinish = useCallback(() => {
    setLaunchDone(true);
  }, []);

  if (!appReady) {
    return <View style={styles.loadingBase} />;
  }

  const content = !isFirebaseConfigured ? (
    <View style={styles.configScreen}>
      <StatusBar style="dark" />
      <Text style={styles.configTitle}>Firebase is not configured</Text>
      <Text style={styles.configBody}>
        Add the EXPO_PUBLIC_FIREBASE_* values to your .env file, then restart
        Expo with `npx expo start -c`.
      </Text>
    </View>
  ) : (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="Auth"
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen name="Camera" options={{ animation: 'fade' }} />
        <Stack.Screen name="History" />
        <Stack.Screen name="Results" />
        <Stack.Screen name="disease/[id]" />
        <Stack.Screen name="Diseases" />
        <Stack.Screen name="HowItWorks" />
        <Stack.Screen name="Contact" />
        <Stack.Screen name="FarmManagement" />
        <Stack.Screen name="Analytics" />
      </Stack>
    </>
  );

  return (
    <View style={styles.root}>
      <Animated.View style={[styles.root, { opacity: launchDone ? contentOpacity : 0 }]}>
        {content}
      </Animated.View>
      {!launchDone && <AnimatedLaunchScreen onFinish={handleLaunchFinish} />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingBase: {
    flex: 1,
    backgroundColor: colors.background,
  },
  configScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: colors.background,
  },
  configTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.primary,
    textAlign: 'center',
  },
  configBody: {
    marginTop: 12,
    fontSize: 14,
    lineHeight: 21,
    color: colors.textMuted,
    textAlign: 'center',
    maxWidth: 340,
  },
});
