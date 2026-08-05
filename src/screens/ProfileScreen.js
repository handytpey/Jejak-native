import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { colors } from '../theme';
import { MEMBER_COLOR_OPTIONS, updateCachedMember } from '../hooks/useMemberNames';

const APP_URL = 'https://jejak-native.vercel.app';

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const [myColor, setMyColor] = useState(MEMBER_COLOR_OPTIONS[0]);
  const [loadingColor, setLoadingColor] = useState(true);

  useEffect(() => {
    if (!user) return;
    getDoc(doc(db, 'users', user.uid)).then((snap) => {
      if (snap.exists() && snap.data().color) setMyColor(snap.data().color);
      setLoadingColor(false);
    });
  }, [user]);

  async function pickColor(color) {
    setMyColor(color);
    await updateDoc(doc(db, 'users', user.uid), { color });
    updateCachedMember(user.uid, { color });
  }

  return (
    <View style={styles.safe}>
      <LinearGradient
        colors={[colors.headerGradientStart, colors.headerGradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 16 }]}
      >
        <Text style={styles.headerTitle}>Profile</Text>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.card}>
          <View style={[styles.avatar, { backgroundColor: myColor }]}>
            <Text style={styles.avatarText}>
              {(user?.displayName || user?.email || '?').slice(0, 1).toUpperCase()}
            </Text>
          </View>
          <View>
            <Text style={styles.name}>{user?.displayName || 'No name'}</Text>
            <Text style={styles.email}>{user?.email}</Text>
          </View>
        </View>

        <Text style={styles.label}>YOUR COLOR</Text>
        <Text style={styles.hint}>Used for your avatar across every project you're in.</Text>
        {loadingColor ? (
          <ActivityIndicator color={colors.teal} style={{ marginVertical: 12 }} />
        ) : (
          <View style={styles.swatchRow}>
            {MEMBER_COLOR_OPTIONS.map((c) => (
              <TouchableOpacity
                key={c}
                style={[styles.swatch, { backgroundColor: c }, myColor === c && styles.swatchSelected]}
                onPress={() => pickColor(c)}
              >
                {myColor === c && <Text style={styles.swatchCheck}>✓</Text>}
              </TouchableOpacity>
            ))}
          </View>
        )}

        <Text style={styles.label}>INVITE FRIENDS TO JEJAK</Text>
        <Text style={styles.hint}>Anyone who scans this can download and start using the app.</Text>
        <View style={styles.inviteCard}>
          <QRCode value={APP_URL} size={140} color={colors.ink} backgroundColor={colors.white} />
          <TouchableOpacity
            style={styles.copyBtn}
            onPress={() => Clipboard.setStringAsync(APP_URL)}
          >
            <Text style={styles.copyBtnText}>Copy link</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <Text style={styles.logoutText}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { padding: 18, paddingBottom: 40 },
  header: {
    borderBottomLeftRadius: 24, borderBottomRightRadius: 24,
    paddingHorizontal: 20, paddingBottom: 20,
  },
  headerTitle: { fontSize: 26, fontWeight: '700', color: colors.ink },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.white, borderRadius: 18, padding: 16,
    borderWidth: 1, borderColor: colors.line, marginTop: 18, marginBottom: 26,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: colors.white, fontSize: 17, fontWeight: '700' },
  name: { fontSize: 15, fontWeight: '700', color: colors.ink },
  email: { fontSize: 13, color: colors.inkSoft, marginTop: 2 },
  label: { fontSize: 10, color: colors.inkSoft, letterSpacing: 0.5, marginBottom: 4 },
  hint: { fontSize: 12, color: colors.inkSoft, marginBottom: 12 },
  swatchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 30 },
  swatch: {
    width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'transparent',
  },
  swatchSelected: { borderColor: colors.ink },
  swatchCheck: { color: colors.white, fontSize: 15, fontWeight: '700' },
  inviteCard: {
    backgroundColor: colors.white, borderRadius: 18, padding: 20, alignItems: 'center',
    borderWidth: 1, borderColor: colors.line, marginBottom: 26,
  },
  copyBtn: {
    marginTop: 14, borderWidth: 1, borderColor: colors.line, borderRadius: 10,
    paddingVertical: 9, paddingHorizontal: 18,
  },
  copyBtnText: { fontSize: 12.5, color: colors.teal, fontWeight: '700' },
  logoutBtn: {
    borderWidth: 1, borderColor: '#E2A5A5', borderRadius: 10, paddingVertical: 12, alignItems: 'center',
  },
  logoutText: { color: colors.danger, fontWeight: '700', fontSize: 13 },
});
