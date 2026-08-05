import { useEffect, useState, useCallback } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native';
import { doc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { useRoute, useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { colors } from '../theme';

const PHASE_LABEL = {
  'auth-wait': 'Checking sign-in status...',
  'lookup': 'Looking up invite link...',
  'joining': 'Adding you to the project...',
};

export default function JoinScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { user, loading } = useAuth();
  const { token } = route.params || {};
  const [status, setStatus] = useState('checking');
  const [phase, setPhase] = useState('auth-wait');
  const [errorDetail, setErrorDetail] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    // Jaga-jaga: kalau proses macet lebih dari 15 detik, tampilin error
    // jelas — TERMASUK tahapan persis di mana dia macet, biar gampang
    // didiagnosa (bukan cuma "gagal" doang tanpa detail).
    const timeout = setTimeout(() => {
      setStatus((s) => {
        if (s === 'checking') {
          let detail;
          if (!token) {
            detail = 'No invite token found in the link. Try scanning the QR code again.';
          } else {
            detail = `Stuck at: "${PHASE_LABEL[phase] || phase}". Check your connection and try again.`;
          }
          setErrorDetail(detail);
          return 'error';
        }
        return s;
      });
    }, 15000);

    if (loading || !token) { setPhase('auth-wait'); return () => clearTimeout(timeout); }
    if (!user) {
      // Belum login — simpan token dulu, lanjut proses join otomatis
      // setelah user selesai login/daftar.
      AsyncStorage.setItem('pendingInviteToken', token);
      navigation.replace('Login');
      return () => clearTimeout(timeout);
    }
    joinProject().finally(() => clearTimeout(timeout));
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user, token, attempt]);

  async function joinProject() {
    try {
      setPhase('lookup');
      const inviteSnap = await getDoc(doc(db, 'invites', token));
      if (!inviteSnap.exists()) {
        setStatus('not-found');
        return;
      }
      const { projectId } = inviteSnap.data();
      setPhase('joining');
      await updateDoc(doc(db, 'projects', projectId), {
        members: arrayUnion(user.uid),
      });
      await AsyncStorage.removeItem('pendingInviteToken');
      navigation.replace('ProjectDetail', { projectId });
    } catch (err) {
      console.error('Join failed:', err);
      setErrorDetail(`${err.code || ''} ${err.message || ''}`.trim());
      setStatus('error');
    }
  }

  const handleRetry = useCallback(() => {
    setStatus('checking');
    setErrorDetail('');
    setPhase('auth-wait');
    setAttempt((a) => a + 1);
  }, []);

  if (status === 'not-found') {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Invalid invite link</Text>
        <Text style={styles.text}>This invite link is invalid or no longer active.</Text>
      </View>
    );
  }

  if (status === 'error') {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Failed to join</Text>
        <Text style={styles.text}>{errorDetail || 'Unknown error, please try again.'}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={handleRetry}>
          <Text style={styles.retryBtnText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.teal} size="large" />
      <Text style={[styles.text, { marginTop: 14 }]}>{PHASE_LABEL[phase] || 'Joining project...'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, padding: 24 },
  title: { fontSize: 17, fontWeight: '700', color: colors.ink, marginBottom: 8, textAlign: 'center' },
  text: { fontSize: 13, color: colors.inkSoft, textAlign: 'center' },
  retryBtn: { marginTop: 20, backgroundColor: colors.amber, borderRadius: 10, paddingVertical: 11, paddingHorizontal: 28 },
  retryBtnText: { color: colors.white, fontWeight: '700', fontSize: 13 },
});
