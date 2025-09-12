# Permissions

Daftar izin yang digunakan beserta alasannya (lihat `manifest.json`).

- `tabs`
  - Mendapatkan tab aktif, membaca URL untuk menentukan domain, me-reload tab setelah restore/clean, dan enumerasi tab untuk pembaruan favicon.
- `cookies`
  - Membaca semua cookies (dengan filter domain), menghapus cookies per domain, dan menyetel ulang cookies saat pemulihan sesi.
- `storage`
  - Menyimpan daftar sesi (`sessions`) serta cache ikon (`tabIconsCacheV1`) di `chrome.storage.local`.
- `scripting`
  - Menjalankan fungsi in-page untuk membaca/menulis `localStorage`/`sessionStorage` pada tab aktif.
- `history`
  - Mencari dan menghapus entri riwayat untuk domain saat ini ketika menjalankan `Clean Current Tab Data`.
- `browsingData`
  - Disiapkan untuk pembersihan cache; saat ini pembersihan cache global dinonaktifkan (komentar di `DataManager`).
- `host_permissions: <all_urls>`
  - Diperlukan untuk bekerja lintas situs saat membaca/menulis cookies dan mengeksekusi script terkait storage.

Catatan keamanan: izin-izin di atas hanya digunakan on-demand berdasarkan aksi pengguna di UI popup/modals. Tidak ada telemetry eksternal.
