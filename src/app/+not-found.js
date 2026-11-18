import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '../theme';

export default function NotFound() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.icon}>
        <Ionicons name="compass-outline" size={32} color={colors.primary} />
      </View>
      <Text style={styles.title}>Page not found</Text>
      <Text style={styles.text}>
        The link you followed does not exist in DermaSwine AI.
      </Text>
      <TouchableOpacity
        style={styles.button}
        activeOpacity={0.85}
        onPress={() => router.replace('/')}
      >
        <Text style={styles.buttonText}>Back to Home</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: 28,
  },
  icon: {
    width: 66,
    height: 66,
    borderRadius: 22,
    backgroundColor: colors.light,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    marginTop: 16,
    fontSize: 22,
    fontWeight: '900',
    color: colors.text,
  },
  text: {
    marginTop: 8,
    fontSize: 12.5,
    lineHeight: 19,
    color: colors.textMuted,
    textAlign: 'center',
    maxWidth: 300,
  },
  button: {
    marginTop: 20,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingHorizontal: 24,
    paddingVertical: 13,
  },
  buttonText: {
    color: colors.white,
    fontSize: 13.5,
    fontWeight: '800',
  },
});
