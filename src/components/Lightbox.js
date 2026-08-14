import { useRef, useState } from 'react';
import { Modal, View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { colors } from '../theme';

// Lightbox foto — app ini PWA-only (jalan di web/Safari), jadi kita
// implementasi pinch-zoom & double-tap zoom SENDIRI pakai touch events
// manual, soalnya browser punya pinch-zoom bawaan tapi kita udah
// matiin secara global (biar app gak sengaja ke-zoom pas dipakai
// normal) — jadi khusus di sini kita aktifin lagi scoped cuma buat
// foto ini doang.
export default function Lightbox({ images, index = 0, visible, onClose }) {
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const touchRef = useRef({});

  if (!visible || !images?.length) return null;
  const img = images[index];

  function dist(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function handleTouchStart(e) {
    if (e.touches.length === 2) {
      touchRef.current = { startDist: dist(e.touches), startScale: scale };
    } else if (e.touches.length === 1 && scale > 1) {
      touchRef.current = {
        panning: true,
        startX: e.touches[0].clientX - translate.x,
        startY: e.touches[0].clientY - translate.y,
      };
    }
  }

  function handleTouchMove(e) {
    if (e.touches.length === 2 && touchRef.current.startDist) {
      const newScale = Math.min(4, Math.max(1, touchRef.current.startScale * (dist(e.touches) / touchRef.current.startDist)));
      setScale(newScale);
      // Begitu balik ke skala normal (1x), posisi geser HARUS ikut
      // di-reset ke tengah — kalau enggak, fotonya "nyangkut" ke posisi
      // geser terakhir walau udah di-zoom out penuh.
      if (newScale <= 1) {
        setTranslate({ x: 0, y: 0 });
      }
    } else if (e.touches.length === 1 && touchRef.current.panning) {
      setTranslate({
        x: e.touches[0].clientX - touchRef.current.startX,
        y: e.touches[0].clientY - touchRef.current.startY,
      });
    }
  }

  function handleTouchEnd() {
    // Jaga-jaga tambahan: kalau touch berakhir pas skala udah balik ke
    // 1 (atau lebih kecil), pastiin posisi geser bersih juga.
    if (scale <= 1) setTranslate({ x: 0, y: 0 });
    touchRef.current = {};
  }

  function handleDoubleClick() {
    if (scale > 1) {
      setScale(1);
      setTranslate({ x: 0, y: 0 });
    } else {
      setScale(2.5);
    }
  }

  function handleClose() {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.closeBtn} onPress={handleClose}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
        {/* eslint-disable-next-line react/no-unknown-property */}
        <div
          style={{
            width: '100%', height: '100%', display: 'flex',
            alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onDoubleClick={handleDoubleClick}
        >
          {/* eslint-disable-next-line react/no-unknown-property */}
          <img
            src={img.uri}
            alt=""
            draggable={false}
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              transform: `translate(${scale <= 1 ? 0 : translate.x}px, ${scale <= 1 ? 0 : translate.y}px) scale(${scale})`,
              transition: touchRef.current.startDist || touchRef.current.panning ? 'none' : 'transform 0.15s ease-out',
              touchAction: 'none',
              userSelect: 'none',
            }}
          />
        </div>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15,20,28,0.96)', alignItems: 'center', justifyContent: 'center' },
  closeBtn: {
    position: 'absolute', top: 50, right: 20, width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', zIndex: 1,
  },
  closeText: { color: colors.white, fontSize: 16 },
});
