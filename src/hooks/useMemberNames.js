import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

export const MEMBER_COLOR_OPTIONS = [
  '#4A7A8C', // teal (default)
  '#A67722', // amber deep
  '#8A9A5B', // olive
  '#C1662F', // burnt orange
  '#7A6BA8', // plum
  '#B5556B', // rose
  '#5C7A9E', // slate blue
  '#6E8B5A', // forest
];

// Cache di level modul — nama DAN warna member sama-sama disimpan di sini,
// biar gak fetch berulang tiap pindah layar.
const memberCache = {};

function useMemberField(uids, field, fallback) {
  const [, forceRender] = useState(0);
  const key = JSON.stringify([...new Set((uids || []).filter(Boolean))].sort());

  useEffect(() => {
    let cancelled = false;
    const uniqueUids = [...new Set((uids || []).filter(Boolean))];
    const missing = uniqueUids.filter((uid) => !(uid in memberCache));
    if (missing.length === 0) return;

    Promise.all(
      missing.map(async (uid) => {
        try {
          const snap = await getDoc(doc(db, 'users', uid));
          return [uid, snap.exists() ? snap.data() : {}];
        } catch {
          return [uid, {}];
        }
      })
    ).then((pairs) => {
      if (cancelled) return;
      pairs.forEach(([uid, data]) => {
        memberCache[uid] = {
          name: data.name || `User ${uid.slice(0, 4)}`,
          color: data.color || MEMBER_COLOR_OPTIONS[0],
        };
      });
      forceRender((n) => n + 1);
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const result = {};
  (uids || []).forEach((uid) => {
    if (uid) result[uid] = memberCache[uid]?.[field] ?? fallback;
  });
  return result;
}

export function useMemberNames(uids) {
  return useMemberField(uids, 'name', undefined);
}

export function useMemberColors(uids) {
  return useMemberField(uids, 'color', MEMBER_COLOR_OPTIONS[0]);
}

// Dipanggil dari Profile setelah user ganti warna, biar cache-nya
// langsung ke-update tanpa perlu fetch ulang dari Firestore.
export function updateCachedMember(uid, patch) {
  memberCache[uid] = { ...memberCache[uid], ...patch };
}
