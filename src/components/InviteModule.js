import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import { colors } from '../theme';

// Sekarang app native ini punya alur join sendiri (lewat linking config
// di App.js + JoinScreen), jadi invite link nunjuk ke domain app native
// ini sendiri, bukan lagi ke app web yang terpisah.
const WEB_APP_URL = 'https://jejak-native.vercel.app';

export default function InviteModule({ project }) {
  const inviteUrl = `${WEB_APP_URL}/j/${project.inviteToken}`;

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Anyone who scans or opens this link will instantly become a member.</Text>
      <View style={styles.qrBox}>
        <QRCode value={inviteUrl} size={160} color={colors.ink} backgroundColor={colors.white} />
      </View>
      <View style={styles.linkRow}>
        <Text style={styles.linkText} numberOfLines={1}>{inviteUrl}</Text>
        <TouchableOpacity onPress={() => Clipboard.setStringAsync(inviteUrl)}>
          <Text style={styles.copyText}>COPY</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingTop: 20 },
  text: { fontSize: 12.5, color: colors.inkSoft, textAlign: 'center', maxWidth: 230, marginBottom: 20, lineHeight: 18 },
  qrBox: {
    backgroundColor: colors.white, borderRadius: 18, padding: 18, marginBottom: 18,
    borderWidth: 1, borderColor: colors.line,
  },
  linkRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.white,
    borderWidth: 1, borderColor: colors.line, borderRadius: 11, paddingVertical: 10, paddingHorizontal: 13, width: '100%',
  },
  linkText: { flex: 1, fontSize: 11, color: colors.inkSoft },
  copyText: { fontSize: 10.5, color: colors.teal, fontWeight: '700' },
});
