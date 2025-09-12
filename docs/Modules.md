# Modules

Ringkasan modul dan tanggung jawabnya.

## modules/ChromeAPI/
- `DataManager.js`
  - Inisialisasi, info tab (`getCurrentTabInfo`), snapshot browser (`getBrowserSessionSnapshot`, `restoreBrowserSession`).
  - CRUD sesi (`getAllSessions`, `saveSession`, `updateSession`, `deleteSession`, `deleteAllSessions`).
  - Pembuatan sesi dari tab saat ini (`createSessionFromCurrentTab`, `saveCurrentSession`).
  - Pengelompokan sesi (`getAllSessionsGrouped`) dan operasi terkelompok (`deleteGroupedSessions`).
  - Pembersihan data domain (`cleanCurrentTabData`).
- `CookieGrabber.js`
  - `getCookiesForDomain`, `getCurrentTabCookies`, `removeCookiesForDomain`, `restoreCookies`.
- `LocalGrabber.js`
  - `LocalStorageGrabber` dan `SessionStorageGrabber` (get/restore/clear via `chrome.scripting.executeScript`).
- `IconsGrabber.js`
  - Cache favicon per domain, refresh, dan force refresh.

## modules/Tabs/
- `Current-Tab.js`
  - UI daftar sesi domain aktif + modal `Add Session`.
  - Pagination via `GlobalPagination`, highlight sesi yang baru disimpan, open `Session Actions`.
- `Group-Tabs.js`
  - UI grup sesi lintas domain, expand satu grup, pagination (default vs 4 per halaman saat expanded).
- `Manage-Tab.js`
  - Modals: Backup Format (JSON vs OWI + password), Restore (file drop + password verify untuk OWI + inspector), Grouped Action (backup/delete per-domain).
  - Aksi `Clean Current Tab Data`.
- `ModalManager.js`
  - `Session Actions` modal: Restore/Edit/Replace/Delete/Backup JSON/Backup OWI.
  - Cookie details modal dengan daftar cookie, flag, dan masa berlaku.

## modules/Encryption/
- `EncryptionUtils.js`
  - Enkripsi/dekripsi payload menggunakan SJCL (AES-CCM 256, `ts=128`, `iter=1000`).
  - `generateKey()` dan seeding RNG via WebCrypto.
- `sjcl.js`
  - Library enkripsi pihak ketiga.

## modules/Utilities/
- `GlobalUtility.js`
  - Helper response (`createSuccessResponse`, `handleError`), domain (`getBaseDomain`, `isDomainMatch`), sanitasi (`escapeHtml`), logger, format waktu (`formatRelativeTimestamp`), domain sensitif (Google/Microsoft) dan warning.
- `GlobalPagination.js`
  - Pagination generik dan khusus current tab.
- `BackupRestoreJSON.js`
  - Ekspor semua sesi ke `.json`, validasi dan impor dari objek/file dengan deteksi konflik.
- `BackupRestoreOWI.js`
  - Ekspor terenkripsi `.owi` (single/multi), dekripsi `.owi` → normalisasi ke `{ sessions: [...] }`.
- `BackupDataValidator.js`
  - Validator payload backup JSON, helper membaca file, dan pendeteksi konflik nama-domain.
