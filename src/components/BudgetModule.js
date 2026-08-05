import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import Lightbox from './Lightbox';
import ClearableInput from './ClearableInput';
import {
  collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc, serverTimestamp,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, touchProject } from '../firebase';
import { colors } from '../theme';
import { formatCurrency } from '../utils/format';

const DEFAULT_CATEGORY = 'General';
const CATEGORY_SUGGESTIONS = ['Food', 'Transport', 'Hotel', 'Shopping'];
const CURRENCIES = ['IDR', 'USD', 'EUR', 'SGD', 'MYR', 'JPY', 'AUD', 'GBP'];

const EMPTY_DRAFT = (userId, members) => ({
  title: '', amount: '', currency: 'IDR', category: DEFAULT_CATEGORY,
  paidBy: userId, splitAmong: members, receiptUrl: null,
});

export default function BudgetModule({ projectId, userId, members, memberNames }) {
  const [entries, setEntries] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(EMPTY_DRAFT(userId, members));
  const [receiptUri, setReceiptUri] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [lightboxImages, setLightboxImages] = useState(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'projects', projectId, 'budget_entries'), (snap) => {
      setEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [projectId]);

  function toggleSplit(uid) {
    setDraft((d) => ({
      ...d,
      splitAmong: d.splitAmong.includes(uid) ? d.splitAmong.filter((x) => x !== uid) : [...d.splitAmong, uid],
    }));
  }

  async function pickReceipt() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    if (!result.canceled) setReceiptUri(result.assets[0].uri);
  }

  function startEdit(entry) {
    setDraft({
      title: entry.title, amount: String(entry.amount), currency: entry.currency || 'IDR',
      category: entry.category || DEFAULT_CATEGORY, paidBy: entry.paidBy,
      splitAmong: entry.splitAmong, receiptUrl: entry.receiptUrl || null,
    });
    setReceiptUri(null);
    setEditingId(entry.id);
    setShowAdd(true);
  }

  function cancelForm() {
    setDraft(EMPTY_DRAFT(userId, members));
    setReceiptUri(null);
    setEditingId(null);
    setShowAdd(false);
  }

  async function saveEntry() {
    const amount = parseFloat(draft.amount);
    if (!draft.title.trim() || !amount || draft.splitAmong.length === 0) return;
    setUploading(true);
    try {
      const baseData = {
        title: draft.title.trim(),
        amount,
        currency: draft.currency,
        category: draft.category.trim() || DEFAULT_CATEGORY,
        paidBy: draft.paidBy,
        splitAmong: draft.splitAmong,
        receiptUrl: draft.receiptUrl || null,
      };

      let entryId = editingId;
      if (editingId) {
        await updateDoc(doc(db, 'projects', projectId, 'budget_entries', editingId), baseData);
      } else {
        const ref2 = await addDoc(collection(db, 'projects', projectId, 'budget_entries'), {
          ...baseData, createdBy: userId, createdAt: serverTimestamp(),
        });
        entryId = ref2.id;
      }

      if (receiptUri) {
        const response = await fetch(receiptUri);
        const blob = await response.blob();
        const filename = receiptUri.split('/').pop() || `${Date.now()}.jpg`;
        const path = `projects/${projectId}/budget_entries/${entryId}/${Date.now()}-${filename}`;
        const storageRef = ref(storage, path);
        await uploadBytes(storageRef, blob);
        const url = await getDownloadURL(storageRef);
        await updateDoc(doc(db, 'projects', projectId, 'budget_entries', entryId), { receiptUrl: url });
      }
    } catch (err) {
      console.error('Failed to save expense:', err);
    }
    setUploading(false);
    cancelForm();
    touchProject(projectId);
  }

  async function removeEntry(id) {
    await deleteDoc(doc(db, 'projects', projectId, 'budget_entries', id));
    touchProject(projectId);
  }

  const currenciesUsed = [...new Set(entries.map((e) => e.currency || 'IDR'))];

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {entries.length === 0 && !showAdd && (
        <Text style={styles.emptyText}>No expenses logged yet. Add the first one below.</Text>
      )}

      {showAdd ? (
        <View style={[styles.addCard, { marginBottom: 18 }]}>
          <ClearableInput
            style={styles.input}
            placeholder="What for (e.g. hotel payment)"
            value={draft.title}
            onChangeText={(v) => setDraft({ ...draft, title: v })}
          />
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TextInput
              style={[styles.input, { flex: 1, minWidth: 0 }]}
              placeholder="Amount"
              keyboardType="numeric"
              value={draft.amount}
              onChangeText={(v) => setDraft({ ...draft, amount: v })}
            />
            <View style={[styles.pickerWrap, { width: 110, flexShrink: 0, overflow: 'hidden' }]}>
              <Picker
                selectedValue={draft.currency}
                onValueChange={(v) => setDraft({ ...draft, currency: v })}
                style={{ width: '100%' }}
              >
                {CURRENCIES.map((c) => <Picker.Item key={c} label={c} value={c} />)}
              </Picker>
            </View>
          </View>
          <View style={styles.chipRow}>
            {CATEGORY_SUGGESTIONS.map((c) => (
              <TouchableOpacity
                key={c}
                style={[styles.chip, draft.category === c && styles.chipSelected]}
                onPress={() => setDraft({ ...draft, category: c })}
              >
                <Text style={[styles.chipText, draft.category === c && styles.chipTextSelected]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <ClearableInput
            style={styles.input}
            placeholder="Or type a custom category"
            value={draft.category}
            onChangeText={(v) => setDraft({ ...draft, category: v })}
          />

          <Text style={styles.label}>RECEIPT (OPTIONAL)</Text>
          {(receiptUri || draft.receiptUrl) && (
            <View style={styles.previewWrap}>
              <Image source={{ uri: receiptUri || draft.receiptUrl }} style={styles.receiptPreview} />
              <TouchableOpacity
                style={styles.removePhotoBtn}
                onPress={() => { setReceiptUri(null); setDraft((d) => ({ ...d, receiptUrl: null })); }}
              >
                <Text style={styles.removePhotoText}>✕</Text>
              </TouchableOpacity>
            </View>
          )}
          <TouchableOpacity style={styles.photoBtn} onPress={pickReceipt}>
            <Text style={styles.photoBtnText}>{(receiptUri || draft.receiptUrl) ? '📷 Change receipt photo' : '📷 Add receipt photo'}</Text>
          </TouchableOpacity>

          <Text style={styles.label}>WHO PAID</Text>
          <View style={styles.pickerWrap}>
            <Picker selectedValue={draft.paidBy} onValueChange={(v) => setDraft({ ...draft, paidBy: v })}>
              {members.map((uid) => (
                <Picker.Item key={uid} label={`${memberNames[uid] || uid.slice(0, 8)}${uid === userId ? ' (you)' : ''}`} value={uid} />
              ))}
            </Picker>
          </View>
          <Text style={styles.label}>SPLIT AMONG</Text>
          <View style={styles.chipRow}>
            {members.map((uid) => (
              <TouchableOpacity
                key={uid}
                style={[styles.chip, draft.splitAmong.includes(uid) && styles.chipSelected]}
                onPress={() => toggleSplit(uid)}
              >
                <Text style={[styles.chipText, draft.splitAmong.includes(uid) && styles.chipTextSelected]}>
                  {(memberNames[uid] || uid).split(' ')[0]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.addBtns}>
            <TouchableOpacity style={styles.cancelBtn} onPress={cancelForm}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={saveEntry} disabled={uploading}>
              {uploading ? <ActivityIndicator color={colors.white} /> : (
                <Text style={styles.saveText}>{editingId ? 'Update' : 'Save'}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity style={[styles.dashedBtn, { marginBottom: 18 }]} onPress={() => setShowAdd(true)}>
          <Text style={styles.dashedText}>+ Add expense</Text>
        </TouchableOpacity>
      )}

      {currenciesUsed.map((currency) => {
        const currEntries = entries.filter((e) => (e.currency || 'IDR') === currency);
        const total = currEntries.reduce((sum, e) => sum + (e.amount || 0), 0);
        const balances = {};
        members.forEach((uid) => (balances[uid] = 0));
        currEntries.forEach((e) => {
          balances[e.paidBy] = (balances[e.paidBy] || 0) + e.amount;
          const share = e.amount / e.splitAmong.length;
          e.splitAmong.forEach((uid) => { balances[uid] = (balances[uid] || 0) - share; });
        });
        const groupedByCategory = currEntries.reduce((acc, e) => {
          const cat = e.category || DEFAULT_CATEGORY;
          (acc[cat] = acc[cat] || []).push(e);
          return acc;
        }, {});

        return (
          <View key={currency} style={{ marginBottom: 20 }}>
            {currenciesUsed.length > 1 && <Text style={styles.sectionLabel}>{currency}</Text>}

            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryN}>{formatCurrency(total, currency)}</Text>
                <Text style={styles.summaryL}>TOTAL SPENT</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryN}>{formatCurrency(members.length ? total / members.length : 0, currency)}</Text>
                <Text style={styles.summaryL}>AVG / PERSON</Text>
              </View>
            </View>

            {Object.entries(groupedByCategory).map(([category, catEntries]) => {
              const catTotal = catEntries.reduce((s, e) => s + e.amount, 0);
              return (
                <View key={category}>
                  <View style={styles.catHeader}>
                    <Text style={styles.groupLabel}>{category.toUpperCase()}</Text>
                    <Text style={styles.groupLabel}>{formatCurrency(catTotal, currency)}</Text>
                  </View>
                  {catEntries.map((e) => (
                    <View key={e.id} style={styles.dataRow}>
                      {e.receiptUrl ? (
                        <TouchableOpacity onPress={() => setLightboxImages([{ uri: e.receiptUrl }])}>
                          <Image source={{ uri: e.receiptUrl }} style={styles.receiptThumb} />
                        </TouchableOpacity>
                      ) : (
                        <View style={styles.avatarSmall}>
                          <Text style={styles.avatarSmallText}>{(memberNames[e.paidBy] || '??').slice(0, 2).toUpperCase()}</Text>
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={styles.who}>{e.title}</Text>
                        <Text style={styles.what}>paid · split {e.splitAmong.length} ways</Text>
                      </View>
                      <Text style={styles.amt}>{formatCurrency(e.amount, currency)}</Text>
                      <TouchableOpacity onPress={() => startEdit(e)}>
                        <Text style={styles.editText}>Edit</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => removeEntry(e.id)}>
                        <Text style={styles.deleteText}>Delete</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              );
            })}

            {members.length > 0 && currEntries.length > 0 && (
              <>
                <Text style={[styles.groupLabel, { marginTop: 18 }]}>BALANCE PER PERSON</Text>
                {members.map((uid) => {
                  const bal = balances[uid] || 0;
                  return (
                    <View key={uid} style={styles.dataRow}>
                      <Text style={styles.who}>{memberNames[uid] || 'Loading...'}</Text>
                      <Text style={[styles.amt, { color: bal >= 0 ? colors.teal : colors.danger }]}>
                        {bal >= 0 ? '+' : '-'}{formatCurrency(Math.abs(bal), currency)}
                      </Text>
                    </View>
                  );
                })}
              </>
            )}
          </View>
        );
      })}

      <Lightbox
        images={lightboxImages || []}
        index={0}
        visible={!!lightboxImages}
        onClose={() => setLightboxImages(null)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 4 },
  emptyText: { fontSize: 13, color: colors.inkSoft, textAlign: 'center', marginTop: 16, marginBottom: 4 },
  sectionLabel: { fontSize: 10, color: colors.inkSoft, letterSpacing: 0.5, marginBottom: 8 },
  summaryRow: { flexDirection: 'row', backgroundColor: colors.tealLight, borderRadius: 14, padding: 14, marginBottom: 14 },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryN: { fontSize: 15, fontWeight: '700', color: colors.teal },
  summaryL: { fontSize: 9, color: colors.inkSoft, marginTop: 2 },
  catHeader: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14, marginBottom: 6 },
  groupLabel: { fontSize: 10, color: colors.inkSoft, letterSpacing: 0.5 },
  dataRow: {
    flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: colors.line,
  },
  avatarSmall: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.tealLight, alignItems: 'center', justifyContent: 'center' },
  avatarSmallText: { fontSize: 9, fontWeight: '700', color: colors.teal },
  receiptThumb: { width: 34, height: 34, borderRadius: 8 },
  who: { fontSize: 13.5, fontWeight: '600', color: colors.ink },
  what: { fontSize: 10, color: colors.inkSoft, marginTop: 1 },
  amt: { fontSize: 13, fontWeight: '700', color: colors.teal },
  editText: { color: colors.teal, fontSize: 11, fontWeight: '600', marginLeft: 6 },
  deleteText: { color: colors.danger, fontSize: 11, marginLeft: 6 },
  addCard: { backgroundColor: colors.white, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.line, marginTop: 12 },
  input: {
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line,
    borderRadius: 10, paddingHorizontal: 13, fontSize: 14, marginBottom: 10, height: 44,
  },
  label: { fontSize: 10, color: colors.inkSoft, letterSpacing: 0.5, marginBottom: 6 },
  pickerWrap: { borderWidth: 1, borderColor: colors.line, borderRadius: 10, marginBottom: 10, height: 44, justifyContent: 'center' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  chip: { borderWidth: 1, borderColor: colors.line, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: colors.white },
  chipSelected: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontSize: 11, color: colors.inkSoft, fontWeight: '600' },
  chipTextSelected: { color: colors.paper },
  receiptPreview: { width: 100, height: 100, borderRadius: 10 },
  previewWrap: { position: 'relative', alignSelf: 'flex-start', marginBottom: 8 },
  removePhotoBtn: {
    position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: 10,
    backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center',
  },
  removePhotoText: { color: colors.white, fontSize: 9, fontWeight: '700' },
  photoBtn: {
    borderWidth: 1, borderColor: colors.line, borderRadius: 10, paddingVertical: 10,
    alignItems: 'center', marginBottom: 12,
  },
  photoBtnText: { fontSize: 12.5, color: colors.teal, fontWeight: '600' },
  addBtns: { flexDirection: 'row', gap: 8, marginTop: 4 },
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
