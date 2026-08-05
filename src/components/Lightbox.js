import ImageViewing from 'react-native-image-viewing';

// Versi native (iOS/Android) — pakai library yang support pinch-to-zoom
// beneran. File ini OTOMATIS dipakai Metro bundler cuma buat native,
// versi web ada di Lightbox.web.js (biar gak bikin build web gagal).
export default function Lightbox({ images, index = 0, visible, onClose }) {
  return (
    <ImageViewing
      images={images || []}
      imageIndex={index}
      visible={visible}
      onRequestClose={onClose}
    />
  );
}
