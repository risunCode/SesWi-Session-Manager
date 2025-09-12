# Overview

SesWi adalah ekstensi Chrome untuk menyimpan, mengelola, dan memulihkan sesi per domain. Sesi mencakup cookies serta snapshot `localStorage` dan `sessionStorage` dari tab aktif pada saat penyimpanan.

## Konsep Inti
- "Sesi" adalah snapshot dari status login dan penyimpanan lokal untuk satu domain pada satu waktu.
- Sesi disimpan ke `chrome.storage.local` (kunci `sessions`) dalam bentuk array.
- Pemulihan sesi cookies hanya diizinkan ketika tab aktif berada pada domain yang sama (untuk keamanan dan konsistensi).

## Bentuk Data Sesi
Contoh objek sesi yang disimpan (lihat `modules/ChromeAPI/DataManager.js`):
```json
{
  "id": "example.com:1726114029343",
  "name": "Admin",
  "domain": "example.com",
  "originalUrl": "https://example.com/dashboard",
  "cookies": [
    {
      "name": "SESSIONID",
      "value": "...",
      "domain": "example.com",
      "path": "/",
      "secure": true,
      "httpOnly": true,
      "sameSite": "Lax",
      "session": false,
      "expirationDate": 1730000000,
      "storeId": "0"
    }
  ],
  "localStorage": { "token": "..." },
  "sessionStorage": { "temp": "..." },
  "timestamp": 1726114029343,
  "index": 1
}
```

Catatan:
- `index` menaik per-domain untuk memudahkan penomoran di UI.
- Validasi sesi dilakukan di `Utilities/GlobalUtility.js` (`validateSession`).

## Alur Kerja Umum
- Simpan: Klik `Add Session` di popup (tab `Current`) → berikan nama → opsional centang "Clear data after saving".
- Lihat & Kelola: Klik kartu sesi untuk membuka `Session Actions` (Restore, Edit, Replace, Delete, Backup JSON/OWI, dll.).
- Backup/Restore menyeluruh: gunakan tab `Manage`.
- Pembersihan data domain: `Clean Current Tab Data` di `Manage`.

## Batasan
- Domain dengan autentikasi kompleks (Google/Microsoft) bisa tidak konsisten saat restore. UI akan menampilkan peringatan.
- Data tersimpan secara lokal dan tidak terenkripsi kecuali ketika Anda mengekspor dalam format OWI.
