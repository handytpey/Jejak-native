import { View, TextInput, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { colors } from '../theme';

// TextInput biasa, tapi otomatis muncul tombol "✕" di dalam kolom
// begitu ada isinya — tinggal tap buat ngosongin cepat. Di iOS native
// ini bisa pakai clearButtonMode bawaan, tapi itu gak jalan di web
// (react-native-web gak dukung), jadi kita bikin sendiri versi yang
// jalan konsisten di kedua platform. Untuk kolom multiline (notes),
// tombolnya ditaruh di pojok kanan ATAS (bukan di tengah), biar gak
// keliatan aneh nutupin teks yang panjang.
export default function ClearableInput({ style, value, onChangeText, multiline, ...props }) {
  return (
    <View style={multiline ? styles.wrapMultiline : styles.wrap}>
      <TextInput
        style={[style, styles.input]}
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        {...props}
      />
      {!!value && (
        <TouchableOpacity
          style={multiline ? styles.clearBtnMultiline : styles.clearBtn}
          onPress={() => onChangeText('')}
          hitSlop={8}
        >
          <Text style={styles.clearBtnText}>✕</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { justifyContent: 'center' },
  wrapMultiline: {},
  input: { paddingRight: 34 },
  clearBtn: {
    position: 'absolute', right: 10, width: 20, height: 20, borderRadius: 10,
    backgroundColor: colors.line, alignItems: 'center', justifyContent: 'center',
  },
  clearBtnMultiline: {
    position: 'absolute', right: 10, top: 10, width: 20, height: 20, borderRadius: 10,
    backgroundColor: colors.line, alignItems: 'center', justifyContent: 'center',
  },
  clearBtnText: { fontSize: 10, color: colors.white, fontWeight: '700' },
});
