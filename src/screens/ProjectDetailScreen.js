import { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { doc, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useNavigation, useRoute } from '@react-navigation/native';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useMemberNames, useMemberColors } from '../hooks/useMemberNames';
import { getInitials } from '../utils/format';
import { colors } from '../theme';

import ItineraryModule from '../components/ItineraryModule';
import CalendarModule from '../components/CalendarModule';
import ChecklistModule from '../components/ChecklistModule';
import BudgetModule from '../components/BudgetModule';
import PackingModule from '../components/PackingModule';
import RsvpModule from '../components/RsvpModule';
import AlbumModule from '../components/AlbumModule';
import InviteModule from '../components/InviteModule';
import SettingsModule from '../components/SettingsModule';

const MODULE_LABEL = {
  itinerary: 'Itinerary', calendar: 'Calendar', checklist: 'Checklist', rsvp: 'Guests',
  budget: 'Expenses', packing: 'Packing', album: 'Album',
};

export default function ProjectDetailScreen() {
  const { user } = useAuth();
  const navigation = useNavigation();
  const route = useRoute();
  const { projectId } = route.params;
  const insets = useSafeAreaInsets();

  const [project, setProject] = useState(null);
  const [tab, setTab] = useState(null);

  useEffect(() => {
    // Tandain project ini "udah dilihat" sama user ini, biar Beranda
    // gak lagi nunjukin titik merah buat project yang sama.
    updateDoc(doc(db, 'users', user.uid), {
      [`lastSeenProjects.${projectId}`]: serverTimestamp(),
    }).catch(() => {});
  }, [projectId, user.uid]);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'projects', projectId), (snap) => {
      if (snap.exists()) {
        const data = { id: snap.id, ...snap.data() };
        setProject(data);
        setTab((prev) => prev || data.modules?.[0] || 'itinerary');
      }
    });
    return unsub;
  }, [projectId]);

  const memberNames = useMemberNames(project?.members);
  const memberColors = useMemberColors(project?.members);

  if (!project) {
    return (
      <View style={[styles.safe, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={colors.teal} size="large" />
      </View>
    );
  }

  const modules = project.modules || [];
  const tabs = [...modules, 'invite', 'settings'];

  return (
    <View style={styles.safe}>
      <LinearGradient
        colors={[colors.headerGradientStart, colors.headerGradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 10 }]}
      >
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backWrap}>
          <Text style={styles.back}>← Home</Text>
        </TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.headerTitle}>{project.name}</Text>
          <View style={styles.avatars}>
            {(project.members || []).slice(0, 6).map((uid) => (
              <View key={uid} style={[styles.avatar, { backgroundColor: memberColors[uid] }]}>
                <Text style={styles.avatarText}>{getInitials(memberNames[uid])}</Text>
              </View>
            ))}
          </View>
        </View>
      </LinearGradient>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll} contentContainerStyle={styles.tabsRow}>
        {tabs.map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.tabOn]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextOn]}>
              {t === 'invite' ? 'Invite' : t === 'settings' ? 'Settings' : MODULE_LABEL[t] || t}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={{ flex: 1, paddingHorizontal: 18 }}>
        {tab === 'itinerary' && <ItineraryModule projectId={projectId} userId={user.uid} memberNames={memberNames} />}
        {tab === 'calendar' && <CalendarModule projectId={projectId} userId={user.uid} memberNames={memberNames} memberColors={memberColors} />}
        {tab === 'checklist' && <ChecklistModule projectId={projectId} userId={user.uid} members={project.members || []} memberNames={memberNames} />}
        {tab === 'budget' && <BudgetModule projectId={projectId} userId={user.uid} members={project.members || []} memberNames={memberNames} />}
        {tab === 'packing' && <PackingModule projectId={projectId} userId={user.uid} members={project.members || []} memberNames={memberNames} />}
        {tab === 'rsvp' && <RsvpModule projectId={projectId} userId={user.uid} />}
        {tab === 'album' && <AlbumModule projectId={projectId} userId={user.uid} memberNames={memberNames} />}
        {tab === 'invite' && <InviteModule project={project} />}
        {tab === 'settings' && <SettingsModule project={project} userId={user.uid} memberNames={memberNames} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  backWrap: { marginBottom: 8 },
  back: { fontSize: 12, color: colors.inkSoft },
  header: {
    borderBottomLeftRadius: 24, borderBottomRightRadius: 24,
    paddingHorizontal: 20, paddingBottom: 20, marginBottom: 12,
  },
  headerTitle: { fontSize: 27, fontWeight: '700', color: colors.ink, textAlign: 'center' },
  avatars: { flexDirection: 'row', marginTop: 10 },
  avatar: {
    width: 25, height: 25, borderRadius: 13, backgroundColor: colors.tealLight,
    borderWidth: 2, borderColor: colors.white, alignItems: 'center', justifyContent: 'center', marginLeft: -8,
  },
  avatarText: { fontSize: 9, fontWeight: '700', color: colors.white },
  tabsScroll: { flexGrow: 0, marginHorizontal: 18, marginBottom: 12 },
  tabsRow: {
    flexDirection: 'row', gap: 4, backgroundColor: colors.white, borderRadius: 12,
    padding: 4, borderWidth: 1, borderColor: colors.line,
  },
  tab: { paddingVertical: 8, paddingHorizontal: 13, borderRadius: 9 },
  tabOn: { backgroundColor: colors.ink },
  tabText: { fontSize: 11.5, fontWeight: '700', color: colors.inkSoft },
  tabTextOn: { color: colors.paper },
});
