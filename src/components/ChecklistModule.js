import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import {
  collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc, serverTimestamp,
} from 'firebase/firestore';
import { db, touchProject } from '../firebase';
import { colors } from '../theme';
import ClearableInput from './ClearableInput';

const DEFAULT_CATEGORY = 'General';

export default function ChecklistModule({ projectId, userId, members, memberNames }) {
  const [items, setItems] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [draft, setDraft] = useState({ title: '', category: DEFAULT_CATEGORY, assignedTo: '' });

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'projects', projectId, 'checklist_items'), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      setItems(list);
    });
    return unsub;
  }, [projectId]);

  async function toggleCheck(item) {
    await updateDoc(doc(db, 'projects', projectId, 'checklist_items', item.id), {
      checked: !item.checked, updatedBy: userId, updatedAt: serverTimestamp(),
    });
    touchProject(projectId);
  }

  async function addItem() {
    if (!draft.title.trim()) return;
    const maxOrder = items.reduce((m, i) => Math.max(m, i.order ?? 0), 0);
    await addDoc(collection(db, 'projects', projectId, 'checklist_items'), {
      title: draft.title.trim(),
      category: draft.category.trim() || DEFAULT_CATEGORY,
      assignedTo: draft.assignedTo || null,
      checked: false,
      order: maxOrder + 1,
      createdBy: userId,
      updatedAt: serverTimestamp(),
    });
    setDraft({ title: '', category: DEFAULT_CATEGORY, assignedTo: '' });
    setShowAdd(false);
    touchProject(projectId);
  }

  async function removeItem(id) {
    await deleteDoc(doc(db, 'projects', projectId, 'checklist_items', id));
    touchProject(projectId);
  }

  const grouped = items.reduce((acc, item) => {
    const cat = item.category || DEFAULT_CATEGORY;
    (acc[cat] = acc[cat] || []).push(item);
    return acc;
  }, {});

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {items.length === 0 && !showAdd && (
        <Text style={styles.emptyText}>No tasks yet. Add the first one below.</Text>
      )}

      {showAdd ? (
        <View style={[styles.addCard, { marginBottom: 16 }]}>
          <ClearableInput
            style={styles.input}
            placeholder="Task title"
            value={draft.title}
            onChangeText={(v) => setDraft({ ...draft, title: v })}
          />
          <ClearableInput
            style={styles.input}
            placeholder="Category (e.g. Shopping)"
            value={draft.category}
            onChangeText={(v) => setDraft({ ...draft, category: v })}
          />
          <View style={styles.pickerWrap}>
            <Picker
              selectedValue={draft.assignedTo}
              onValueChange={(v) => setDraft({ ...draft, assignedTo: v })}
            >
              <Picker.Item label="Unassigned" value="" />
              {members.map((uid) => (
                <Picker.Item key={uid} label={memberNames[uid] || uid.slice(0, 8)} value={uid} />
              ))}
            </Picker>
          </View>
          <View style={styles.addBtns}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAdd(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={addItem}>
              <Text style={styles.saveText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity style={[styles.dashedBtn, { marginBottom: 16 }]} onPress={() => setShowAdd(true)}>
          <Text style={styles.dashedText}>+ Add task</Text>
        </TouchableOpacity>
      )}

      {Object.entries(grouped).map(([category, catItems]) => (
        <View key={category}>
          <Text style={styles.groupLabel}>{category.toUpperCase()}</Text>
          {catItems.map((item) => (
            <View key={item.id} style={styles.row}>
              <TouchableOpacity
                style={[styles.checkbox, item.checked && styles.checkboxDone]}
                onPress={() => toggleCheck(item)}
              >
                {item.checked && <Text style={styles.checkMark}>✓</Text>}
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <Text style={[styles.itemTitle, item.checked && styles.itemDone]}>{item.title}</Text>
                <Text style={styles.assignee}>
                  {item.assignedTo ? `${memberNames[item.assignedTo] || '...'} assigned` : 'unassigned'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => removeItem(item.id)}>
                <Text style={styles.deleteText}>Delete</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 4 },
  emptyText: { fontSize: 13, color: colors.inkSoft, textAlign: 'center', marginTop: 16, marginBottom: 4 },
  groupLabel: { fontSize: 13, fontWeight: '800', color: colors.ink, letterSpacing: 0.3, marginTop: 16, marginBottom: 8 },
  row: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: colors.white, borderRadius: 12, padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: colors.line,
  },
  checkbox: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: colors.line,
    alignItems: 'center', justifyContent: 'center', marginTop: 1,
  },
  checkboxDone: { backgroundColor: colors.teal, borderColor: colors.teal },
  checkMark: { color: colors.white, fontSize: 12 },
  itemTitle: { fontSize: 13.5, fontWeight: '600', color: colors.ink },
  itemDone: { color: colors.inkSoft, textDecorationLine: 'line-through' },
  assignee: { fontSize: 10, color: colors.inkSoft, marginTop: 2 },
  deleteText: { color: colors.danger, fontSize: 11 },
  addCard: { backgroundColor: colors.white, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.line, marginTop: 12 },
  input: {
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line,
    borderRadius: 10, paddingHorizontal: 13, paddingVertical: 11, fontSize: 14, marginBottom: 10,
  },
  pickerWrap: { borderWidth: 1, borderColor: colors.line, borderRadius: 10, marginBottom: 10 },
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
