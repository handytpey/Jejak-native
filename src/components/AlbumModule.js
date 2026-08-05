import { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, Image, FlatList, StyleSheet, Dimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  collection, doc, onSnapshot, addDoc, deleteDoc, serverTimestamp,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage, touchProject } from '../firebase';
import { colors } from '../theme';
import Lightbox from './Lightbox';

const { width } = Dimensions.get('window');
const TILE_SIZE = (width - 18 * 2 - 6 * 2) / 3;

export default function AlbumModule({ projectId, userId, memberNames }) {
  const [photos, setPhotos] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'projects', projectId, 'photos'), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.uploadedAtMs || 0) - (a.uploadedAtMs || 0));
      setPhotos(list);
    });
    return unsub;
  }, [projectId]);

  async function pickAndUpload() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (result.canceled) return;

    setUploading(true);
    for (const asset of result.assets) {
      try {
        const response = await fetch(asset.uri);
        const blob = await response.blob();
        const filename = asset.uri.split('/').pop() || `${Date.now()}.jpg`;
        const path = `projects/${projectId}/photos/${Date.now()}-${filename}`;
        const storageRef = ref(storage, path);
        await uploadBytes(storageRef, blob);
        const url = await getDownloadURL(storageRef);
        await addDoc(collection(db, 'projects', projectId, 'photos'), {
          url, storagePath: path, uploadedBy: userId, uploadedAt: serverTimestamp(), uploadedAtMs: Date.now(),
        });
      } catch (err) {
        console.error('Upload failed:', err);
      }
    }
    setUploading(false);
    touchProject(projectId);
  }

  async function removePhoto(photo) {
    try {
      if (photo.storagePath) await deleteObject(ref(storage, photo.storagePath));
    } catch (err) {
      console.error('Failed to delete file:', err);
    }
    await deleteDoc(doc(db, 'projects', projectId, 'photos', photo.id));
    touchProject(projectId);
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.dashedBtn} onPress={pickAndUpload} disabled={uploading}>
        <Text style={styles.dashedText}>{uploading ? 'Uploading...' : '+ Add photos'}</Text>
      </TouchableOpacity>

      <FlatList
        data={photos}
        keyExtractor={(item) => item.id}
        numColumns={3}
        columnWrapperStyle={{ gap: 6 }}
        contentContainerStyle={{ gap: 6, marginTop: photos.length ? 12 : 0 }}
        renderItem={({ item, index }) => (
          <TouchableOpacity onPress={() => setLightboxIndex(index)}>
            <View style={styles.tile}>
              <Image source={{ uri: item.url }} style={styles.tileImage} />
              <TouchableOpacity style={styles.deleteBtn} onPress={() => removePhoto(item)}>
                <Text style={styles.deleteBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          !uploading && <Text style={styles.emptyText}>No photos yet. Add some from your phone.</Text>
        }
      />

      <Lightbox
        images={photos.map((p) => ({ uri: p.url }))}
        index={lightboxIndex ?? 0}
        visible={lightboxIndex !== null}
        onClose={() => setLightboxIndex(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 4 },
  dashedBtn: {
    borderWidth: 1.5, borderColor: colors.line, borderStyle: 'dashed', borderRadius: 14,
    paddingVertical: 14, alignItems: 'center',
  },
  dashedText: { color: colors.inkSoft, fontSize: 13, fontWeight: '600' },
  tile: { width: TILE_SIZE, height: TILE_SIZE, borderRadius: 10, overflow: 'hidden', backgroundColor: colors.line },
  tileImage: { width: '100%', height: '100%' },
  deleteBtn: {
    position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center',
  },
  deleteBtnText: { color: colors.white, fontSize: 9 },
  emptyText: { fontSize: 13, color: colors.inkSoft, textAlign: 'center', marginTop: 20 },
  lightbox: { flex: 1, backgroundColor: 'rgba(15,20,28,0.96)', alignItems: 'center', justifyContent: 'center' },
  lightboxImage: { width: '100%', height: '100%' },
  lightboxClose: {
    position: 'absolute', top: 50, right: 20, width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', zIndex: 1,
  },
  lightboxCloseText: { color: colors.white, fontSize: 16 },
});
