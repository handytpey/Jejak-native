import { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, Image, StyleSheet, ActivityIndicator, Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc, serverTimestamp, writeBatch,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, touchProject } from '../firebase';
import { colors } from '../theme';
import { formatDate, getInitials } from '../utils/format';
import CalendarGrid from './CalendarGrid';
import Lightbox from './Lightbox';
import LinkifiedText from './LinkifiedText';
import ClearableInput from './ClearableInput';

const REPEAT_OPTIONS = [
  { key: 'none', label: 'Once' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'yearly', label: 'Yearly' },
];

const webInputStyle = {
  flex: 1, height: 44, boxSizing: 'border-box', backgroundColor: colors.white,
  border: `1px solid ${colors.line}`, borderRadius: 10, paddingLeft: 13, paddingRight: 13,
  fontSize: 14, color: colors.ink, fontFamily: 'inherit',
};

// Apa event ini "kejadian" di tanggal iso tertentu, dengan mempertimbangkan
// aturan berulang (none/weekly/yearly).
function occursOn(event, iso) {
  if (!event.date) return false;
  if (event.repeat === 'weekly') {
    if (iso < event.date) return false;
    const diffDays = Math.round((new Date(iso + 'T00:00:00') - new Date(event.date + 'T00:00:00')) / 86400000);
    return diffDays % 7 === 0;
  }
  if (event.repeat === 'yearly') {
    return iso >= event.date && iso.slice(5) === event.date.slice(5);
  }
  return event.date === iso;
}

const EMPTY_DRAFT = { title: '', notes: '', date: '', repeat: 'none', photoUrls: [] };

