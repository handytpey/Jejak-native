// Expo export gak otomatis nambahin tag PWA (manifest, apple-touch-icon,
// dll) ke index.html — script ini nambahinnya setelah proses export,
// biar "Add to Home Screen" di iPhone hasilnya bagus (ada icon, mode
// standalone tanpa address bar Safari, dll).
const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '..', 'dist', 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');

// Matiin pinch-zoom / double-tap zoom — Expo default viewport-nya masih
// ngizinin zoom, ganti jadi maximum-scale=1 + user-scalable=no.
html = html.replace(
  /<meta name="viewport"[^>]*>/,
  '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />'
);

const tagsToInject = `
<link rel="manifest" href="/manifest.json">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Jejak">
<style>
  html, body { touch-action: manipulation; }
  /* "100%" kadang gak pas sama tinggi layar asli di Safari iPhone
     (soal dynamic toolbar), bikin ada celah kosong di bawah. "100dvh"
     itu unit yang emang dirancang buat nyari tinggi layar SEBENARNYA. */
  html, body, #root { height: 100dvh !important; }
  /* Matiin popup "Copy / Look Up" yang muncul kalau tap-hold teks —
     itu perilaku browser Safari, bukan app native beneran. Tetap
     diizinin di kolom isian (input/textarea) biar orang masih bisa
     copy-paste pas ngetik. */
  * {
    -webkit-touch-callout: none;
    -webkit-user-select: none;
    user-select: none;
  }
  input, textarea {
    -webkit-touch-callout: default;
    -webkit-user-select: text;
    user-select: text;
  }
</style>
`;

html = html.replace('</head>', `${tagsToInject}</head>`);
fs.writeFileSync(indexPath, html);
console.log('✓ index.html dipatch dengan tag PWA + zoom dimatikan');
