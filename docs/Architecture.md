# Architecture

Ekstensi ini menggunakan arsitektur Manifest V3 dengan Service Worker sebagai pusat event dan message handling.

## Komponen Utama
- `background/service-worker.js`
  - Event hub untuk pesan dari UI.
  - Menangani aksi: `GET_TAB_INFO`, `GET_BROWSER_SNAPSHOT`, `RESTORE_BROWSER_STORAGE`, `REMOVE_COOKIES_FOR_DOMAIN`, `RESTORE_COOKIES`, `ICONS_FORCE_REFRESH`.
- Popup UI (`popup.html` + `popup.js`)
  - Menyediakan 3 tab: `Current`, `Group Sessions`, `Manage`.
  - Menginisialisasi modul tiap tab dan mendaftarkan event antar modul.
- `modules/ChromeAPI/`
  - `DataManager.js`: API utama untuk info tab, snapshot storage, CRUD session, grouping, restore, dan pembersihan domain.
  - `CookieGrabber.js`: baca/hapus/set cookies per domain.
  - `LocalGrabber.js`: baca/tulis/purge `localStorage` dan `sessionStorage` via `chrome.scripting`.
  - `IconsGrabber.js`: cache favicon per domain di `chrome.storage.local`.
- `modules/Tabs/`
  - `Current-Tab.js`: render daftar sesi domain aktif + modal tambah sesi.
  - `Group-Tabs.js`: render grup sesi lintas domain dengan expand/pagination.
  - `Manage-Tab.js`: backup/restore, grouped action, clean current tab data.
  - `ModalManager.js`: `Session Actions` modal (Restore, Edit, Replace, Delete, Backup JSON/OWI) + cookie details modal.
- `modules/Encryption/`
  - `EncryptionUtils.js`: utilitas enkripsi (SJCL AES-CCM 256) untuk OWI.
  - `sjcl.js`: library kriptografi.
- `modules/Utilities/`
  - `GlobalUtility.js`: helper (response, domain, sanitasi, logger, format waktu, domain sensitif).
  - `GlobalPagination.js`: utilitas pagination global.
  - `BackupRestoreJSON.js`, `BackupRestoreOWI.js`, `BackupDataValidator.js`.

## Alur Skenario Penting
- Simpan Sesi:
  1. `Current-Tab` → `DataManager.createSessionFromCurrentTab(name)` → ambil cookies + snapshot LS/SS.
  2. `DataManager.saveSession()` → simpan ke `chrome.storage.local`.
- Restore Sesi (cookies):
  1. `ModalManager` memeriksa domain saat ini (`isDomainMatch`).
  2. `CookieGrabber.restoreCookies(session)` → clear cookies domain, lalu set ulang cookies.
  3. Reload tab jika perlu.
- Backup All:
  - JSON: `Utilities/BackupRestoreJSON.exportAll()` → download `.json`.
  - OWI: `Utilities/BackupRestoreOWI.createFromSessions()` → enkripsi payload → download `.owi`.
- Restore dari File:
  - JSON: validasi → merge tanpa duplikasi (timestamp + name-domain) → simpan.
  - OWI: password verification → decrypt → pilih item → restore via `DataManager.restoreSessions()`.
- Clean Current Tab Data:
  1. Clear cookies domain (`removeCookiesForDomain`).
  2. Hapus riwayat domain via `chrome.history.deleteUrl` (multi-search, de-dupe, chunked).
  3. Clear `localStorage` & `sessionStorage` via `chrome.scripting`.
  4. Reload tab.

## Catatan Performa & Keandalan
- Cache info tab untuk mengurangi query berulang (400ms window) di `DataManager`.
- Operasi cookies dan riwayat menggunakan chunk untuk menghindari saturasi API.
- Cache favicon memiliki TTL per-entry (24h) dan batas maksimum entri.
