// Pakai window.confirm/alert bawaan browser — lebih konsisten daripada
// Alert.alert React Native yang kadang gak muncul di web.
export function confirmAction(title, message) {
  return Promise.resolve(window.confirm(`${title}\n\n${message}`));
}

// Sama kayak di atas tapi buat pesan info doang (cuma tombol OK, gak
// butuh jawaban ya/tidak) — misal notifikasi "cek email kamu" setelah
// reset password.
export function alertMessage(title, message) {
  window.alert(`${title}\n\n${message}`);
}
