import { useEffect, useState } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { collection, query, where, onSnapshot, doc, deleteDoc, updateDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { useNavigation } from '@react-navigation/native';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { colors } from '../theme';
import { confirmAction } from '../utils/confirm';
import ClearableInput from '../components/ClearableInput';

const STATUS_LABEL = { planned: 'Planned', active: 'Active', completed: 'Completed', archived: 'Archived' };
const STATUS_COLOR = {
  planned: colors.amberDeep,
  active: colors.teal,
  completed: '#4A8C5F',
  archived: colors.inkSoft,
};

export default function HomeScreen() {
  const { user } = useAuth();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [lastSeenProjects, setLastSeenProjects] = useState({});

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'projects'),
      where('members', 'array-contains', user.uid)
    );
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      // Urutan manual (field "order") diutamakan; project lama yang
      // belum pernah digeser jatuh ke urutan "paling baru diupdate".
      list.sort((a, b) => {
        const oc = (a.order ?? 0) - (b.order ?? 0);
        if (oc !== 0) return oc;
        return (b.updatedAt?.toMillis?.() ?? 0) - (a.updatedAt?.toMillis?.() ?? 0);
      });
      setProjects(list);
      setLoading(false);
    });
    return unsub;
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      setLastSeenProjects(snap.data()?.lastSeenProjects || {});
    });
    return unsub;
  }, [user]);

  async function confirmDelete(project) {
    const ok = await confirmAction(
      'Delete project?',
      `"${project.name}" and everything inside it (itinerary, checklist, etc.) will be permanently deleted. This can't be undone.`
    );
    if (ok) await deleteDoc(doc(db, 'projects', project.id));
  }

  async function moveProject(project, direction) {
    const idx = projects.findIndex((p) => p.id === project.id);
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= projects.length) return;
    const reordered = [...projects];
    [reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]];
    const batch = writeBatch(db);
    reordered.forEach((p, i) => {
      batch.update(doc(db, 'projects', p.id), { order: i });
    });
    await batch.commit();
  }

  return (
    <View style={styles.safe}>
      <LinearGradient
        colors={[colors.headerGradientStart, colors.headerGradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 16 }]}
      >
        <View>
          <Text style={styles.headerTitle}>Your projects</Text>
          <Text style={styles.headerSub}>{projects.length} project{projects.length !== 1 ? 's' : ''}</Text>
        </View>
        <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('NewProject')}>
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      </LinearGradient>

      <FlatList
        data={projects}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={colors.teal} size="large" style={{ marginTop: 40 }} />
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No projects yet</Text>
              <Text style={styles.emptyText}>
                Create a trip itinerary or any kind of project, then invite friends via QR.
              </Text>
            </View>
          )
        }
        renderItem={({ item, index }) => {
          const lastActivity = item.lastActivityAt?.toMillis?.() ?? 0;
          const lastSeen = lastSeenProjects[item.id]?.toMillis?.() ?? 0;
          const hasNewActivity = lastActivity > 0 && lastActivity > lastSeen;
          return (
            <ProjectCard
              item={item}
              isEditing={editingId === item.id}
              onOpenEdit={() => setEditingId(item.id)}
              onCloseEdit={() => setEditingId(null)}
              onPress={() => navigation.navigate('ProjectDetail', { projectId: item.id })}
              onDelete={() => confirmDelete(item)}
              onMoveUp={() => moveProject(item, -1)}
              onMoveDown={() => moveProject(item, 1)}
              isFirst={index === 0}
              isLast={index === projects.length - 1}
              hasNewActivity={hasNewActivity}
            />
          );
        }}
      />
    </View>
  );
}

