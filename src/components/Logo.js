import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme';

/**
 * DermaSwine AI brand mark.
 * A stylized pig snout inside a diagnostic cross with an AI badge.
 * The wordmark spells the app title, so the logo always references it.
 */
export default function Logo({ size = 96, showWordmark = true, light = false }) {
  const scale = size / 96;
  return (
    <View style={styles.wrap}>
      <LinearGradient
        colors={[colors.accent, colors.primary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.badge,
          { width: size, height: size, borderRadius: size * 0.28 },
        ]}
      >
        <View
          style={[
            styles.crossVertical,
            { width: 14 * scale, height: 46 * scale, borderRadius: 7 * scale },
          ]}
        />
        <View
          style={[
            styles.crossHorizontal,
            { width: 46 * scale, height: 14 * scale, borderRadius: 7 * scale },
          ]}
        />
        <View
          style={[
            styles.snout,
            {
              width: 30 * scale,
              height: 22 * scale,
              borderRadius: 11 * scale,
            },
          ]}
        >
          <View
            style={[
              styles.nostril,
              {
                width: 5 * scale,
                height: 9 * scale,
                borderRadius: 3 * scale,
                marginRight: 4 * scale,
              },
            ]}
          />
          <View
            style={[
              styles.nostril,
              { width: 5 * scale, height: 9 * scale, borderRadius: 3 * scale },
            ]}
          />
        </View>
        <View style={[styles.aiBadge, { borderRadius: 6 * scale }]}>
          <Text style={[styles.aiText, { fontSize: 10 * scale }]}>AI</Text>
        </View>
      </LinearGradient>

      {showWordmark && (
        <Text style={[styles.wordmark, light && styles.wordmarkLight]}>
          Derma<Text style={styles.wordmarkAccent}>Swine</Text> AI
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
  },
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  crossVertical: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  crossHorizontal: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  snout: {
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  nostril: {
    backgroundColor: colors.white,
  },
  aiBadge: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    backgroundColor: colors.light,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  aiText: {
    color: colors.primary,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  wordmark: {
    marginTop: 12,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.2,
    color: colors.text,
  },
  wordmarkLight: {
    color: colors.white,
  },
  wordmarkAccent: {
    color: colors.accent,
  },
});