import { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, SafeAreaView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../contexts/AuthContext';
import { colors } from '../theme';
import { alertMessage } from '../utils/confirm';
import ClearableInput from '../components/ClearableInput';

export default function LoginScreen() {
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [fromInvite, setFromInvite] = useState(false);
  const { login, register, resetPassword } = useAuth();

  useEffect(() => {
    AsyncStorage.getItem('pendingInviteToken').then((token) => setFromInvite(!!token));
  }, []);

  async function handleSubmit() {
    setError('');
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(name, email, password);
      }
    } catch (err) {
      setError(translateError(err.code));
    }
  }

  async function handleForgotPassword() {
    if (!email.trim()) {
      alertMessage('Enter your email first', 'Type your email in the field above, then tap "Forgot password?" again.');
      return;
    }
    try {
      await resetPassword(email.trim());
      alertMessage('Check your email', `We sent a password reset link to ${email.trim()}.`);
    } catch (err) {
      alertMessage('Something went wrong', translateError(err.code));
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <View style={styles.container}>
          <View style={styles.authMark}>
            <Text style={styles.authMarkText}>J</Text>
          </View>

          {fromInvite && (
            <View style={styles.inviteBanner}>
              <Text style={styles.inviteBannerText}>
                You're joining a project via invite link. Sign in (or create an account) below to continue — you'll be added automatically right after.
              </Text>
            </View>
          )}

          <Text style={styles.title}>
            {mode === 'login' ? 'Sign in to Jejak' : 'Create an account'}
          </Text>
          <Text style={styles.subtitle}>
            One private space for itineraries and projects that always stay up to date for everyone.
          </Text>

          {mode === 'register' && (
            <View style={styles.field}>
              <Text style={styles.label}>NAME</Text>
              <ClearableInput style={styles.input} value={name} onChangeText={setName} />
            </View>
          )}
          <View style={styles.field}>
            <Text style={styles.label}>EMAIL</Text>
            <ClearableInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>PASSWORD</Text>
            <ClearableInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          {mode === 'login' && (
            <TouchableOpacity onPress={handleForgotPassword} style={{ alignSelf: 'flex-end', marginBottom: 14 }}>
              <Text style={styles.forgotText}>Forgot password?</Text>
            </TouchableOpacity>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity style={styles.button} onPress={handleSubmit}>
            <Text style={styles.buttonText}>{mode === 'login' ? 'Sign in' : 'Sign up'}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setMode(mode === 'login' ? 'register' : 'login')}>
            <Text style={styles.switchText}>
              {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
              <Text style={styles.switchLink}>{mode === 'login' ? 'Sign up here' : 'Sign in here'}</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function translateError(code) {
  const map = {
    'auth/email-already-in-use': 'This email is already registered.',
    'auth/invalid-email': 'Invalid email format.',
    'auth/weak-password': 'Password must be at least 6 characters.',
    'auth/user-not-found': 'Incorrect email or password.',
    'auth/wrong-password': 'Incorrect email or password.',
    'auth/invalid-credential': 'Incorrect email or password.',
  };
  return map[code] || 'Something went wrong, please try again.';
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  container: { flex: 1, justifyContent: 'center', paddingHorizontal: 28 },
  authMark: {
    width: 60, height: 60, borderRadius: 18, backgroundColor: colors.ink,
    alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 18,
  },
  authMarkText: { color: colors.amber, fontSize: 26, fontWeight: '700' },
  inviteBanner: {
    backgroundColor: colors.tealLight, borderRadius: 12, padding: 13, marginBottom: 18,
  },
  inviteBannerText: { fontSize: 12, color: colors.teal, lineHeight: 17, textAlign: 'center' },
  title: { fontSize: 24, fontWeight: '700', color: colors.ink, textAlign: 'center', marginBottom: 6 },
  subtitle: { fontSize: 13, color: colors.inkSoft, textAlign: 'center', marginBottom: 24, lineHeight: 19 },
  field: { marginBottom: 14 },
  label: { fontSize: 10, color: colors.inkSoft, letterSpacing: 0.5, marginBottom: 6 },
  input: {
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line,
    borderRadius: 10, paddingHorizontal: 13, paddingVertical: 11, fontSize: 15, color: colors.ink,
  },
  error: { color: colors.danger, fontSize: 12, marginBottom: 10 },
  forgotText: { fontSize: 11.5, color: colors.teal, fontWeight: '600' },
  button: {
    backgroundColor: colors.amber, borderRadius: 12, paddingVertical: 13,
    alignItems: 'center', marginTop: 8, marginBottom: 16,
  },
  buttonText: { color: colors.white, fontSize: 14, fontWeight: '700' },
  switchText: { fontSize: 12, color: colors.inkSoft, textAlign: 'center' },
  switchLink: { color: colors.amberDeep, fontWeight: '600' },
});
