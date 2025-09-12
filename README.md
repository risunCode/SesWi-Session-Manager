# SesWi — Advanced Session Manager (Chrome Extension)

SesWi adalah ekstensi Chrome (Manifest V3) untuk menyimpan dan mengelola sesi login per-domain dengan mudah. Ekstensi ini dapat menyimpan cookies serta snapshot `localStorage` dan `sessionStorage`, menampilkan daftar sesi aktif per domain, mengelompokkan sesi lintas domain, melakukan backup/restore (format JSON biasa atau OWI terenkripsi), serta membersihkan data tab saat ini secara selektif.

- Versi: 1.0.0
- Nama paket: `SesWi - Advanced Session manager`
- MV: 3 (Service Worker background)

## Fitur Utama
- Simpan sesi per domain (cookies + `localStorage` + `sessionStorage`).
- Pulihkan cookies untuk domain yang sama (hanya saat tab domain tersebut aktif).
- Tab `Current`: daftar sesi domain aktif dengan pagination dan highlight saat baru tersimpan.
- Tab `Group Sessions`: pengelompokan sesi per domain dengan tampilan expand dan pagination.
- Modal `Session Actions`: Restore, Edit nama, Replace, Delete, Backup JSON, Backup OWI + ringkasan masa berlaku cookie.
- `Manage` tab:
  - Backup seluruh sesi ke JSON atau OWI (terenkripsi password via SJCL).
  - Restore dari file `.json` / `.owi` lengkap dengan password verification (untuk OWI) dan inspector untuk memilih item.
  - Grouped Action: backup/delete berdasarkan pilihan domain.
  - Clean Current Tab Data: hapus cookies, local/session storage, dan riwayat domain; lalu reload.
- Cache favicon per domain agar UI lebih informatif dan cepat.

## Instalasi (Load Unpacked)
1. Clone atau unduh repo ini.
2. Buka Chrome > `chrome://extensions`.
3. Aktifkan `Developer mode` (pojok kanan atas).
4. Klik `Load unpacked` lalu pilih folder root repo ini.
5. Pin ikon ekstensi bila perlu.

## Penggunaan Singkat
- Klik ikon ekstensi untuk membuka popup.
- Bagian header menampilkan domain saat ini dan tombol `Add Session`.
- Tab `Current` menampilkan sesi untuk domain aktif. Klik kartu sesi untuk membuka `Session Actions`.
- Tab `Group Sessions` menampilkan sesi dari semua domain, dapat di-expand per domain.
- Tab `Manage`:
  - `Backup All Sessions`: pilih format JSON (tidak terenkripsi) atau OWI (terenkripsi password).
  - `Restore Sessions`: pilih file `.json`/`.owi`; untuk `.owi` masukkan password dan verifikasi; gunakan inspector untuk memilih.
  - `Select Grouped Action`: pilih domain, kemudian `Backup JSON`, `Backup OWI`, atau `Delete`.
  - `Clean Current Tab Data`: hapus cookies + local/session storage + riwayat untuk domain aktif, lalu reload.

Catatan: Pemulihan sesi (Restore) dibatasi agar hanya dilakukan ketika tab saat ini berada pada domain yang sama dengan sesi yang dipilih. Hal ini mencegah konflik pemulihan cookies lintas domain.

## Izin yang Digunakan
`manifest.json`:
- `tabs`: membaca tab aktif, reload tab (mis. setelah restore/clean), dan pengambilan favicon.
- `cookies`: membaca, menghapus, dan menyetel cookies per domain saat backup/restore.
- `storage`: menyimpan daftar sesi dan cache ikon di `chrome.storage.local`.
- `scripting`: mengeksekusi skrip untuk membaca/menulis `localStorage` dan `sessionStorage` pada halaman aktif.
- `history`: mencari dan menghapus riwayat untuk domain saat ini ketika melakukan pembersihan.
- `browsingData`: disiapkan untuk pembersihan cache (opsional; saat ini pembersihan cache global dinonaktifkan secara default).
- `host_permissions: <all_urls>`: memungkinkan akses di seluruh domain agar penyimpanan/pemulihan cookies berjalan.

Detail lebih lanjut ada di `docs/Permissions.md`.

