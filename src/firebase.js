import { Platform } from 'react-native';
import { initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, getReactNativePersistence } from 'firebase/auth';
import {
  initializeFirestore, getFirestore, persistentLocalCache, persistentMultipleTabManager,
  doc, updateDoc, serverTimestamp,
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Config yang sama persis dengan app web kamu — satu Firebase project
// yang sama dipakai bareng, data-nya nyambung (project yang udah dibuat
// di web bakal kelihatan juga di sini).
const firebaseConfig = {
  apiKey: 'AIzaSyBiTGNiQpywnsKxkd8eqte8Znicpu5fvFk',
  authDomain: 'sharedproject-c5e89.firebaseapp.com',
  projectId: 'sharedproject-c5e89',
  storageBucket: 'sharedproject-c5e89.firebasestorage.app',
  messagingSenderId: '191739811006',
  appId: '1:191739811006:web:9d96099cd7a8b90d733aef',
};

export const app = initializeApp(firebaseConfig);

// `getReactNativePersistence` cuma ada di HP asli (iOS/Android), gak ada
// pas dijalanin di mode "web preview" (`expo start --web`) — di situ
// firebase/auth otomatis pakai penyimpanan browser bawaan (localStorage),
// sama kayak app web biasa. Jadi kita cek dulu platform-nya.
export const auth =
  Platform.OS === 'web'
    ? getAuth(app)
    : initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });

// Offline cache Firestore — data yang udah pernah kebuka disimpen lokal
// (IndexedDB browser), jadi pas buka project yang sama lagi, datanya
// langsung muncul dari cache (instan) sambil sync ke server di
// belakang layar, bukan nunggu network round-trip dari awal tiap kali.
// Ini fitur khusus web (IndexedDB gak ada di runtime native asli), jadi
// di iOS/Android nanti otomatis pakai cara default Firestore.
export const db =
  Platform.OS === 'web'
    ? initializeFirestore(app, {
        localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
      })
    : getFirestore(app);
export const storage = getStorage(app);

// Dipanggil setiap kali ada perubahan di dalam sebuah project (kegiatan
// baru, item dicentang, dll) — biar Beranda tau project itu "ada
// yang baru" dan bisa nunjukin titik merah, tanpa perlu notifikasi
// push beneran (yang butuh server tambahan).
export function touchProject(projectId) {
  return updateDoc(doc(db, 'projects', projectId), { lastActivityAt: serverTimestamp() }).catch(() => {});
}
