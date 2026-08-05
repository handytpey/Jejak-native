import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../theme';

// Dipakai di dua tempat: NewProjectScreen (buat rencanain kegiatan
// harian pas bikin project baru) dan ItineraryModule (tab Calendar).
export default function CalendarGrid({ items, hasEventFn, dotColorsFn, month, setMonth, selectedDate, setSelectedDate }) {
  const year = month.getFullYear();
  const mo = month.getMonth();
  const firstWeekday = new Date(year, mo, 1).getDay();
  const daysInMonth = new Date(year, mo + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  // Kalau hasEventFn dikasih (buat event yang bisa berulang), pakai itu.
  // Kalau enggak, pakai cara lama: cocokin persis ke field "date".
  const itemDates = hasEventFn ? null : new Set(items.map((i) => i.date).filter(Boolean));
  const todayISO = new Date().toISOString().slice(0, 10);

  function isoFor(day) {
    return `${year}-${String(mo + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return (
    <View style={{ marginBottom: 4 }}>
      <View style={calStyles.nav}>
        <TouchableOpacity style={calStyles.navBtn} onPress={() => setMonth(new Date(year, mo - 1, 1))}>
          <Text style={calStyles.navBtnText}>‹</Text>
        </TouchableOpacity>
        <Text style={calStyles.monthLabel}>
          {month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </Text>
        <TouchableOpacity style={calStyles.navBtn} onPress={() => setMonth(new Date(year, mo + 1, 1))}>
          <Text style={calStyles.navBtnText}>›</Text>
        </TouchableOpacity>
      </View>
      <View style={calStyles.dowRow}>
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <Text key={i} style={calStyles.dow}>{d}</Text>
        ))}
      </View>
      {weeks.map((week, wi) => (
        <View key={wi} style={calStyles.weekRow}>
          {week.map((day, di) => {
            if (!day) return <View key={di} style={calStyles.dayCell} />;
            const iso = isoFor(day);
            const isSel = iso === selectedDate;
            const isToday = iso === todayISO;
            return (
              <TouchableOpacity
                key={di}
                style={[calStyles.dayCell, isSel && calStyles.dayCellSel, isToday && !isSel && calStyles.dayCellToday]}
                onPress={() => setSelectedDate(iso)}
              >
                <Text style={[calStyles.dayNum, isSel && calStyles.dayNumSel]}>{day}</Text>
                {dotColorsFn ? (
                  <View style={calStyles.dotRow}>
                    {dotColorsFn(iso).slice(0, 3).map((c, di2) => (
                      <View key={di2} style={[calStyles.multiDot, { backgroundColor: c }]} />
                    ))}
                  </View>
                ) : (
                  (hasEventFn ? hasEventFn(iso) : itemDates.has(iso)) && (
                    <View style={[calStyles.dot, isSel && calStyles.dotSel]} />
                  )
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const calStyles = StyleSheet.create({
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  navBtn: {
    width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: colors.line,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white,
  },
  navBtnText: { fontSize: 14, color: colors.inkSoft },
  monthLabel: { fontSize: 15, fontWeight: '700', color: colors.ink },
  dowRow: { flexDirection: 'row', marginBottom: 2 },
  dow: { flex: 1, textAlign: 'center', fontSize: 10, color: colors.inkSoft, fontWeight: '700' },
  weekRow: { flexDirection: 'row' },
  dayCell: {
    flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center',
    borderRadius: 10, margin: 1,
  },
  dayCellSel: { backgroundColor: colors.ink },
  dayCellToday: { borderWidth: 1.5, borderColor: colors.amberDeep },
  dayNum: { fontSize: 12.5, color: colors.ink },
  dayNumSel: { color: colors.paper },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.amber, marginTop: 2 },
  dotSel: { backgroundColor: colors.amber },
  dotRow: { flexDirection: 'row', gap: 2, marginTop: 2 },
  multiDot: { width: 4, height: 4, borderRadius: 2 },
});
