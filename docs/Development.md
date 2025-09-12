# Development Guide

## Menjalankan Secara Lokal
1. Buka `chrome://extensions` dan aktifkan `Developer mode`.
2. Klik `Load unpacked`, pilih folder root repo ini (`SesWi/`).
3. Pin ikon ekstensi untuk akses cepat.
4. Klik ikon untuk membuka popup; ujicoba tiap tab: `Current`, `Group Sessions`, `Manage`.

## Debugging
- Buka DevTools untuk popup (klik kanan pada popup → Inspect) untuk melihat log/error.
- Aktifkan log internal:
```js
localStorage.setItem('__SES_DEBUG__', '1');
// atau selama runtime
window.__SES_DEBUG__ = true;
```
- Log Service Worker: buka `chrome://extensions`, pada kartu ekstensi klik `Service worker` untuk melihat console background.

## Struktur & Area Kunci
- UI: `popup.html`, `popup.js`, dan gaya di folder `style/`.
- Layanan background: `background/service-worker.js` (tipe module, MV3).
- Logika API Chrome: `modules/ChromeAPI/` (DataManager, CookieGrabber, LocalGrabber, IconsGrabber).
- Komponen UI tab & modal: `modules/Tabs/` (Current-Tab, Group-Tabs, Manage-Tab, ModalManager).
- Enkripsi: `modules/Encryption/EncryptionUtils.js` + `modules/Encryption/sjcl.js`.
- Utilitas: `modules/Utilities/` (GlobalUtility, GlobalPagination, BackupRestoreJSON, BackupRestoreOWI, BackupDataValidator).

## Pola Umum
- Semua operasi yang berpotensi berat (hapus/set cookie dalam jumlah banyak, delete riwayat) dilakukan secara terchunk untuk menghindari saturasi API Chrome.
- Cache info tab (400ms) di `DataManager.getCurrentTabInfo()` untuk mengurangi query berulang.
- Cache favicon domain di `IconsGrabber` (TTL 24 jam, dibatasi maksimal entri) dan disimpan ke `chrome.storage.local`.
- Validasi sesi di `Utilities/GlobalUtility.validateSession()`; grouping domain di `DataManager.getAllSessionsGrouped()`.

## Alur Pengembangan Fitur
1. Tambah UI di `popup.html`/`style/*.css` bila perlu.
2. Tambah handler di `popup.js`, panggil metode pada modul tab terkait (`modules/Tabs/*`).
3. Bila menyentuh API Chrome atau storage: tambahkan/ubah fungsi di `modules/ChromeAPI/*`.
4. Untuk backup/restore atau utilitas umum: tambahkan di `modules/Utilities/*`.
5. Uji pada domain uji (bukan Google/Microsoft) terlebih dahulu, karena domain sensitif bisa memiliki perilaku khusus.

## Catatan Izin & Keamanan
- Izin `cookies`, `tabs`, `scripting`, `history`, dan `host_permissions: <all_urls>` diperlukan agar fitur berjalan.
- Data sesi disimpan secara lokal dan tidak dienkripsi; jangan commit data hasil `chrome.storage.local` ke repo.
- Gunakan format OWI (terenkripsi) untuk distribusi backup di lingkungan yang tidak terpercaya.

## Tips Troubleshooting
- Cookies tidak ter-restore: pastikan tab saat ini berada pada domain yang sama. Lihat gating di `ModalManager._wireSessionActionButtons()` yang memeriksa `isDomainMatch()`.
- Tidak ada cookies terdeteksi: beberapa halaman `chrome://` atau `chrome-extension://` tidak memiliki cookies dan diblokir oleh Chrome.
- Pembersihan tidak lengkap: API `browsingData` untuk clear cache per-origin tidak konsisten; saat ini implementasi fokus pada cookies, LS/SS, dan riwayat domain.
- OWI gagal didekripsi: pastikan password benar; lihat `EncryptionUtils.decryptSession()` untuk pesan error spesifik.

## Rekomendasi Peningkatan (Dev)
- Unit test modular untuk validator dan utilitas (menggunakan Jest + jsdom bila dipindahkan ke lingkungan bundler).
- Menambahkan linter/formatter (ESLint + Prettier) dan GitHub Actions untuk CI.
- Opsi `chrome.storage.sync` (perhatikan batas ukuran) untuk sinkronisasi ringan.
