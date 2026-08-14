import { Text, Linking, StyleSheet } from 'react-native';
import { colors } from '../theme';

const URL_REGEX = /(https?:\/\/[^\s]+)/g;
const URL_TEST_REGEX = /^https?:\/\//;

// Nampilin teks biasa, tapi kalau ada link (http:// atau https://) di
// dalamnya, otomatis dibikin bisa diklik buat buka browser. Dipakai di
// kolom notes/catatan (Itinerary, Calendar, dll).
export default function LinkifiedText({ text, style }) {
  if (!text) return null;
  const parts = text.split(URL_REGEX);

  return (
    <Text style={style}>
      {parts.map((part, i) =>
        URL_TEST_REGEX.test(part) ? (
          <Text key={i} style={styles.link} onPress={() => Linking.openURL(part)}>
            {part}
          </Text>
        ) : (
          part
        )
      )}
    </Text>
  );
}

const styles = StyleSheet.create({
  link: { color: colors.teal, textDecorationLine: 'underline' },
});