function ProjectCard({ item, isEditing, onOpenEdit, onCloseEdit, onPress, onDelete, onMoveUp, onMoveDown, isFirst, isLast, hasNewActivity }) {
  const [name, setName] = useState(item.name);

  useEffect(() => {
    if (!isEditing) setName(item.name);
  }, [item.name, isEditing]);

  async function saveName() {
    if (!name.trim()) return;
    await updateDoc(doc(db, 'projects', item.id), { name: name.trim(), updatedAt: serverTimestamp() });
    onCloseEdit();
  }

  return (
    <TouchableOpacity style={styles.card} onPress={isEditing ? undefined : onPress} activeOpacity={isEditing ? 1 : 0.7}>
      <View style={styles.cardTop}>
        <View style={{ flex: 1 }}>
          {isEditing ? (
            <ClearableInput style={styles.editInput} value={name} onChangeText={setName} autoFocus />
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
              {hasNewActivity && <View style={styles.newDot} />}
              <Text style={styles.cardTitle}>{item.name}</Text>
            </View>
          )}
          <Text style={styles.cardMeta}>
            {(item.modules || []).join(', ')}
          </Text>
        </View>
        <View style={{ alignItems: 'center', gap: 8 }}>
          <View style={[styles.stamp, { backgroundColor: STATUS_COLOR[item.status] || STATUS_COLOR.planned }]}>
            <Text style={styles.stampText}>
              {STATUS_LABEL[item.status] || 'Planned'}
            </Text>
          </View>
          {!isEditing && (
            <View style={{ flexDirection: 'row', gap: 4 }}>
              <TouchableOpacity style={styles.moveBtn} onPress={onMoveUp} disabled={isFirst}>
                <Text style={[styles.moveBtnText, isFirst && styles.moveBtnTextDisabled]}>↑</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.moveBtn} onPress={onMoveDown} disabled={isLast}>
                <Text style={[styles.moveBtnText, isLast && styles.moveBtnTextDisabled]}>↓</Text>
              </TouchableOpacity>
            </View>
          )}
          {!isEditing && (
            <TouchableOpacity style={styles.editIconBtn} onPress={onOpenEdit}>
              <Text style={styles.editIconText}>✎</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {isEditing && (
        <View style={styles.editActions}>
          <TouchableOpacity style={styles.deleteBtn} onPress={onDelete}>
            <Text style={styles.deleteBtnText}>Delete project</Text>
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onCloseEdit}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={saveName}>
              <Text style={styles.saveBtnText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  listContent: { padding: 18, paddingBottom: 40 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    borderBottomLeftRadius: 24, borderBottomRightRadius: 24,
    paddingHorizontal: 20, paddingBottom: 22,
  },
  headerTitle: { fontSize: 26, fontWeight: '700', color: colors.ink },
  headerSub: { fontSize: 13, color: colors.inkSoft, marginTop: 4 },
  fab: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: colors.amber,
    alignItems: 'center', justifyContent: 'center',
  },
  fabText: { color: colors.white, fontSize: 22 },
  card: {
    backgroundColor: colors.white, borderRadius: 18, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: colors.line,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardTitle: { fontSize: 20, fontWeight: '700', color: colors.ink, marginBottom: 4 },
  newDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.danger, marginBottom: 4 },
  cardMeta: { fontSize: 11.5, color: colors.inkSoft },
  editInput: {
    borderWidth: 1, borderColor: colors.line, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
    fontSize: 15, fontWeight: '700', color: colors.ink, marginBottom: 6,
  },
  editIconBtn: {
    width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: colors.line,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white,
  },
  editIconText: { fontSize: 13, color: colors.inkSoft },
  moveBtn: {
    width: 24, height: 24, borderRadius: 6, borderWidth: 1, borderColor: colors.line,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white,
  },
  moveBtnText: { fontSize: 11, color: colors.ink, fontWeight: '700' },
  moveBtnTextDisabled: { color: colors.line },
  editActions: { marginTop: 14, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 12 },
  deleteBtn: {
    borderWidth: 1, borderColor: '#E2A5A5', borderRadius: 8, paddingVertical: 9,
    alignItems: 'center', marginBottom: 10,
  },
  deleteBtnText: { color: colors.danger, fontSize: 12.5, fontWeight: '700' },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: colors.line, borderRadius: 8, paddingVertical: 9, alignItems: 'center' },
  cancelBtnText: { color: colors.ink, fontSize: 12.5, fontWeight: '600' },
  saveBtn: { flex: 1, backgroundColor: colors.amber, borderRadius: 8, paddingVertical: 9, alignItems: 'center' },
  saveBtnText: { color: colors.white, fontSize: 12.5, fontWeight: '700' },
  stamp: {
    width: 46, height: 46, borderRadius: 23,
    alignItems: 'center', justifyContent: 'center',
  },
  stampText: { fontSize: 8.5, color: colors.white, textAlign: 'center', fontWeight: '800' },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.ink, marginBottom: 8 },
  emptyText: { fontSize: 13, color: colors.inkSoft, textAlign: 'center', maxWidth: 260 },
});
