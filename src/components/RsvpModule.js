import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import {
  collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc,
} from 'firebase/firestore';
import { db, touchProject } from '../firebase';
import ClearableInput from './ClearableInput';
import { colors } from '../theme';

const STATUS_OPTIONS = [
  { key: 'yes', label: 'Yes', color: colors.teal },
  { key: 'no', label: 'No', color: colors.danger },
  { key: 'pending', label: 'Pending', color: colors.amberDeep },
];

export default function RsvpModule({ projectId, userId }) {
  const [guests, setGuests] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [draft, setDraft] = useState({ guestName: '', adults: '1', kids: '0' });

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'projects', projectId, 'rsvp_entries'), (snap) => {
      setGuests(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [projectId]);

  async function setStatus(guest, status) {
    await updateDoc(doc(db, 'projects', projectId, 'rsvp_entries', guest.id), { status });
  }

  async function addGuest() {
    if (!draft.guestName.trim()) return;
    await addDoc(collection(db, 'projects', projectId, 'rsvp_entries'), {
      guestName: draft.guestName.trim(),
      status: 'pending',
      adults: Number(draft.adults) || 0,
      kids: Number(draft.kids) || 0,
      createdBy: userId,
    });
    setDraft({ guestName: '', adults: '1', kids: '0' });
    setShowAdd(false);
    touchProject(projectId);
  }

  async function removeGuest(id) {
    await deleteDoc(doc(db, 'projects', projectId, 'rsvp_entries', id));
    touchProject(projectId);
  }

  const confirmed = guests.filter((g) => g.status === 'yes');
  const totalAdults = confirmed.reduce((s, g) => s + (g.adults || 0), 0);
  const totalKids = confirmed.reduce((s, g) => s + (g.kids || 0), 0);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {guests.length === 0 && !showAdd && (
        <Text style={styles.emptyText}>No guests yet. Add the first one below.</Text>
      )}

      {showAdd ? (
        <View style={[styles.addCard, { marginBottom: 16 }]}>
          <ClearableInput
            style={styles.input}
            placeholder="Guest / family name"
            value={draft.guestName}
            onChangeText={(v) => setDraft({ ...draft, guestName: v })}
          />
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>ADULTS</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={draft.adults}
                onChangeText={(v) => setDraft({ ...draft, adults: v })}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>KIDS</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={draft.kids}
                onChangeText={(v) => setDraft({ ...draft, kids: v })}
              />
            </View>
          </View>
          <View style={styles.addBtns}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAdd(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={addGuest}>
              <Text style={styles.saveText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity style={[styles.dashedBtn, { marginBottom: 16 }]} onPress={() => setShowAdd(true)}>
          <Text style={styles.dashedText}>+ Add guest</Text>
        </TouchableOpacity>
      )}

      {guests.length > 0 && (
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryN}>{confirmed.length}/{guests.length}</Text>
            <Text style={styles.summaryL}>CONFIRMED</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryN}>{totalAdults}A {totalKids}K</Text>
            <Text style={styles.summaryL}>ADULTS / KIDS</Text>
          </View>
        </View>
      )}

      {guests.map((g) => (
        <View key={g.id} style={styles.dataRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.who}>{g.guestName}</Text>
            <Text style={styles.what}>{g.adults || 0} adults{g.kids ? `, ${g.kids} kids` : ''}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 4 }}>
            {STATUS_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={[styles.badge, { borderColor: opt.color, opacity: g.status === opt.key ? 1 : 0.35 }]}
                onPress={() => setStatus(g, opt.key)}
              >
                <Text style={[styles.badgeText, { color: opt.color }]}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity onPress={() => removeGuest(g.id)}>
            <Text style={styles.deleteText}>Delete</Text>
          </TouchableOpacity>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 4 },
  emptyText: { fontSize: 13, color: colors.inkSoft, textAlign: 'center', marginTop: 16, marginBottom: 4 },
  summaryRow: { flexDirection: 'row', backgroundColor: colors.tealLight, borderRadius: 14, padding: 14, marginBottom: 14 },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryN: { fontSize: 15, fontWeight: '700', color: colors.teal },
  summaryL: { fontSize: 9, color: colors.inkSoft, marginTop: 2 },
  dataRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: colors.line,
  },
  who: { fontSize: 13.5, fontWeight: '600', color: colors.ink },
  what: { fontSize: 10, color: colors.inkSoft, marginTop: 1 },
  badge: { borderWidth: 1, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 8 },
  badgeText: { fontSize: 9, fontWeight: '700' },
  deleteText: { color: colors.danger, fontSize: 11, marginLeft: 4 },
  addCard: { backgroundColor: colors.white, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.line, marginTop: 12 },
  input: {
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line,
    borderRadius: 10, paddingHorizontal: 13, paddingVertical: 11, fontSize: 14, marginBottom: 10,
  },
  label: { fontSize: 10, color: colors.inkSoft, letterSpacing: 0.5, marginBottom: 6 },
  addBtns: { flexDirection: 'row', gap: 8 },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: colors.line, borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  cancelText: { color: colors.ink, fontSize: 13, fontWeight: '600' },
  saveBtn: { flex: 1, backgroundColor: colors.amber, borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  saveText: { color: colors.white, fontSize: 13, fontWeight: '700' },
  dashedBtn: {
    borderWidth: 1.5, borderColor: colors.line, borderStyle: 'dashed', borderRadius: 14,
    paddingVertical: 14, alignItems: 'center', marginTop: 12,
  },
  dashedText: { color: colors.inkSoft, fontSize: 13, fontWeight: '600' },
});
