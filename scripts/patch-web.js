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
  html, body { touch-action: manipulation; margin: 0; padding: 0; }
  /* iOS sengaja nyisain ±53px paling bawah layar buat area gesture
     home-indicator — app web/PWA gak diizinin gambar sampai situ,
     beda dari app native asli. Daripada berantem sama batasan OS
     yang gak bisa ditembus ini, kita samain aja warnanya sama tab
     bar, biar kesannya emang disengaja bukan bug. */
  html, body {
    height: 100% !important;
    overflow: hidden !important;
    background-color: #F9FAFB !important;
  }
  #root {
    position: fixed !important;
    inset: 0 !important;
    display: flex !important;
  }
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
<script>
  (function () {
    // BUG WEBKIT YANG UDAH DIKENAL: di PWA standalone iOS, begitu keyboard
    // muncul pertama kali (nge-tap kolom isian), tinggi layar yang
    // "kebaca" (innerHeight) NYUSUT dan gak balik lagi walau keyboard-nya
    // ditutup — nyisa celah kosong terus-terusan sampai app-nya di-force-
    // quit total. Ini bukan salah CSS kita, ini bug WebKit di level OS.
    //
    // Solusinya: setelah keyboard ketutup (kolom isian di-blur), kita
    // "paksa" WebKit ngitung ulang tinggi layar — caranya nyembunyiin
    // #root sebentar (display:none) terus munculin lagi, ini bikin
    // WebKit kepaksa reflow dan biasanya balik ke ukuran yang bener.
    var maxVH = window.innerHeight;
    window.addEventListener('resize', function () {
      maxVH = Math.max(maxVH, window.innerHeight);
    });

    function healViewport() {
      if (maxVH - window.innerHeight <= 4) return; // gak "nyangkut", gak perlu diapa-apain
      var el = document.getElementById('root');
      if (!el) return;
      el.style.setProperty('display', 'none', 'important');
      void el.offsetHeight; // paksa reflow sinkron
      el.style.removeProperty('display');
    }

    // "focusout" (bukan "blur") dipakai karena event ini nge-bubble ke
    // document, jadi bisa nangkep SEMUA kolom isian di app ini sekaligus
    // tanpa perlu pasang listener manual satu-satu ke tiap form.
    document.addEventListener('focusout', function (e) {
      var tag = e.target && e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') {
        setTimeout(healViewport, 140);
      }
    }, true);
  })();
</script>
`;

html = html.replace('</head>', `${tagsToInject}</head>`);
fs.writeFileSync(indexPath, html);
console.log('✓ index.html dipatch dengan tag PWA + zoom dimatikan');
