import { useEffect, useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import {
  collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc, serverTimestamp, writeBatch,
} from 'firebase/firestore';
import { db, touchProject } from '../firebase';
import { colors } from '../theme';
import ClearableInput from './ClearableInput';

const DEFAULT_GROUP = 'General';
const GROUP_SUGGESTIONS = ['Toiletries', 'Electronics', 'Beauty', 'Clothes'];
const EMPTY_DRAFT = { name: '', ownership: 'shared', group: DEFAULT_GROUP };

export default function PackingModule({ projectId, userId, members, memberNames }) {
  const scrollRef = useRef(null);
  const [items, setItems] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(EMPTY_DRAFT);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'projects', projectId, 'packing_items'), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      setItems(list);
    });
    return unsub;
  }, [projectId]);

  async function togglePacked(item) {
    await updateDoc(doc(db, 'projects', projectId, 'packing_items', item.id), {
      packed: !item.packed, updatedBy: userId, updatedAt: serverTimestamp(),
    });
  }

  async function uncheckAll() {
    const packedItems = items.filter((i) => i.packed);
    if (packedItems.length === 0) return;
    const batch = writeBatch(db);
    packedItems.forEach((i) => {
      batch.update(doc(db, 'projects', projectId, 'packing_items', i.id), { packed: false });
    });
    await batch.commit();
  }

  function startEdit(item) {
    setDraft({ name: item.name || '', ownership: item.ownership || 'shared', group: item.group || DEFAULT_GROUP });
    setEditingId(item.id);
    setShowAdd(true);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }

  function cancelForm() {
    setDraft(EMPTY_DRAFT);
    setEditingId(null);
    setShowAdd(false);
  }

  async function saveItem() {
    if (!draft.name.trim()) return;
    if (editingId) {
      await updateDoc(doc(db, 'projects', projectId, 'packing_items', editingId), {
        name: draft.name.trim(),
        ownership: draft.ownership,
        group: draft.group.trim() || DEFAULT_GROUP,
        updatedAt: serverTimestamp(),
      });
    } else {
      const maxOrder = items.reduce((m, i) => Math.max(m, i.order ?? 0), 0);
      await addDoc(collection(db, 'projects', projectId, 'packing_items'), {
        name: draft.name.trim(),
        ownership: draft.ownership,
        group: draft.group.trim() || DEFAULT_GROUP,
        packed: false,
        order: maxOrder + 1,
        createdBy: userId,
        updatedAt: serverTimestamp(),
      });
    }
    cancelForm();
    touchProject(projectId);
  }

  async function removeItem(id) {
    await deleteDoc(doc(db, 'projects', projectId, 'packing_items', id));
    touchProject(projectId);
  }

  const packedCount = items.filter((i) => i.packed).length;
  const grouped = items.reduce((acc, item) => {
    const g = item.group || DEFAULT_GROUP;
    (acc[g] = acc[g] || []).push(item);
    return acc;
  }, {});

  return (
    <ScrollView ref={scrollRef} contentContainerStyle={styles.container}>
      {items.length === 0 && !showAdd && (
        <Text style={styles.emptyText}>Nothing on the list yet. Add the first item below.</Text>
      )}

      {showAdd ? (
        <View style={[styles.addCard, { marginBottom: 16 }]}>
          <ClearableInput
            style={styles.input}
            placeholder="Item name"
            value={draft.name}
            onChangeText={(v) => setDraft({ ...draft, name: v })}
          />
          <View style={styles.chipRow}>
            {GROUP_SUGGESTIONS.map((g) => (
              <TouchableOpacity
                key={g}
                style={[styles.chip, draft.group === g && styles.chipSelected]}
                onPress={() => setDraft({ ...draft, group: g })}
              >
                <Text style={[styles.chipText, draft.group === g && styles.chipTextSelected]}>{g}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <ClearableInput
            style={styles.input}
            placeholder="Or type a custom group"
            value={draft.group}
            onChangeText={(v) => setDraft({ ...draft, group: v })}
          />
          <View style={styles.pickerWrap}>
            <Picker selectedValue={draft.ownership} onValueChange={(v) => setDraft({ ...draft, ownership: v })}>
              <Picker.Item label="Shared item" value="shared" />
              {members.map((uid) => (
                <Picker.Item key={uid} label={`${memberNames[uid] || uid.slice(0, 8)}${uid === userId ? ' (you)' : ''}`} value={uid} />
              ))}
            </Picker>
          </View>
          <View style={styles.addBtns}>
            <TouchableOpacity style={styles.cancelBtn} onPress={cancelForm}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={saveItem}>
              <Text style={styles.saveText}>{editingId ? 'Update' : 'Save'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity style={[styles.dashedBtn, { marginBottom: 16 }]} onPress={() => setShowAdd(true)}>
          <Text style={styles.dashedText}>+ Add item</Text>
        </TouchableOpacity>
      )}

      {items.length > 0 && (
        <View style={styles.summaryRow}>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={styles.summaryN}>{packedCount}/{items.length}</Text>
            <Text style={styles.summaryL}>PACKED</Text>
          </View>
          {packedCount > 0 && (
            <TouchableOpacity style={styles.uncheckBtn} onPress={uncheckAll}>
              <Text style={styles.uncheckBtnText}>Uncheck all</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {Object.entries(grouped).map(([group, groupItems]) => (
        <View key={group}>
          <Text style={styles.groupLabel}>{group.toUpperCase()}</Text>
          {groupItems.map((item) => (
            <View key={item.id} style={styles.row}>
              <TouchableOpacity
                style={[styles.checkbox, item.packed && styles.checkboxDone]}
                onPress={() => togglePacked(item)}
              >
                {item.packed && <Text style={styles.checkMark}>✓</Text>}
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <Text style={[styles.itemTitle, item.packed && styles.itemDone]}>{item.name}</Text>
                <Text style={styles.assignee}>
                  {item.ownership === 'shared' ? 'shared item' : `${memberNames[item.ownership] || '...'} bringing`}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 8 }}>
                <TouchableOpacity onPress={() => startEdit(item)}>
                  <Text style={styles.editText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => removeItem(item.id)}>
                  <Text style={styles.deleteText}>Delete</Text>
                </TouchableOpacity>
              </View>
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
  summaryRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.tealLight,
    borderRadius: 14, padding: 14, marginBottom: 14,
  },
  uncheckBtn: { borderWidth: 1, borderColor: colors.teal, borderRadius: 8, paddingVertical: 7, paddingHorizontal: 12 },
  uncheckBtnText: { fontSize: 11.5, color: colors.teal, fontWeight: '700' },
  summaryN: { fontSize: 16, fontWeight: '700', color: colors.teal },
  summaryL: { fontSize: 9, color: colors.inkSoft, marginTop: 2 },
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
  editText: { color: colors.teal, fontSize: 11, fontWeight: '600' },
  addCard: { backgroundColor: colors.white, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.line, marginTop: 12 },
  input: {
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line,
    borderRadius: 10, paddingHorizontal: 13, paddingVertical: 11, fontSize: 14, marginBottom: 10,
  },
  pickerWrap: { borderWidth: 1, borderColor: colors.line, borderRadius: 10, marginBottom: 10 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  chip: { borderWidth: 1, borderColor: colors.line, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: colors.white },
  chipSelected: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontSize: 11, color: colors.inkSoft, fontWeight: '600' },
  chipTextSelected: { color: colors.paper },
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
