import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadow } from '../../theme';
import { getCurrentUser, subscribeToAuth } from '../../services/FirebaseService';

const SECTIONS = [
  {
    title: 'Farm & Screening',
    items: [
      { title: 'Farm Management', subtitle: 'Register farms and pigs, track health status', icon: 'leaf-outline', route: '/FarmManagement' },
      { title: 'Screening History', subtitle: 'Saved images, results, IDs, and status', icon: 'time-outline', route: '/History' },
      { title: 'Analytics Dashboard', subtitle: 'Totals, suspected cases, and trends', icon: 'bar-chart-outline', route: '/Analytics' },
    ],
  },
  {
    title: 'Learn & Support',
    items: [
      { title: 'Diseases', subtitle: 'Healthy skin and 3 screened disease classes', icon: 'medkit-outline', route: '/Diseases' },
      { title: 'How It Works', subtitle: 'Capture, inference, guidance, and history', icon: 'git-branch-outline', route: '/HowItWorks' },
      { title: 'Contact', subtitle: 'Message the DermaSwine AI team', icon: 'mail-outline', route: '/Contact' },
    ],
  },
];

export default function More() {
  const router = useRouter();
  const [user, setUser] = useState(getCurrentUser());

  useEffect(() => subscribeToAuth(setUser), []);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.eyebrow}>MORE</Text>
      <Text style={styles.title}>Manage, learn, and review</Text>
      <Text style={styles.subtitle}>
        Farm records, screening history, analytics, disease guidance, and support are available here.
      </Text>

      <TouchableOpacity style={styles.profileCard} activeOpacity={0.85} onPress={() => router.push('/Auth')}>
        <View style={styles.profileIcon}>
          <Ionicons name={user ? 'person' : 'log-in-outline'} size={22} color={colors.primary} />
        </View>
        <View style={styles.profileBody}>
          <Text style={styles.profileTitle}>{user ? (user.displayName || user.email || 'Signed in') : 'Login / Register'}</Text>
          <Text style={styles.profileText}>
            {user
              ? 'Manage your account and sync farm, pig, and screening records.'
              : 'Sign in to save farms, pigs, screenings, and reports to your account.'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textSoft} />
      </TouchableOpacity>

      {SECTIONS.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <View style={styles.card}>
            {section.items.map((item, index) => (
              <TouchableOpacity
                key={item.title}
                style={[styles.row, index < section.items.length - 1 && styles.rowBorder]}
                activeOpacity={0.85}
                onPress={() => router.push(item.route)}
              >
                <View style={styles.rowIcon}>
                  <Ionicons name={item.icon} size={19} color={colors.primary} />
                </View>
                <View style={styles.rowBody}>
                  <Text style={styles.rowTitle}>{item.title}</Text>
                  <Text style={styles.rowText}>{item.subtitle}</Text>
                </View>
                <Ionicons name="chevron-forward" size={17} color={colors.textSoft} />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 18, paddingBottom: 32 },
  eyebrow: { fontSize: 9.5, fontWeight: '800', letterSpacing: 1.2, color: colors.accent },
  title: { marginTop: 4, fontSize: 24, fontWeight: '900', color: colors.text },
  subtitle: { marginTop: 6, fontSize: 12.5, lineHeight: 19, color: colors.textMuted },
  profileCard: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    padding: 16,
    ...shadow.raised,
  },
  profileIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.light,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileBody: { flex: 1, marginLeft: 12 },
  profileTitle: { fontSize: 14, fontWeight: '900', color: colors.white },
  profileText: { marginTop: 3, fontSize: 11, lineHeight: 16, color: 'rgba(255,255,255,0.82)' },
  section: { marginTop: 22 },
  sectionTitle: { fontSize: 13, fontWeight: '900', color: colors.text, marginBottom: 8 },
  card: { backgroundColor: colors.white, borderRadius: radius.lg, overflow: 'hidden', ...shadow.card },
  row: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.light,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: { flex: 1, marginLeft: 12 },
  rowTitle: { fontSize: 13.5, fontWeight: '800', color: colors.text },
  rowText: { marginTop: 2, fontSize: 10.5, lineHeight: 15, color: colors.textMuted },
});
