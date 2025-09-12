# SesWi — Advanced Session Manager (Chrome Extension)

**SesWi** adalah ekstensi Chrome (Manifest V3) 
untuk menyimpan dan mengelola sesi login per domain.
- Mendukung cookies, `localStorage`, `sessionStorage`, backup/restore (JSON & OWI terenkripsi), serta pembersihan data tab.

---

## 🔧 Fitur
- Simpan & pulihkan sesi (cookies + storage) per domain.
- Daftar sesi aktif (`Current`) & semua domain (`Group Sessions`).
- Modal aksi: Restore, Rename, Replace, Delete, Backup JSON/OWI.
- Tab `Manage`:
  - Backup/Restore semua sesi.
  - Grouped action (backup/delete per domain).
  - Clean Current Tab Data (hapus cookies + storage + riwayat domain).
- Cache favicon per domain untuk tampilan cepat.

---

## 🚀 Instalasi
1. Clone/unduh repo.
2. Buka `chrome://extensions`, aktifkan **Developer mode**.
3. `Load unpacked` → pilih folder repo.
4. Pin ikon ekstensi bila perlu.

---

## 🛠️ Penggunaan
- Klik ikon ekstensi.
- **Header**: domain saat ini + tombol `Add Session`.
- **Current**: sesi domain aktif.
- **Group Sessions**: semua sesi, expandable per domain.
- **Manage**: backup/restore, grouped action, clean tab.

---

## 🔐 Izin
- `tabs`, `cookies`, `storage`, `scripting`, `history`, `browsingData`.
- `host_permissions: <all_urls>` untuk akses cookies lintas domain.  
Detail: `docs/Permissions.md`.

---

## 🔒 Keamanan
- Data lokal disimpan di `chrome.storage.local` (plain).
- Backup OWI terenkripsi AES-CCM 256-bit (SJCL).  
- Domain (Google/Microsoft) partially compatible, with some tricks :XD: 

---

## 💾 Backup & Restore
- **JSON**: terbuka, tidak terenkripsi.
- **OWI**: terenkripsi password (AES-CCM 256-bit).
- Restore mendukung inspector & verifikasi password.

---

## 📸 Screenshots
<div style="display: flex; gap: 20px; justify-content: center;">
  <img src="https://github.com/user-attachments/assets/aef1d8f1-0a1d-4874-b49d-6cacf7ea2dda" width="300" alt="Current Session">
  <img src="https://github.com/user-attachments/assets/519420d1-f1a1-4798-9eee-51ccca3fd67f" width="300" alt="Session Action">
  <img src="https://github.com/user-attachments/assets/d15c860b-7452-4610-b437-60cdddccf9d5" width="300" alt="Manage Session">
</div>

---

## 📜 Lisensi
```
MIT License

Copyright (c) 2025 risuncode

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to use,
copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
derivative works of the Software, subject to the following conditions:

1. The Software may be used for commercial purposes as part of a larger system or service.
2. The Software itself may not be sold as a standalone product or bundled and sold directly.
3. The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE
AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

## 🙏 Kredit
- **SJCL** (Stanford Javascript Crypto Library) untuk enkripsi.