## Keamanan & Privasi
- Data sesi disimpan secara lokal di `chrome.storage.local` dalam format tidak terenkripsi. Lindungi perangkat Anda.
- Format OWI (encrypted backup) menggunakan [SJCL](https://github.com/bitwiseshiftleft/sjcl) dengan AES-CCM 256-bit. Password tidak disimpan.
- Domain sensitif (Google/Microsoft dan ekosistemnya) memiliki sistem autentikasi kompleks. Menyimpan atau memulihkan sesi pada domain tersebut tidak selalu berhasil. UI akan menampilkan peringatan.

Selengkapnya: `docs/BackupRestore.md`.

## Struktur Proyek
```
SesWi/
├─ manifest.json
├─ popup.html
├─ popup.js
├─ background/
│  └─ service-worker.js
├─ modules/
│  ├─ ChromeAPI/
│  │  ├─ DataManager.js
│  │  ├─ CookieGrabber.js
│  │  ├─ LocalGrabber.js
│  │  └─ IconsGrabber.js
│  ├─ Tabs/
│  │  ├─ Current-Tab.js
│  │  ├─ Group-Tabs.js
│  │  ├─ Manage-Tab.js
│  │  └─ ModalManager.js
│  ├─ Encryption/
│  │  ├─ EncryptionUtils.js
│  │  └─ sjcl.js
│  └─ Utilities/
│     ├─ GlobalUtility.js
│     ├─ GlobalPagination.js
│     ├─ BackupRestoreJSON.js
│     ├─ BackupRestoreOWI.js
│     └─ BackupDataValidator.js
├─ style/
│  ├─ BaseStyle.css
│  ├─ CurrentTabStyle.css
│  ├─ GroupTabStye.css
│  ├─ ManageTabStyle.css
│  └─ ModalPopUP.css
└─ assets/
   └─ icons/ (16, 48, 128)
```

Rincian tiap modul tersedia di `docs/Modules.md`.

## Arsitektur Singkat
- MV3 Service Worker (`background/service-worker.js`) sebagai pusat event dan message handler.
- Popup UI (`popup.html` + `popup.js`) dengan 3 tab: `Current`, `Group Sessions`, `Manage`.
- `modules/ChromeAPI/` mengabstraksi API Chrome: informasi tab, cookies, storage halaman, dan favicon cache.
- `modules/Tabs/` menyediakan logika UI dan interaksi per tab + modal.
- `modules/Utilities/` berisi utilitas umum (logging, format waktu, validator backup, pagination, dsb.).

Diagram alur dan penjelasan detail: `docs/Architecture.md`.

## Backup & Restore
- JSON: format terbuka, mudah dibaca, tidak terenkripsi. Di-`export` via `Backup All Sessions` (Manage tab) atau `Backup JSON` di `Session Actions`.
- OWI: format terenkripsi menggunakan password (AES-CCM 256-bit via SJCL). Dapat membuat backup per-item atau semua sesi.
- Restore:
  - Pilih file `.json` atau `.owi` di `Restore Sessions` (Manage tab).
  - Untuk `.owi`, masukkan password dan klik `Verify` untuk memeriksa/menampilkan isi.
  - Gunakan inspector untuk memilih item yang ingin dipulihkan (duplikasi diberi penanda dan tidak dicentang secara default).

Spesifikasi format dan proses lengkap: `docs/BackupRestore.md`.

## Pengembangan
- Tidak ada proses build khusus; cukup `Load unpacked` di Chrome.
- Aktifkan log debug dengan menyetel di DevTools Console:
  ```js
  localStorage.setItem('__SES_DEBUG__', '1');
  // atau di runtime
  window.__SES_DEBUG__ = true;
  ```
- Buka DevTools pada popup untuk memantau error dan log.

Panduan developer lebih lengkap: `docs/Development.md`.

## Roadmap (Saran)
- Opsi pembersihan cache selektif per-origin (ketika dukungan API memadai).
- Penyaringan/penandaan sesi yang mendekati kadaluwarsa.
- Ekspor sebagian (per-domain) langsung dari Group tab.
- Sinkronisasi opsional (mis. `chrome.storage.sync`) — periksa batasan ukuran terlebih dahulu.

## Kontribusi
Kontribusi sangat dihargai. Silakan buat issue atau Pull Request.

## Lisensi
Tambahkan berkas lisensi pilihan Anda (mis. MIT) pada root repo.

## Kredit
- SJCL (Stanford Javascript Crypto Library) untuk enkripsi.
- Dibuat oleh `risunCode`.

---

Dokumentasi lengkap tersedia di folder `docs/`:
- `docs/Overview.md`
- `docs/Architecture.md`
- `docs/Modules.md`
- `docs/Permissions.md`
- `docs/BackupRestore.md`
- `docs/Development.md`
