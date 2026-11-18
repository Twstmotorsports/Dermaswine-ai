import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadow } from '../../theme';
import {
  getCurrentUser,
  subscribeToAuth,
  subscribeToFarms,
  subscribeToPigs,
  saveFarm,
  deleteFarm,
  savePig,
  deletePig,
} from '../../services/FirebaseService';

const emptyFarm = { name: '', farmIdentification: '', location: '', contact: '', notes: '' };
const emptyPig = { farmId: '', farmName: '', pigId: '', breed: '', age: '', gender: '', weight: '', healthStatus: 'Healthy', notes: '' };

function Field({ label, value, onChangeText, placeholder, keyboardType }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textSoft}
        keyboardType={keyboardType}
      />
    </View>
  );
}

export default function FarmManagement() {
  const router = useRouter();
  const [user, setUser] = useState(getCurrentUser());
  const [farms, setFarms] = useState([]);
  const [pigs, setPigs] = useState([]);
  const [selectedFarmId, setSelectedFarmId] = useState(null);

  const [farmModal, setFarmModal] = useState(false);
  const [pigModal, setPigModal] = useState(false);
  const [farmDraft, setFarmDraft] = useState(emptyFarm);
  const [pigDraft, setPigDraft] = useState(emptyPig);
  const [editingFarmId, setEditingFarmId] = useState(null);
  const [editingPigId, setEditingPigId] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsubAuth = subscribeToAuth(setUser);
    const unsubFarms = subscribeToFarms(setFarms);
    const unsubPigs = subscribeToPigs(setPigs);
    return () => {
      unsubAuth?.();
      unsubFarms?.();
      unsubPigs?.();
    };
  }, []);

  const selectedFarm = useMemo(() => {
    if (farms.length === 0) return null;
    if (selectedFarmId && farms.some((f) => f.id === selectedFarmId)) {
      return farms.find((f) => f.id === selectedFarmId) || null;
    }
    return farms[0];
  }, [farms, selectedFarmId]);

  const farmPigs = useMemo(
    () => pigs.filter((p) => p.farmId === (selectedFarm?.id || '')),
    [pigs, selectedFarm]
  );

  const openFarmModal = (farm = null) => {
    if (farm) {
      setEditingFarmId(farm.id);
      setFarmDraft({
        name: farm.name || '',
        farmIdentification: farm.farmIdentification || '',
        location: farm.location || '',
        contact: farm.contact || '',
        notes: farm.notes || '',
      });
    } else {
      setEditingFarmId(null);
      setFarmDraft(emptyFarm);
    }
    setFarmModal(true);
  };

  const openPigModal = (pig = null) => {
    if (!selectedFarm && !pig) {
      Alert.alert('Add a farm first', 'Register a farm before adding individual pigs.');
      return;
    }
    if (pig) {
      setEditingPigId(pig.id);
      setPigDraft({
        farmId: pig.farmId || selectedFarm?.id || '',
        farmName: pig.farmName || selectedFarm?.name || '',
        pigId: pig.pigId || '',
        breed: pig.breed || '',
        age: pig.age || '',
        gender: pig.gender || '',
        weight: pig.weight || '',
        healthStatus: pig.healthStatus || 'Healthy',
        notes: pig.notes || '',
      });
    } else {
      setEditingPigId(null);
      setPigDraft({ ...emptyPig, farmId: selectedFarm.id, farmName: selectedFarm.name || '' });
    }
    setPigModal(true);
  };

  const onSaveFarm = async () => {
    if (!farmDraft.name.trim()) {
      Alert.alert('Farm name required', 'Enter a farm name to continue.');
      return;
    }
    setSaving(true);
    const res = await saveFarm({ ...farmDraft, id: editingFarmId || undefined });
    setSaving(false);
    if (!res.success) return Alert.alert('Could not save farm', res.error);
    setFarmModal(false);
    if (!editingFarmId && res.id) setSelectedFarmId(res.id);
  };

  const onSavePig = async () => {
    if (!pigDraft.pigId.trim()) {
      Alert.alert('Pig ID required', 'Enter a pig ID to continue.');
      return;
    }
    const farm = farms.find((f) => f.id === (pigDraft.farmId || selectedFarm?.id));
    if (!farm) {
      Alert.alert('Farm required', 'Select a farm for this pig.');
      return;
    }
    setSaving(true);
    const res = await savePig({
      ...pigDraft,
      id: editingPigId || undefined,
      farmId: farm.id,
      farmName: farm.name || '',
      healthStatus: pigDraft.healthStatus || 'Healthy',
    });
    setSaving(false);
    if (!res.success) return Alert.alert('Could not save pig', res.error);
    setPigModal(false);
  };

  const onDeleteFarm = (farm) => {
    Alert.alert('Delete farm?', `Remove ${farm.name} and its local pig records from this device/account view?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteFarm(farm.id);
          if (selectedFarmId === farm.id) setSelectedFarmId(null);
        },
      },
    ]);
  };

  const onDeletePig = (pig) => {
    Alert.alert('Delete pig?', `Remove pig ${pig.pigId}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => deletePig(pig.id) },
    ]);
  };

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const healthColor = (status) => {
    const s = String(status || '').toLowerCase();
    if (s === 'healthy') return colors.healthy;
    if (s.includes('suspect') || s.includes('condition') || s.includes('disease')) return colors.danger;
    return colors.warning;
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.back} onPress={goBack}>
          <Ionicons name="chevron-back" size={20} color={colors.primary} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Farm Management</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => openFarmModal()}>
          <Ionicons name="add" size={18} color={colors.white} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.eyebrow}>FARMS & PIGS</Text>
        <Text style={styles.title}>Register and track your herd</Text>
        <Text style={styles.subtitle}>
          Register farms and individual pigs. After each screening, a linked pig&apos;s health status is updated automatically.
        </Text>

        {!user && (
          <View style={styles.notice}>
            <Ionicons name="information-circle-outline" size={16} color={colors.primary} />
            <Text style={styles.noticeText}>
              You can manage records on this device now. Sign in to sync farms, pigs, screenings, and reports to Firebase.
            </Text>
          </View>
        )}

        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Farms</Text>
          <TouchableOpacity onPress={() => openFarmModal()}>
            <Text style={styles.link}>+ Add farm</Text>
          </TouchableOpacity>
        </View>

        {farms.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="business-outline" size={26} color={colors.primary} />
            <Text style={styles.emptyTitle}>No farms yet</Text>
            <Text style={styles.emptyText}>Add a farm to start registering pigs and saving screenings with farm identification.</Text>
            <TouchableOpacity style={styles.primary} onPress={() => openFarmModal()}>
              <Text style={styles.primaryText}>Register Farm</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.farmChips}>
            {farms.map((farm) => {
              const active = farm.id === selectedFarm?.id;
              return (
                <TouchableOpacity
                  key={farm.id}
                  style={[styles.farmChip, active && styles.farmChipActive]}
                  onPress={() => setSelectedFarmId(farm.id)}
                  onLongPress={() => onDeleteFarm(farm)}
                >
                  <Text style={[styles.farmChipText, active && styles.farmChipTextActive]} numberOfLines={1}>
                    {farm.name}
                  </Text>
                  {!!farm.farmIdentification && (
                    <Text style={[styles.farmChipSub, active && styles.farmChipTextActive]} numberOfLines={1}>
                      {farm.farmIdentification}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {selectedFarm && (
          <View style={styles.farmCard}>
            <View style={styles.farmCardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.farmName}>{selectedFarm.name}</Text>
                <Text style={styles.farmMeta}>
                  {[selectedFarm.farmIdentification, selectedFarm.location].filter(Boolean).join(' • ') || 'No identification/location set'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => openFarmModal(selectedFarm)} style={styles.iconBtn}>
                <Ionicons name="create-outline" size={17} color={colors.primary} />
              </TouchableOpacity>
            </View>
            {!!selectedFarm.contact && <Text style={styles.farmDetail}>Contact: {selectedFarm.contact}</Text>}
            {!!selectedFarm.notes && <Text style={styles.farmDetail}>Notes: {selectedFarm.notes}</Text>}
          </View>
        )}

        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Pigs {selectedFarm ? `(${farmPigs.length})` : ''}</Text>
          <TouchableOpacity onPress={() => openPigModal()} disabled={!selectedFarm}>
            <Text style={[styles.link, !selectedFarm && { opacity: 0.4 }]}>+ Add pig</Text>
          </TouchableOpacity>
        </View>

        {!selectedFarm ? null : farmPigs.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="paw-outline" size={24} color={colors.primary} />
            <Text style={styles.emptyTitle}>No pigs registered</Text>
            <Text style={styles.emptyText}>Add pigs with ID, breed, age, gender, weight, and health status.</Text>
          </View>
        ) : (
          farmPigs.map((pig) => (
            <TouchableOpacity key={pig.id} style={styles.pigCard} activeOpacity={0.85} onPress={() => openPigModal(pig)}>
              <View style={styles.pigHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.pigTitle}>Pig ID: {pig.pigId}</Text>
                  <Text style={styles.pigMeta}>{[pig.breed, pig.gender, pig.age ? `${pig.age}` : '', pig.weight ? `${pig.weight}` : ''].filter(Boolean).join(' • ') || 'No details'}</Text>
                </View>
                <View style={[styles.statusPill, { backgroundColor: `${healthColor(pig.healthStatus)}22` }]}>
                  <Text style={[styles.statusText, { color: healthColor(pig.healthStatus) }]}>{pig.healthStatus || 'Unknown'}</Text>
                </View>
              </View>
              {!!pig.lastScreeningDisease && (
                <Text style={styles.pigLast}>Last screening: {pig.lastScreeningDisease} {pig.lastScreeningId ? `(${pig.lastScreeningId})` : ''}</Text>
              )}
              <View style={styles.pigActions}>
                <TouchableOpacity onPress={() => openPigModal(pig)}><Text style={styles.actionText}>Edit</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => onDeletePig(pig)}><Text style={[styles.actionText, { color: colors.danger }]}>Delete</Text></TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))
        )}

        <View style={styles.tipCard}>
          <Ionicons name="bulb-outline" size={16} color={colors.accent} />
          <Text style={styles.tipText}>
            Tip: Link a pig during screening so the app can save the screening record and automatically update that pig&apos;s health status based on the prediction.
          </Text>
        </View>
      </ScrollView>

      <Modal visible={farmModal} animationType="slide" transparent onRequestClose={() => setFarmModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{editingFarmId ? 'Edit Farm' : 'Register Farm'}</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Field label="Farm name *" value={farmDraft.name} onChangeText={(v) => setFarmDraft((d) => ({ ...d, name: v }))} placeholder="e.g. Davao Swine Farm" />
              <Field label="Farm identification" value={farmDraft.farmIdentification} onChangeText={(v) => setFarmDraft((d) => ({ ...d, farmIdentification: v }))} placeholder="Farm ID / code" />
              <Field label="Location" value={farmDraft.location} onChangeText={(v) => setFarmDraft((d) => ({ ...d, location: v }))} placeholder="Barangay, city, province" />
              <Field label="Contact" value={farmDraft.contact} onChangeText={(v) => setFarmDraft((d) => ({ ...d, contact: v }))} placeholder="Phone or contact person" />
              <Field label="Notes" value={farmDraft.notes} onChangeText={(v) => setFarmDraft((d) => ({ ...d, notes: v }))} placeholder="Optional notes" />
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => setFarmModal(false)}><Text style={styles.secondaryText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={styles.primaryBtn} onPress={onSaveFarm} disabled={saving}><Text style={styles.primaryBtnText}>{saving ? 'Saving...' : 'Save'}</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={pigModal} animationType="slide" transparent onRequestClose={() => setPigModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{editingPigId ? 'Edit Pig' : 'Register Pig'}</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Field label="Pig ID *" value={pigDraft.pigId} onChangeText={(v) => setPigDraft((d) => ({ ...d, pigId: v }))} placeholder="e.g. PIG-001" />
              <Field label="Breed" value={pigDraft.breed} onChangeText={(v) => setPigDraft((d) => ({ ...d, breed: v }))} placeholder="Breed" />
              <Field label="Age" value={pigDraft.age} onChangeText={(v) => setPigDraft((d) => ({ ...d, age: v }))} placeholder="e.g. 3 months" />
              <Field label="Gender" value={pigDraft.gender} onChangeText={(v) => setPigDraft((d) => ({ ...d, gender: v }))} placeholder="Male / Female" />
              <Field label="Weight" value={pigDraft.weight} onChangeText={(v) => setPigDraft((d) => ({ ...d, weight: v }))} placeholder="e.g. 45 kg" />
              <Field label="Health status" value={pigDraft.healthStatus} onChangeText={(v) => setPigDraft((d) => ({ ...d, healthStatus: v }))} placeholder="Healthy / Suspected condition" />
              <Field label="Notes" value={pigDraft.notes} onChangeText={(v) => setPigDraft((d) => ({ ...d, notes: v }))} placeholder="Optional notes" />
              <Text style={styles.helper}>After screening, linked pig health status updates automatically based on the predicted disease.</Text>
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => setPigModal(false)}><Text style={styles.secondaryText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={styles.primaryBtn} onPress={onSavePig} disabled={saving}><Text style={styles.primaryBtnText}>{saving ? 'Saving...' : 'Save'}</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  back: { width: 70, flexDirection: 'row', alignItems: 'center' },
  backText: { marginLeft: 2, fontSize: 12.5, fontWeight: '700', color: colors.primary },
  headerTitle: { fontSize: 15, fontWeight: '900', color: colors.text },
  addBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 18, paddingBottom: 40 },
  eyebrow: { fontSize: 9.5, fontWeight: '800', letterSpacing: 1.2, color: colors.accent },
  title: { marginTop: 4, fontSize: 24, fontWeight: '900', color: colors.text },
  subtitle: { marginTop: 6, fontSize: 12.5, lineHeight: 19, color: colors.textMuted },
  notice: { marginTop: 14, flexDirection: 'row', gap: 8, backgroundColor: colors.light, borderRadius: radius.md, padding: 12 },
  noticeText: { flex: 1, fontSize: 10.5, lineHeight: 15, color: colors.primary },
  sectionRow: { marginTop: 22, marginBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 16, fontWeight: '900', color: colors.text },
  link: { fontSize: 12, fontWeight: '800', color: colors.primary },
  emptyCard: { backgroundColor: colors.white, borderRadius: radius.lg, padding: 18, alignItems: 'center', ...shadow.card },
  emptyTitle: { marginTop: 8, fontSize: 15, fontWeight: '900', color: colors.text },
  emptyText: { marginTop: 5, fontSize: 11.5, lineHeight: 17, color: colors.textMuted, textAlign: 'center' },
  primary: { marginTop: 12, backgroundColor: colors.accent, borderRadius: radius.md, paddingHorizontal: 16, paddingVertical: 10 },
  primaryText: { color: colors.white, fontWeight: '800', fontSize: 12 },
  farmChips: { gap: 8, paddingVertical: 4 },
  farmChip: { backgroundColor: colors.white, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: colors.border, minWidth: 120 },
  farmChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  farmChipText: { fontSize: 12.5, fontWeight: '800', color: colors.text },
  farmChipSub: { marginTop: 2, fontSize: 10, color: colors.textSoft },
  farmChipTextActive: { color: colors.white },
  farmCard: { marginTop: 10, backgroundColor: colors.white, borderRadius: radius.lg, padding: 14, ...shadow.card },
  farmCardHeader: { flexDirection: 'row', alignItems: 'center' },
  farmName: { fontSize: 14.5, fontWeight: '900', color: colors.text },
  farmMeta: { marginTop: 2, fontSize: 10.5, color: colors.textMuted },
  farmDetail: { marginTop: 6, fontSize: 10.5, color: colors.textMuted },
  iconBtn: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.light, alignItems: 'center', justifyContent: 'center' },
  pigCard: { backgroundColor: colors.white, borderRadius: radius.lg, padding: 14, marginBottom: 10, ...shadow.card },
  pigHeader: { flexDirection: 'row', alignItems: 'center' },
  pigTitle: { fontSize: 13.5, fontWeight: '900', color: colors.text },
  pigMeta: { marginTop: 3, fontSize: 10.5, color: colors.textMuted },
  pigLast: { marginTop: 8, fontSize: 10.5, color: colors.primary, fontWeight: '600' },
  statusPill: { borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 4, marginLeft: 8 },
  statusText: { fontSize: 9.5, fontWeight: '800' },
  pigActions: { marginTop: 10, flexDirection: 'row', gap: 16 },
  actionText: { fontSize: 11.5, fontWeight: '800', color: colors.primary },
  tipCard: { marginTop: 14, flexDirection: 'row', gap: 8, backgroundColor: '#FFF8E6', borderRadius: radius.md, padding: 12 },
  tipText: { flex: 1, fontSize: 10.5, lineHeight: 15, color: '#8A5A00' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  modalCard: { maxHeight: '88%', backgroundColor: colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 18 },
  modalTitle: { fontSize: 17, fontWeight: '900', color: colors.text, marginBottom: 8 },
  field: { marginTop: 10 },
  label: { fontSize: 11, fontWeight: '800', color: colors.text, marginBottom: 5 },
  input: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: colors.text },
  helper: { marginTop: 10, fontSize: 10.5, lineHeight: 15, color: colors.textMuted },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  secondaryBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: radius.md, backgroundColor: colors.light },
  secondaryText: { color: colors.primary, fontWeight: '800' },
  primaryBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: radius.md, backgroundColor: colors.accent },
  primaryBtnText: { color: colors.white, fontWeight: '800' },
});
