import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { collection, addDoc, setDoc, doc, serverTimestamp } from 'firebase/firestore';
import { useNavigation } from '@react-navigation/native';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { colors } from '../theme';
import ClearableInput from '../components/ClearableInput';

const MODULE_OPTIONS = [
  { key: 'itinerary', icon: '🗺', label: 'Itinerary' },
  { key: 'calendar', icon: '📅', label: 'Calendar' },
  { key: 'checklist', icon: '✓', label: 'Checklist' },
  { key: 'rsvp', icon: '👥', label: 'Guests' },
  { key: 'budget', icon: '💰', label: 'Expenses' },
  { key: 'packing', icon: '🎒', label: 'Packing' },
  { key: 'album', icon: '📷', label: 'Album' },
];

function randomToken() {
  return Math.random().toString(36).slice(2, 10);
}

export default function NewProjectScreen() {
  const [name, setName] = useState('');
  const [selected, setSelected] = useState(['itinerary']);
  const { user } = useAuth();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  function toggleModule(key) {
    setSelected((prev) => (prev.includes(key) ? prev.filter((m) => m !== key) : [...prev, key]));
  }

  async function createProject() {
    if (!name.trim() || selected.length === 0) return;
    const inviteToken = randomToken();
    const ref = await addDoc(collection(db, 'projects'), {
      name: name.trim(),
      ownerId: user.uid,
      members: [user.uid],
      modules: selected,
      inviteToken,
      status: 'planned',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await setDoc(doc(db, 'invites', inviteToken), { projectId: ref.id });
    navigation.replace('ProjectDetail', { projectId: ref.id });
  }

  return (
    <View style={styles.safe}>
      <LinearGradient
        colors={[colors.headerGradientStart, colors.headerGradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 10 }]}
      >
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Home</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New project</Text>
        <Text style={styles.headerSub}>Pick one or more modules, then name it.</Text>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.grid}>
          {MODULE_OPTIONS.map((m) => (
            <TouchableOpacity
              key={m.key}
              style={[styles.moduleCard, selected.includes(m.key) && styles.moduleCardSelected]}
              onPress={() => toggleModule(m.key)}
            >
              <View style={styles.moduleIcon}><Text style={{ fontSize: 17 }}>{m.icon}</Text></View>
              <Text style={styles.moduleLabel}>{m.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>PROJECT NAME</Text>
        <ClearableInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. Bali Trip" />

        <TouchableOpacity
          style={[styles.button, (!name.trim() || selected.length === 0) && styles.buttonDisabled]}
          onPress={createProject}
          disabled={!name.trim() || selected.length === 0}
        >
          <Text style={styles.buttonText}>Create project</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { padding: 18, paddingBottom: 60 },
  back: { fontSize: 12, color: colors.inkSoft, marginBottom: 12 },
  header: {
    borderBottomLeftRadius: 24, borderBottomRightRadius: 24,
    paddingHorizontal: 20, paddingBottom: 20,
  },
  headerTitle: { fontSize: 24, fontWeight: '700', color: colors.ink },
  headerSub: { fontSize: 13, color: colors.inkSoft, marginTop: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 18, marginBottom: 20 },
  moduleCard: {
    width: '47%', backgroundColor: colors.white, borderRadius: 16, padding: 14,
    borderWidth: 1.5, borderColor: colors.line,
  },
  moduleCardSelected: { borderColor: colors.ink },
  moduleIcon: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: colors.tealLight,
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  moduleLabel: { fontSize: 13.5, fontWeight: '700', color: colors.ink },
  label: { fontSize: 10, color: colors.inkSoft, letterSpacing: 0.5, marginBottom: 6 },
  input: {
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line,
    borderRadius: 10, paddingHorizontal: 13, paddingVertical: 11, fontSize: 15, marginBottom: 16,
  },
  button: { backgroundColor: colors.amber, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: colors.white, fontWeight: '700', fontSize: 14 },
});
