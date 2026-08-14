import { useEffect, useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, Image, StyleSheet, ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import Lightbox from './Lightbox';
import CalendarGrid from './CalendarGrid';
import LinkifiedText from './LinkifiedText';
import ClearableInput from './ClearableInput';
import {
  doc, onSnapshot, collection, addDoc, updateDoc, deleteDoc, serverTimestamp, writeBatch,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, touchProject } from '../firebase';
import { colors } from '../theme';
import { formatDate, timeAgo, getInitials } from '../utils/format';

const webInputStyle = {
  flex: 1,
  height: 44,
  boxSizing: 'border-box',
  backgroundColor: colors.white,
  border: `1px solid ${colors.line}`,
  borderRadius: 10,
  paddingLeft: 13,
  paddingRight: 13,
  fontSize: 14,
  color: colors.ink,
  fontFamily: 'inherit',
};

export default function ItineraryModule({ projectId, userId, memberNames }) {
  const flatListRef = useRef(null);
  const [items, setItems] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({ title: '', city: '', date: '', time: '', location: '', notes: '', photoUrls: [] });
  const [photoUris, setPhotoUris] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [lightboxImages, setLightboxImages] = useState(null);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [viewMode, setViewMode] = useState('list');
  const [selectedDay, setSelectedDay] = useState('all');
  const [selectedCity, setSelectedCity] = useState('all');
  const [calMonth, setCalMonth] = useState(new Date());
  const [calSelectedDate, setCalSelectedDate] = useState(null);


  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'projects', projectId, 'itinerary_items'), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => {
        const dc = (a.date || '').localeCompare(b.date || '');
        if (dc !== 0) return dc;
        const oc = (a.order ?? 0) - (b.order ?? 0);
        if (oc !== 0) return oc;
        return (a.time || '').localeCompare(b.time || '');
      });
      setItems(list);
    });
    return unsub;
  }, [projectId]);

  async function pickPhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (!result.canceled) setPhotoUris((prev) => [...prev, ...result.assets.map((a) => a.uri)]);
  }

  function removeNewPhoto(uri) {
    setPhotoUris((prev) => prev.filter((u) => u !== uri));
  }

  function removeExistingPhoto(url) {
    setDraft((d) => ({ ...d, photoUrls: (d.photoUrls || []).filter((u) => u !== url) }));
  }

  async function saveItem() {
    if (!draft.title.trim()) return;
    setUploading(true);
    try {
      const baseData = {
        title: draft.title,
        city: draft.city,
        date: draft.date,
        time: draft.time,
        location: draft.location,
        notes: draft.notes,
        photoUrls: draft.photoUrls || [],
        updatedBy: userId,
        updatedAt: serverTimestamp(),
      };

      // Item baru (atau item yang tanggalnya diganti pas edit) ditaruh
      // di urutan paling akhir hari itu. Item yang diedit tapi tanggalnya
      // gak berubah, urutannya dipertahankan apa adanya.
      const existingItem = editingId ? items.find((i) => i.id === editingId) : null;
      const dateChanged = existingItem && existingItem.date !== draft.date;
      if (!editingId || dateChanged) {
        baseData.order = items.filter((i) => i.date === draft.date && i.id !== editingId).length;
      }

      let itemId = editingId;
      if (editingId) {
        await updateDoc(doc(db, 'projects', projectId, 'itinerary_items', editingId), baseData);
      } else {
        const ref2 = await addDoc(collection(db, 'projects', projectId, 'itinerary_items'), {
          ...baseData, checked: false, createdBy: userId,
        });
        itemId = ref2.id;
      }

      if (photoUris.length > 0) {
        const uploadedUrls = [];
        for (const uri of photoUris) {
          const response = await fetch(uri);
          const blob = await response.blob();
          const filename = uri.split('/').pop() || `${Date.now()}.jpg`;
          const path = `projects/${projectId}/itinerary_items/${itemId}/${Date.now()}-${filename}`;
          const storageRef = ref(storage, path);
          await uploadBytes(storageRef, blob);
          uploadedUrls.push(await getDownloadURL(storageRef));
        }
        await updateDoc(doc(db, 'projects', projectId, 'itinerary_items', itemId), {
          photoUrls: [...(draft.photoUrls || []), ...uploadedUrls],
        });
      }
    } catch (err) {
      console.error('Failed to save activity:', err);
    }
    setUploading(false);
    cancelForm();
    touchProject(projectId);
  }

  function startEdit(item) {
    // Fallback buat item lama yang masih pakai field "photoUrl" tunggal
    // (sebelum fitur multi-foto ini ada).
    const existingPhotos = item.photoUrls?.length ? item.photoUrls : (item.photoUrl ? [item.photoUrl] : []);
    setDraft({
      title: item.title || '', city: item.city || '', date: item.date || '', time: item.time || '',
      location: item.location || '', notes: item.notes || '', photoUrls: existingPhotos,
    });
    setPhotoUris([]);
    setEditingId(item.id);
    setShowAdd(true);
    // Form Edit-nya nongol di ATAS daftar — kalau kita klik Edit dari
    // kegiatan yang jauh di bawah, layar harus otomatis naik biar form
    // itu langsung kelihatan (gak kayak "diem" gak ngapa-ngapain).
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
  }

  function cancelForm() {
    setDraft({ title: '', city: '', date: '', time: '', location: '', notes: '', photoUrls: [] });
    setPhotoUris([]);
    setEditingId(null);
    setShowAdd(false);
  }

  async function toggleCheck(item) {
    await updateDoc(doc(db, 'projects', projectId, 'itinerary_items', item.id), {
      checked: !item.checked, updatedBy: userId, updatedAt: serverTimestamp(),
    });
    touchProject(projectId);
  }

  async function removeItem(id) {
    await deleteDoc(doc(db, 'projects', projectId, 'itinerary_items', id));
    touchProject(projectId);
  }

  async function moveItem(item, direction) {
    const sameDay = items.filter((i) => i.date === item.date).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const idx = sameDay.findIndex((i) => i.id === item.id);
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= sameDay.length) return;
    const reordered = [...sameDay];
    [reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]];
    const batch = writeBatch(db);
    reordered.forEach((it, i) => {
      batch.update(doc(db, 'projects', projectId, 'itinerary_items', it.id), { order: i });
    });
    await batch.commit();
  }

  const uniqueDays = [...new Set(items.map((i) => i.date).filter(Boolean))].sort();
  const uniqueCities = [...new Set(items.map((i) => i.city).filter(Boolean))].sort();
  const dayTabItems = (selectedDay === 'all' ? items : items.filter((i) => i.date === selectedDay))
    .filter((i) => selectedCity === 'all' || i.city === selectedCity);
  const calendarItems = calSelectedDate ? items.filter((i) => i.date === calSelectedDate) : [];
  const visibleItems = viewMode === 'calendar' ? calendarItems : dayTabItems;

  return (
    <FlatList
      ref={flatListRef}
      data={visibleItems}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.container}
      ListHeaderComponent={
        <>
          {items.length > 0 && (
            <>
              <View style={styles.viewSwitch}>
                <TouchableOpacity
                  style={[styles.viewSwitchBtn, viewMode === 'list' && styles.viewSwitchBtnOn]}
                  onPress={() => setViewMode('list')}
                >
                  <Text style={[styles.viewSwitchText, viewMode === 'list' && styles.viewSwitchTextOn]}>List</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.viewSwitchBtn, viewMode === 'calendar' && styles.viewSwitchBtnOn]}
                  onPress={() => setViewMode('calendar')}
                >
                  <Text style={[styles.viewSwitchText, viewMode === 'calendar' && styles.viewSwitchTextOn]}>Calendar</Text>
                </TouchableOpacity>
              </View>

              {viewMode === 'list' && uniqueDays.length > 1 && (
                <FlatList
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  data={['all', ...uniqueDays]}
                  keyExtractor={(d) => d}
                  contentContainerStyle={{ gap: 8, marginBottom: 12 }}
                  renderItem={({ item: d, index }) => (
                    <TouchableOpacity
                      style={[styles.dayTab, selectedDay === d && styles.dayTabOn]}
                      onPress={() => setSelectedDay(d)}
                    >
                      {d === 'all' ? (
                        <Text style={[styles.dayTabLabel, selectedDay === d && styles.dayTabLabelOn]}>All</Text>
                      ) : (
                        <>
                          <Text style={[styles.dayTabLabel, selectedDay === d && styles.dayTabLabelOn]}>
                            Day {index}
                          </Text>
                          <Text style={[styles.dayTabNum, selectedDay === d && styles.dayTabLabelOn]}>
                            {(() => {
                              const dayNum = new Date(d + 'T00:00:00').getDate();
                              return Number.isNaN(dayNum) ? '–' : dayNum;
                            })()}
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}
                />
              )}

              {viewMode === 'list' && uniqueCities.length > 1 && (
                <FlatList
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  data={['all', ...uniqueCities]}
                  keyExtractor={(c) => c}
                  contentContainerStyle={{ gap: 8, marginBottom: 12 }}
                  renderItem={({ item: c }) => (
                    <TouchableOpacity
                      style={[styles.cityChip, selectedCity === c && styles.cityChipOn]}
                      onPress={() => setSelectedCity(c)}
                    >
                      <Text style={[styles.cityChipText, selectedCity === c && styles.cityChipTextOn]}>
                        {c === 'all' ? 'All cities' : c}
                      </Text>
                    </TouchableOpacity>
                  )}
                />
              )}

              {viewMode === 'calendar' && (
                <>
                  <CalendarGrid
                    items={items}
                    month={calMonth}
                    setMonth={(m) => { setCalMonth(m); setCalSelectedDate(null); }}
                    selectedDate={calSelectedDate}
                    setSelectedDate={setCalSelectedDate}
                  />
                  {visibleItems.length > 0 && (
                    <Text style={styles.calDayLabel}>
                      {calSelectedDate ? formatDate(calSelectedDate) : 'Undated'} · {visibleItems.length} {visibleItems.length === 1 ? 'activity' : 'activities'}
                    </Text>
                  )}
                </>
              )}
            </>
          )}

          {showAdd ? (
            <View style={[styles.addCard, { marginBottom: 14 }]}>
              <ClearableInput
                style={styles.input}
                placeholder="Activity title"
                value={draft.title}
                onChangeText={(v) => setDraft({ ...draft, title: v })}
              />
              <ClearableInput
                style={styles.input}
                placeholder="City / destination (optional)"
                value={draft.city}
                onChangeText={(v) => setDraft({ ...draft, city: v })}
              />
              {uniqueCities.length > 0 && (
                <View style={[styles.chipRow, { marginTop: -4 }]}>
                  {uniqueCities.map((c) => (
                    <TouchableOpacity
                      key={c}
                      style={[styles.chip, draft.city === c && styles.chipSelected]}
                      onPress={() => setDraft({ ...draft, city: c })}
                    >
                      <Text style={[styles.chipText, draft.city === c && styles.chipTextSelected]}>{c}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              <View style={{ flexDirection: 'row', gap: 12, marginBottom: 10 }}>
                <input
                  type="date"
                  value={draft.date}
                  onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))}
                  style={webInputStyle}
                />
                <input
                  type="time"
                  value={draft.time}
                  onChange={(e) => setDraft((d) => ({ ...d, time: e.target.value }))}
                  style={webInputStyle}
                />
              </View>
              <ClearableInput
                style={styles.input}
                placeholder="Location (optional)"
                value={draft.location}
                onChangeText={(v) => setDraft({ ...draft, location: v })}
              />
              <ClearableInput
                style={[styles.input, { height: 70, textAlignVertical: 'top' }]}
                placeholder="Notes (optional)"
                multiline
                value={draft.notes}
                onChangeText={(v) => setDraft({ ...draft, notes: v })}
              />

              <Text style={styles.label}>PHOTOS (OPTIONAL)</Text>
              {(draft.photoUrls?.length > 0 || photoUris.length > 0) && (
                <View style={styles.photoPreviewRow}>
                  {(draft.photoUrls || []).map((url) => (
                    <View key={url} style={styles.previewWrap}>
                      <Image source={{ uri: url }} style={styles.previewPhoto} />
                      <TouchableOpacity style={styles.removePhotoBtn} onPress={() => removeExistingPhoto(url)}>
                        <Text style={styles.removePhotoText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                  {photoUris.map((uri) => (
                    <View key={uri} style={styles.previewWrap}>
                      <Image source={{ uri }} style={styles.previewPhoto} />
                      <TouchableOpacity style={styles.removePhotoBtn} onPress={() => removeNewPhoto(uri)}>
                        <Text style={styles.removePhotoText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
              <TouchableOpacity style={styles.photoBtn} onPress={pickPhoto}>
                <Text style={styles.photoBtnText}>+ Add photos</Text>
              </TouchableOpacity>

              <View style={styles.addBtns}>
                <TouchableOpacity style={styles.cancelBtn} onPress={cancelForm}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={saveItem} disabled={uploading}>
                  {uploading ? <ActivityIndicator color={colors.white} /> : (
                    <Text style={styles.saveText}>{editingId ? 'Update' : 'Save'}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity style={[styles.dashedBtn, { marginBottom: 14 }]} onPress={() => setShowAdd(true)}>
              <Text style={styles.dashedText}>+ Add activity</Text>
            </TouchableOpacity>
          )}
        </>
      }
      renderItem={({ item }) => (
        <View style={styles.row}>
          <TouchableOpacity
            style={[styles.checkbox, item.checked && styles.checkboxDone]}
            onPress={() => toggleCheck(item)}
          >
            {item.checked && <Text style={styles.checkMark}>✓</Text>}
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            {item.date ? (
              <Text style={styles.time}>{formatDate(item.date)}{item.time ? ` · ${item.time}` : ''}</Text>
            ) : null}
            {item.city ? (
              <View style={styles.cityBadge}>
                <Text style={styles.cityBadgeText}>{item.city}</Text>
              </View>
            ) : null}
            <Text style={[styles.itemTitle, item.checked && styles.itemDone]}>{item.title}</Text>
            {item.location ? <Text style={styles.location}>📍 {item.location}</Text> : null}
            {item.notes ? <LinkifiedText text={item.notes} style={styles.notes} /> : null}
            {(() => {
              const photos = item.photoUrls?.length ? item.photoUrls : (item.photoUrl ? [item.photoUrl] : []);
              if (photos.length === 0) return null;
              return (
                <View style={styles.photoRow}>
                  {photos.map((url, i) => (
                    <TouchableOpacity
                      key={url}
                      onPress={() => {
                        setLightboxImages(photos.map((u) => ({ uri: u })));
                        setLightboxIndex(i);
                      }}
                    >
                      <Image source={{ uri: url }} style={styles.itemPhoto} />
                    </TouchableOpacity>
                  ))}
                </View>
              );
            })()}
            {item.updatedBy ? (
              <Text style={styles.updateLine}>
                {getInitials(memberNames[item.updatedBy])} · updated {timeAgo(item.updatedAt)}
              </Text>
            ) : null}
          </View>
          <View style={{ alignItems: 'flex-end', gap: 8 }}>
            {(() => {
              const sameDay = items.filter((i) => i.date === item.date).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
              const pos = sameDay.findIndex((i) => i.id === item.id);
              return (
                <View style={{ flexDirection: 'row', gap: 4 }}>
                  <TouchableOpacity
                    style={styles.moveBtn}
                    onPress={() => moveItem(item, -1)}
                    disabled={pos === 0}
                  >
                    <Text style={[styles.moveBtnText, pos === 0 && styles.moveBtnTextDisabled]}>↑</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.moveBtn}
                    onPress={() => moveItem(item, 1)}
                    disabled={pos === sameDay.length - 1}
                  >
                    <Text style={[styles.moveBtnText, pos === sameDay.length - 1 && styles.moveBtnTextDisabled]}>↓</Text>
                  </TouchableOpacity>
                </View>
              );
            })()}
            <TouchableOpacity onPress={() => startEdit(item)}>
              <Text style={styles.editText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => removeItem(item.id)}>
              <Text style={styles.deleteText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      ListFooterComponent={
        <Lightbox
          images={lightboxImages || []}
          index={lightboxIndex}
          visible={!!lightboxImages}
          onClose={() => setLightboxImages(null)}
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  chip: { borderWidth: 1, borderColor: colors.line, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: colors.white },
  chipSelected: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontSize: 11, color: colors.inkSoft, fontWeight: '600' },
  chipTextSelected: { color: colors.paper },
  cityChip: {
    borderWidth: 1, borderColor: colors.line, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14,
    backgroundColor: colors.white,
  },
  cityChipOn: { backgroundColor: colors.teal, borderColor: colors.teal },
  cityChipText: { fontSize: 11.5, fontWeight: '700', color: colors.inkSoft },
  cityChipTextOn: { color: colors.white },
  cityBadge: {
    alignSelf: 'flex-start', backgroundColor: colors.tealLight, borderRadius: 999,
    paddingVertical: 2, paddingHorizontal: 8, marginBottom: 4,
  },
  cityBadgeText: { fontSize: 9.5, fontWeight: '700', color: colors.teal },
  container: { padding: 4 },
  viewSwitch: { flexDirection: 'row', gap: 4, marginBottom: 12 },
  viewSwitchBtn: {
    flex: 1, borderWidth: 1, borderColor: colors.line, borderRadius: 9,
    paddingVertical: 8, alignItems: 'center', backgroundColor: colors.white,
  },
  viewSwitchBtnOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  viewSwitchText: { fontSize: 12, fontWeight: '600', color: colors.inkSoft },
  viewSwitchTextOn: { color: colors.paper },
  dayTab: {
    borderWidth: 1, borderColor: colors.line, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 16,
    backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', minHeight: 52, minWidth: 52,
  },
  dayTabOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  dayTabLabel: { fontSize: 10.5, fontWeight: '600', color: colors.inkSoft },
  dayTabNum: { fontSize: 14, fontWeight: '700', color: colors.ink, marginTop: 2 },
  dayTabLabelOn: { color: colors.paper },
  calDayLabel: { fontSize: 11, color: colors.inkSoft, marginBottom: 10, textTransform: 'uppercase', fontWeight: '600' },
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
  time: { fontSize: 10.5, fontWeight: '700', color: colors.amberDeep, marginBottom: 3 },
  itemTitle: { fontSize: 14, fontWeight: '600', color: colors.ink },
  itemDone: { color: colors.inkSoft, textDecorationLine: 'line-through' },
  location: { fontSize: 11, color: colors.teal, marginTop: 4 },
  notes: { fontSize: 12, color: colors.inkSoft, marginTop: 5, lineHeight: 17 },
  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  itemPhoto: { width: 90, height: 90, borderRadius: 10 },
  updateLine: { fontSize: 10, color: colors.inkSoft, marginTop: 6 },
  deleteText: { color: colors.danger, fontSize: 11 },
  editText: { color: colors.teal, fontSize: 11, fontWeight: '600' },
  moveBtn: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 1, borderColor: colors.line,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white,
  },
  moveBtnText: { fontSize: 11, color: colors.ink, fontWeight: '700' },
  moveBtnTextDisabled: { color: colors.line },
  pickerBtn: { justifyContent: 'center' },
  pickerBtnText: { fontSize: 14, color: colors.ink },
  pickerBtnPlaceholder: { fontSize: 14, color: colors.inkSoft },
  addCard: { backgroundColor: colors.white, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.line },
  input: {
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line,
    borderRadius: 10, paddingHorizontal: 13, fontSize: 14, marginBottom: 10, height: 44,
  },
  label: { fontSize: 10, color: colors.inkSoft, letterSpacing: 0.5, marginBottom: 6 },
  photoPreviewRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  previewWrap: { position: 'relative' },
  previewPhoto: { width: 76, height: 76, borderRadius: 10 },
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
  addBtns: { flexDirection: 'row', gap: 8 },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: colors.line, borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  cancelText: { color: colors.ink, fontSize: 13, fontWeight: '600' },
  saveBtn: { flex: 1, backgroundColor: colors.amber, borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  saveText: { color: colors.white, fontSize: 13, fontWeight: '700' },
  dashedBtn: {
    borderWidth: 1.5, borderColor: colors.line, borderStyle: 'dashed', borderRadius: 14,
    paddingVertical: 14, alignItems: 'center',
  },
  dashedText: { color: colors.inkSoft, fontSize: 13, fontWeight: '600' },
});
