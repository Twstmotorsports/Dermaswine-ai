import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, ActivityIndicator, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadow } from '../../theme';
import { sendMessage } from '../../services/FirebaseService';

const CONTACT_EMAIL = 'dermaswine.ai@gmail.com';

export default function Contact() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const submit = async () => {
    if (!name.trim() || !email.trim() || !message.trim()) {
      Alert.alert('Missing details', 'Please complete all fields before sending.');
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      Alert.alert('Invalid email', 'Please enter a valid email address.');
      return;
    }

    setSending(true);
    const result = await sendMessage({ name: name.trim(), email: email.trim(), message: message.trim() });
    setSending(false);

    if (!result.success) {
      Alert.alert('Could not send', result.error);
      return;
    }

    setName('');
    setEmail('');
    setMessage('');
    Alert.alert('Message sent', 'Thank you. The DermaSwine AI team will get back to you shortly.');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.back} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}>
          <Ionicons name="chevron-back" size={20} color={colors.primary} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Contact</Text>
        <View style={styles.headerSpacer} />
      </View>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.eyebrow}>CONTACT</Text>
        <Text style={styles.title}>Talk to the DermaSwine AI team</Text>
        <Text style={styles.subtitle}>
          Questions about screening, farm records, deployment, or the dataset? Send a message and the team will respond.
        </Text>

        <View style={styles.infoRow}>
          <View style={styles.infoCard}>
            <Ionicons name="location-outline" size={18} color={colors.primary} />
            <Text style={styles.infoLabel}>Coverage</Text>
            <Text style={styles.infoValue}>Davao Region, PH</Text>
          </View>
          <TouchableOpacity style={styles.infoCard} onPress={() => Linking.openURL(`mailto:${CONTACT_EMAIL}`)}>
            <Ionicons name="mail-outline" size={18} color={colors.primary} />
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue} numberOfLines={1}>{CONTACT_EMAIL}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Send a message</Text>

          <Text style={styles.label}>Name</Text>
          <TextInput style={styles.input} placeholder="Your name" placeholderTextColor={colors.textSoft} value={name} onChangeText={setName} />

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="you@example.com"
            placeholderTextColor={colors.textSoft}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <Text style={styles.label}>Message</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="How can we help?"
            placeholderTextColor={colors.textSoft}
            value={message}
            onChangeText={setMessage}
            multiline
            textAlignVertical="top"
          />

          <TouchableOpacity style={[styles.submit, sending && styles.submitDisabled]} onPress={submit} disabled={sending} activeOpacity={0.85}>
            {sending ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <>
                <Ionicons name="send-outline" size={16} color={colors.white} />
                <Text style={styles.submitText}>Send Message</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.note}>
          <Ionicons name="time-outline" size={16} color={colors.primary} />
          <Text style={styles.noteText}>
            Typical response time is 1-2 business days. For urgent animal health concerns, contact your local veterinarian immediately.
          </Text>
        </View>
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
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 18, paddingBottom: 32 },
  eyebrow: { fontSize: 9.5, fontWeight: '800', letterSpacing: 1.2, color: colors.accent },
  title: { marginTop: 4, fontSize: 23, fontWeight: '900', color: colors.text },
  subtitle: { marginTop: 6, fontSize: 12.5, lineHeight: 19, color: colors.textMuted },
  infoRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  infoCard: { flex: 1, backgroundColor: colors.white, borderRadius: radius.lg, padding: 14, ...shadow.card },
  infoLabel: { marginTop: 7, fontSize: 9.5, fontWeight: '800', letterSpacing: 0.8, color: colors.textSoft },
  infoValue: { marginTop: 3, fontSize: 12, fontWeight: '700', color: colors.text },
  formCard: { marginTop: 16, backgroundColor: colors.white, borderRadius: radius.lg, padding: 16, ...shadow.card },
  formTitle: { fontSize: 15, fontWeight: '900', color: colors.text, marginBottom: 4 },
  label: { marginTop: 12, marginBottom: 6, fontSize: 11.5, fontWeight: '800', color: colors.text },
  input: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 11, fontSize: 13, color: colors.text },
  textArea: { minHeight: 110 },
  submit: { marginTop: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: colors.accent, borderRadius: radius.md, paddingVertical: 13 },
  submitDisabled: { opacity: 0.6 },
  submitText: { color: colors.white, fontSize: 13.5, fontWeight: '800' },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 16, backgroundColor: colors.lightAlt, borderRadius: radius.md, padding: 12, borderWidth: 1, borderColor: colors.border },
  noteText: { flex: 1, fontSize: 10.5, lineHeight: 16, color: colors.textMuted },
});
