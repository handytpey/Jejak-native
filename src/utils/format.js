const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatDate(isoDate) {
  if (!isoDate) return '';
  const d = new Date(isoDate + 'T00:00:00');
  if (isNaN(d)) return isoDate;
  return `${DAYS[d.getDay()]}, ${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`;
}

export function getInitials(name) {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function timeAgo(timestamp) {
  if (!timestamp?.toDate) return '';
  const then = timestamp.toDate();
  const diffMs = Date.now() - then.getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day === 1) return 'yesterday';
  if (day < 7) return `${day}d ago`;
  return then.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
}

export function formatCurrency(n, currency = 'IDR') {
  const symbols = { IDR: 'Rp', USD: '$', EUR: '€', SGD: 'S$', MYR: 'RM', JPY: '¥', AUD: 'A$', GBP: '£' };
  return `${symbols[currency] || currency} ${Math.round(n).toLocaleString('en-US')}`;
}
