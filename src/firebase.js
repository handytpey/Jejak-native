import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  doc, updateDoc, serverTimestamp,
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

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
export const auth = getAuth(app);

// Offline cache Firestore — data yang udah pernah kebuka disimpen lokal
// (IndexedDB browser), jadi pas buka project yang sama lagi, datanya
// langsung muncul dari cache (instan) sambil sync ke server di
// belakang layar, bukan nunggu network round-trip dari awal tiap kali.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});
export const storage = getStorage(app);

// Dipanggil setiap kali ada perubahan di dalam sebuah project (kegiatan
// baru, item dicentang, dll) — biar Beranda tau project itu "ada
// yang baru" dan bisa nunjukin titik merah, tanpa perlu notifikasi
// push beneran (yang butuh server tambahan).
export function touchProject(projectId) {
  return updateDoc(doc(db, 'projects', projectId), { lastActivityAt: serverTimestamp() }).catch(() => {});
}