export default function CalendarModule({ projectId, userId, memberNames, memberColors }) {
  const [events, setEvents] = useState([]);
  const [calMonth, setCalMonth] = useState(new Date());
  const [calSelectedDate, setCalSelectedDate] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [photoUris, setPhotoUris] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [lightboxImages, setLightboxImages] = useState(null);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [archiving, setArchiving] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'projects', projectId, 'calendar_events'), (snap) => {
      setEvents(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [projectId]);

  const currentYear = new Date().getFullYear();
  const pastOneTimeEvents = events.filter(
    (e) => e.repeat === 'none' && !e.archived && e.date && Number(e.date.slice(0, 4)) < currentYear
  );

  async function archiveOldEvents() {
    setArchiving(true);
    const batch = writeBatch(db);
    pastOneTimeEvents.forEach((e) => {
      batch.update(doc(db, 'projects', projectId, 'calendar_events', e.id), { archived: true });
    });
    await batch.commit();
    setArchiving(false);
  }

  function hasEventOnDate(iso) {
    return events.some((e) => !e.archived && occursOn(e, iso));
  }

  function dotColorsForDate(iso) {
    const creators = [...new Set(
      events.filter((e) => !e.archived && occursOn(e, iso)).map((e) => e.createdBy)
    )];
    return creators.map((uid) => memberColors?.[uid] || colors.teal);
  }

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

  function startAdd() {
    setDraft({ ...EMPTY_DRAFT, date: calSelectedDate || new Date().toISOString().slice(0, 10) });
    setPhotoUris([]);
    setEditingId(null);
    setShowAdd(true);
  }

  function startEdit(event) {
    setDraft({
      title: event.title || '', notes: event.notes || '', date: event.date || '',
      repeat: event.repeat || 'none', photoUrls: event.photoUrls || [],
    });
    setPhotoUris([]);
    setEditingId(event.id);
    setShowAdd(true);
  }

  function cancelForm() {
    setDraft(EMPTY_DRAFT);
    setPhotoUris([]);
    setEditingId(null);
    setShowAdd(false);
  }

  async function saveEvent() {
    if (!draft.title.trim() || !draft.date) return;
    setUploading(true);
    try {
      const baseData = {
        title: draft.title.trim(),
        notes: draft.notes,
        date: draft.date,
        repeat: draft.repeat,
        photoUrls: draft.photoUrls || [],
        archived: false,
        updatedBy: userId,
        updatedAt: serverTimestamp(),
      };

      let eventId = editingId;
      if (editingId) {
        await updateDoc(doc(db, 'projects', projectId, 'calendar_events', editingId), baseData);
      } else {
        const ref2 = await addDoc(collection(db, 'projects', projectId, 'calendar_events'), {
          ...baseData, createdBy: userId,
        });
        eventId = ref2.id;
      }

      if (photoUris.length > 0) {
        const uploadedUrls = [];
        for (const uri of photoUris) {
          const response = await fetch(uri);
          const blob = await response.blob();
          const filename = uri.split('/').pop() || `${Date.now()}.jpg`;
          const path = `projects/${projectId}/calendar_events/${eventId}/${Date.now()}-${filename}`;
          const storageRef = ref(storage, path);
          await uploadBytes(storageRef, blob);
          uploadedUrls.push(await getDownloadURL(storageRef));
        }
        await updateDoc(doc(db, 'projects', projectId, 'calendar_events', eventId), {
          photoUrls: [...(draft.photoUrls || []), ...uploadedUrls],
        });
      }
    } catch (err) {
      console.error('Failed to save event:', err);
    }
    setUploading(false);
    cancelForm();
    touchProject(projectId);
  }

  async function removeEvent(id) {
    await deleteDoc(doc(db, 'projects', projectId, 'calendar_events', id));
    touchProject(projectId);
  }

  const eventsForSelectedDate = calSelectedDate
    ? events.filter((e) => !e.archived && occursOn(e, calSelectedDate))
    : [];

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {pastOneTimeEvents.length > 0 && (
        <View style={styles.archiveBanner}>
          <Text style={styles.archiveText}>
            You have {pastOneTimeEvents.length} one-time event{pastOneTimeEvents.length === 1 ? '' : 's'} from last year.
          </Text>
          <TouchableOpacity style={styles.archiveBtn} onPress={archiveOldEvents} disabled={archiving}>
            {archiving ? <ActivityIndicator color={colors.white} size="small" /> : (
              <Text style={styles.archiveBtnText}>Archive them</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.calCard}>
        <CalendarGrid
          hasEventFn={hasEventOnDate}
          dotColorsFn={dotColorsForDate}
          month={calMonth}
          setMonth={(m) => { setCalMonth(m); setCalSelectedDate(null); }}
          selectedDate={calSelectedDate}
          setSelectedDate={(d) => { setCalSelectedDate(d); cancelForm(); }}
        />
      </View>

      {calSelectedDate && (
        <>
          <Text style={styles.dateLabel}>{formatDate(calSelectedDate)}</Text>

          {eventsForSelectedDate.map((e) => (
            <View key={e.id} style={styles.eventRow}>
              <View style={[styles.creatorAvatar, { backgroundColor: memberColors?.[e.createdBy] || colors.teal }]}>
                <Text style={styles.creatorAvatarText}>{getInitials(memberNames?.[e.createdBy])}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.eventTitle}>{e.title}</Text>
                  {e.repeat !== 'none' && (
                    <View style={styles.repeatBadge}>
                      <Text style={styles.repeatBadgeText}>{e.repeat === 'weekly' ? 'Weekly' : 'Yearly'}</Text>
                    </View>
                  )}
                </View>
                {e.notes ? <LinkifiedText text={e.notes} style={styles.eventNotes} /> : null}
                {(e.photoUrls || []).length > 0 && (
                  <View style={styles.photoRow}>
                    {e.photoUrls.map((url, i) => (
                      <TouchableOpacity
                        key={url}
                        onPress={() => { setLightboxImages(e.photoUrls.map((u) => ({ uri: u }))); setLightboxIndex(i); }}
                      >
                        <Image source={{ uri: url }} style={styles.eventPhoto} />
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
              <View style={{ alignItems: 'flex-end', gap: 8 }}>
                <TouchableOpacity onPress={() => startEdit(e)}>
                  <Text style={styles.editText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => removeEvent(e.id)}>
                  <Text style={styles.deleteText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}

          {showAdd ? (
            <View style={styles.addCard}>
              <ClearableInput
                style={styles.input}
                placeholder="Event title"
                value={draft.title}
                onChangeText={(v) => setDraft({ ...draft, title: v })}
              />

              {Platform.OS === 'web' ? (
                <View style={{ width: '100%', overflow: 'hidden', marginBottom: 10 }}>
                  <input
                    type="date"
                    value={draft.date}
                    onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))}
                    style={{
                      ...webInputStyle,
                      width: '100%',
                      maxWidth: '100%',
                      boxSizing: 'border-box',
                      display: 'block',
                      margin: 0,
                      WebkitAppearance: 'none',
                      appearance: 'none',
                      outline: 'none',
                    }}
                  />
                </View>
              ) : (
                <TouchableOpacity style={[styles.input, styles.pickerBtn]} onPress={() => setShowDatePicker(true)}>
                  <Text style={draft.date ? styles.pickerBtnText : styles.pickerBtnPlaceholder}>
                    {draft.date ? formatDate(draft.date) : 'Pick a date'}
                  </Text>
                </TouchableOpacity>
              )}

              {Platform.OS !== 'web' && showDatePicker && (
                <DateTimePicker
                  value={draft.date ? new Date(draft.date + 'T00:00:00') : new Date()}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'inline' : 'default'}
                  onChange={(event, selected) => {
                    setShowDatePicker(Platform.OS === 'ios');
                    if (event.type === 'dismissed') { setShowDatePicker(false); return; }
                    if (selected) {
                      const iso = selected.toISOString().slice(0, 10);
                      setDraft((d) => ({ ...d, date: iso }));
                    }
                  }}
                />
              )}

              <Text style={styles.label}>REPEATS</Text>
              <View style={styles.chipRow}>
                {REPEAT_OPTIONS.map((r) => (
                  <TouchableOpacity
                    key={r.key}
                    style={[styles.chip, draft.repeat === r.key && styles.chipSelected]}
                    onPress={() => setDraft({ ...draft, repeat: r.key })}
                  >
                    <Text style={[styles.chipText, draft.repeat === r.key && styles.chipTextSelected]}>{r.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

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
                <TouchableOpacity style={styles.saveBtn} onPress={saveEvent} disabled={uploading}>
                  {uploading ? <ActivityIndicator color={colors.white} /> : (
                    <Text style={styles.saveText}>{editingId ? 'Update' : 'Save'}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity style={styles.dashedBtn} onPress={startAdd}>
              <Text style={styles.dashedText}>+ Add event on {formatDate(calSelectedDate)}</Text>
            </TouchableOpacity>
          )}
        </>
      )}

      <Lightbox
        images={lightboxImages || []}
        index={lightboxIndex}
        visible={!!lightboxImages}
        onClose={() => setLightboxImages(null)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 4 },
  archiveBanner: {
    backgroundColor: colors.dangerBg, borderRadius: 12, padding: 14, marginBottom: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10,
  },
  archiveText: { flex: 1, fontSize: 12, color: colors.danger, lineHeight: 17 },
  archiveBtn: { backgroundColor: colors.danger, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 },
  archiveBtnText: { color: colors.white, fontSize: 11.5, fontWeight: '700' },
  calCard: {
    backgroundColor: colors.white, borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: colors.line, marginBottom: 16,
  },
  dateLabel: { fontSize: 13, fontWeight: '700', color: colors.ink, marginBottom: 10 },
  eventRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: colors.white, borderRadius: 12, padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: colors.line,
  },
  eventTitle: { fontSize: 14, fontWeight: '600', color: colors.ink },
  creatorAvatar: {
    width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginTop: 1,
  },
  creatorAvatarText: { fontSize: 9, fontWeight: '700', color: colors.white },
  eventNotes: { fontSize: 12, color: colors.inkSoft, marginTop: 4, lineHeight: 17 },
  repeatBadge: { backgroundColor: colors.tealLight, borderRadius: 999, paddingVertical: 2, paddingHorizontal: 8 },
  repeatBadgeText: { fontSize: 9, fontWeight: '700', color: colors.teal },
  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  eventPhoto: { width: 80, height: 80, borderRadius: 10 },
  editText: { color: colors.teal, fontSize: 11, fontWeight: '600' },
  deleteText: { color: colors.danger, fontSize: 11 },
  dashedBtn: {
    borderWidth: 1.5, borderColor: colors.line, borderStyle: 'dashed', borderRadius: 14,
    paddingVertical: 14, alignItems: 'center',
  },
  dashedText: { color: colors.inkSoft, fontSize: 13, fontWeight: '600' },
  addCard: { backgroundColor: colors.white, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.line },
  input: {
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line,
    borderRadius: 10, paddingHorizontal: 13, fontSize: 14, marginBottom: 10, height: 44,
  },
  label: { fontSize: 10, color: colors.inkSoft, letterSpacing: 0.5, marginBottom: 6 },
  pickerBtn: { justifyContent: 'center' },
  pickerBtnText: { fontSize: 14, color: colors.ink },
  pickerBtnPlaceholder: { fontSize: 14, color: colors.inkSoft },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  chip: { borderWidth: 1, borderColor: colors.line, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: colors.white },
  chipSelected: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontSize: 11, color: colors.inkSoft, fontWeight: '600' },
  chipTextSelected: { color: colors.paper },
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
});
