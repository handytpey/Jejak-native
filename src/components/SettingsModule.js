import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { colors } from '../theme';
import { confirmAction } from '../utils/confirm';

const STATUS_OPTIONS = [
  { key: 'planned', label: 'Planned' },
  { key: 'active', label: 'Active' },
  { key: 'completed', label: 'Completed' },
  { key: 'archived', label: 'Archived' },
];

const AVAILABLE_MODULES = [
  { key: 'itinerary', label: 'Itinerary' },
  { key: 'calendar', label: 'Calendar' },
  { key: 'checklist', label: 'Checklist' },
  { key: 'rsvp', label: 'Guests' },
  { key: 'budget', label: 'Expenses' },
  { key: 'packing', label: 'Packing' },
  { key: 'album', label: 'Album' },
];

export default function SettingsModule({ project, userId, memberNames }) {
  const isOwner = project.ownerId === userId;
  const modules = project.modules || [];

  async function setStatus(status) {
    await updateDoc(doc(db, 'projects', project.id), { status, updatedAt: serverTimestamp() });
  }

  async function moveModule(index, direction) {
    const swapIndex = index + direction;
    if (swapIndex < 0 || swapIndex >= modules.length) return;
    const reordered = [...modules];
    [reordered[index], reordered[swapIndex]] = [reordered[swapIndex], reordered[index]];
    await updateDoc(doc(db, 'projects', project.id), { modules: reordered });
  }

  async function addModule(key) {
    if (modules.includes(key)) return;
    await updateDoc(doc(db, 'projects', project.id), { modules: [...modules, key] });
  }

  async function removeModule(key) {
    await updateDoc(doc(db, 'projects', project.id), { modules: modules.filter((m) => m !== key) });
  }

  async function removeMember(uid) {
    const updated = (project.members || []).filter((m) => m !== uid);
    await updateDoc(doc(db, 'projects', project.id), { members: updated });
  }

  async function confirmLeave() {
    const ok = await confirmAction('Leave project?', 'Are you sure you want to leave this project?', 'Leave');
    if (ok) await removeMember(userId);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={styles.label}>STATUS</Text>
      <View style={styles.chipRow}>
        {STATUS_OPTIONS.map((s) => (
          <TouchableOpacity
            key={s.key}
            style={[styles.chip, (project.status || 'planned') === s.key && styles.chipSelected]}
            onPress={() => setStatus(s.key)}
          >
            <Text style={[styles.chipText, (project.status || 'planned') === s.key && styles.chipTextSelected]}>
              {s.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[styles.label, { marginTop: 20 }]}>TAB ORDER</Text>
      {modules.map((m, i) => (
        <View key={m} style={styles.row}>
          <Text style={styles.rowText}>{AVAILABLE_MODULES.find((x) => x.key === m)?.label || m}</Text>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <TouchableOpacity style={styles.smallBtn} onPress={() => moveModule(i, -1)} disabled={i === 0}>
              <Text style={styles.smallBtnText}>↑</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.smallBtn} onPress={() => moveModule(i, 1)} disabled={i === modules.length - 1}>
              <Text style={styles.smallBtnText}>↓</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.smallBtn} onPress={() => removeModule(m)}>
              <Text style={[styles.smallBtnText, { color: colors.danger }]}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}

      <View style={styles.chipRow}>
        {AVAILABLE_MODULES.filter((m) => !modules.includes(m.key)).map((m) => (
          <TouchableOpacity key={m.key} style={styles.chip} onPress={() => addModule(m.key)}>
            <Text style={styles.chipText}>+ {m.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[styles.label, { marginTop: 20 }]}>MEMBERS</Text>
      {(project.members || []).map((uid) => (
        <View key={uid} style={styles.row}>
          <Text style={styles.rowText}>
            {memberNames[uid] || 'Loading...'}{uid === project.ownerId ? ' (owner)' : ''}
          </Text>
          {isOwner && uid !== project.ownerId && (
            <TouchableOpacity style={styles.removeBtn} onPress={() => removeMember(uid)}>
              <Text style={styles.removeBtnText}>Remove</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}

      {!isOwner && (
        <TouchableOpacity style={styles.leaveBtn} onPress={confirmLeave}>
          <Text style={styles.leaveBtnText}>Leave project</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 4 },
  label: { fontSize: 10, color: colors.inkSoft, letterSpacing: 0.5, marginBottom: 10 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  chip: { borderWidth: 1, borderColor: colors.line, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 12, backgroundColor: colors.white },
  chipSelected: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontSize: 11.5, color: colors.inkSoft, fontWeight: '700' },
  chipTextSelected: { color: colors.paper },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.line,
  },
  rowText: { fontSize: 13, color: colors.ink },
  smallBtn: { width: 26, height: 24, borderRadius: 6, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  smallBtnText: { fontSize: 11, color: colors.inkSoft },
  removeBtn: { borderWidth: 1, borderColor: colors.line, borderRadius: 8, paddingVertical: 5, paddingHorizontal: 10 },
  removeBtnText: { fontSize: 10.5, color: colors.danger, fontWeight: '600' },
  leaveBtn: { borderWidth: 1, borderColor: '#E2A5A5', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 24 },
  leaveBtnText: { color: colors.danger, fontWeight: '700', fontSize: 13 },
});
