import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Logo from './Logo';
import { colors } from '../theme';

export default function AnimatedLaunchScreen({ onFinish }) {
  const [containerOpacity] = useState(() => new Animated.Value(1));
  const [logoScale] = useState(() => new Animated.Value(0.82));
  const [logoOpacity] = useState(() => new Animated.Value(0));
  const [titleTranslate] = useState(() => new Animated.Value(14));
  const [titleOpacity] = useState(() => new Animated.Value(0));
  const [subtitleOpacity] = useState(() => new Animated.Value(0));
  const [loaderOpacity] = useState(() => new Animated.Value(0));
  const [dot1] = useState(() => new Animated.Value(0.35));
  const [dot2] = useState(() => new Animated.Value(0.35));
  const [dot3] = useState(() => new Animated.Value(0.35));
  const finishedRef = useRef(false);

  useEffect(() => {
    const pulse = (value, delay) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(value, {
            toValue: 1,
            duration: 420,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0.35,
            duration: 420,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );

    const pulse1 = pulse(dot1, 0);
    const pulse2 = pulse(dot2, 140);
    const pulse3 = pulse(dot3, 280);
    pulse1.start();
    pulse2.start();
    pulse3.start();

    Animated.sequence([
      Animated.parallel([
        Animated.spring(logoScale, {
          toValue: 1,
          friction: 7,
          tension: 55,
          useNativeDriver: true,
        }),
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 520,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(titleOpacity, {
          toValue: 1,
          duration: 420,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(titleTranslate, {
          toValue: 0,
          duration: 420,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(subtitleOpacity, {
          toValue: 1,
          duration: 360,
          useNativeDriver: true,
        }),
        Animated.timing(loaderOpacity, {
          toValue: 1,
          duration: 360,
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(900),
      Animated.timing(containerOpacity, {
        toValue: 0,
        duration: 420,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      pulse1.stop();
      pulse2.stop();
      pulse3.stop();
      if (finished && !finishedRef.current) {
        finishedRef.current = true;
        onFinish?.();
      }
    });

    return () => {
      pulse1.stop();
      pulse2.stop();
      pulse3.stop();
    };
  }, [containerOpacity, dot1, dot2, dot3, loaderOpacity, logoOpacity, logoScale, onFinish, subtitleOpacity, titleOpacity, titleTranslate]);

  return (
    <Animated.View style={[styles.container, { opacity: containerOpacity }]}>
      <LinearGradient
        colors={[colors.background, colors.lightAlt, colors.light]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.content}>
        <Animated.View
          style={{
            opacity: logoOpacity,
            transform: [{ scale: logoScale }],
          }}
        >
          <Logo size={112} showWordmark={false} />
        </Animated.View>

        <Animated.View
          style={{
            opacity: titleOpacity,
            transform: [{ translateY: titleTranslate }],
            alignItems: 'center',
          }}
        >
          <Text style={styles.title}>
            Derma<Text style={styles.titleAccent}>Swine</Text> AI
          </Text>
        </Animated.View>

        <Animated.Text style={[styles.subtitle, { opacity: subtitleOpacity }]}>
          AI-assisted swine skin screening
        </Animated.Text>

        <Animated.View style={[styles.loaderRow, { opacity: loaderOpacity }]}>
          <Animated.View style={[styles.dot, { opacity: dot1 }]} />
          <Animated.View style={[styles.dot, { opacity: dot2 }]} />
          <Animated.View style={[styles.dot, { opacity: dot3 }]} />
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  title: {
    marginTop: 18,
    fontSize: 34,
    fontWeight: '900',
    color: colors.primary,
    letterSpacing: 0.3,
  },
  titleAccent: {
    color: colors.accent,
  },
  subtitle: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    textAlign: 'center',
  },
  loaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 28,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
});
