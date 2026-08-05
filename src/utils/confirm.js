import { Platform, Alert } from 'react-native';

// `Alert.alert()` bawaan React Native gak selalu jalan konsisten pas
// di-export ke web (kadang gak muncul apa-apa) — jadi kita pakai
// `window.confirm()` browser biasa buat web, dan Alert.alert asli
// buat iOS/Android.
export function confirmAction(title, message, confirmLabel = 'Delete') {
  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
}

// Sama kayak di atas tapi buat pesan info doang (cuma tombol OK, gak
// butuh jawaban ya/tidak) — misal notifikasi "cek email kamu" setelah
// reset password.
export function alertMessage(title, message) {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
    return;
  }
  Alert.alert(title, message);
}
