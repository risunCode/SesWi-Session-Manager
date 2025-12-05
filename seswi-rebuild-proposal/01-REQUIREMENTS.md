# SesWi Rebuild - Requirements Document

## Ringkasan Proyek

SesWi adalah Chrome Extension (Manifest V3) untuk menyimpan dan mengelola sesi login per-domain. Extension ini menyimpan cookies, localStorage, dan sessionStorage untuk memudahkan switching antar akun.

---

## Fitur Inti (Core Features)

### 1. Session Management
- **Save Session**: Simpan sesi aktif (cookies + localStorage + sessionStorage) dengan nama custom
- **Restore Session**: Pulihkan cookies ke tab aktif (hanya jika domain cocok)
- **Edit Session**: Ubah nama sesi
- **Replace Session**: Ganti data sesi dengan data tab saat ini
- **Delete Session**: Hapus sesi

### 2. Session Views
- **Current Tab View**: Daftar sesi untuk domain aktif dengan pagination
- **Group View**: Sesi dikelompokkan per domain, expandable

### 3. Backup & Restore
- **JSON Backup**: Export sesi ke file JSON (tidak terenkripsi)
- **OWI Backup**: Export sesi ke file terenkripsi (AES-256 via SJCL)
- **Restore**: Import dari file .json atau .owi dengan validasi duplikat

### 4. Utilities
- **Clean Tab Data**: Hapus cookies, storage, dan history untuk domain aktif
- **Grouped Actions**: Backup/delete sesi berdasarkan domain yang dipilih

---

## Acceptance Criteria

### AC-1: Save Session
- User dapat menyimpan sesi dengan nama unik per domain
- Sesi menyimpan: cookies, localStorage, sessionStorage, timestamp, originalUrl
- Validasi nama tidak boleh duplikat dalam domain yang sama

### AC-2: Restore Session
- Restore hanya diizinkan jika tab aktif berada di domain yang sama
- Cookies lama dihapus sebelum restore
- Tab di-reload setelah restore

### AC-3: Backup/Restore
- JSON backup menghasilkan file yang valid dan dapat di-import kembali
- OWI backup memerlukan password dan menggunakan enkripsi AES-256
- Import mendeteksi duplikat dan memberikan opsi untuk skip

### AC-4: UI/UX
- Popup responsif dengan 3 tab: Current, Group Sessions, Manage
- Session card menampilkan: index, nama, jumlah cookies, timestamp relatif
- Modal untuk actions dengan feedback yang jelas

### AC-5: Security
- Data tersimpan di chrome.storage.local
- OWI menggunakan SJCL dengan AES-CCM 256-bit
- Warning untuk domain sensitif (Google/Microsoft)

---

## Permissions yang Dibutuhkan

| Permission | Kegunaan |
|------------|----------|
| `tabs` | Akses info tab aktif, reload tab |
| `cookies` | CRUD cookies per domain |
| `storage` | Simpan sesi di chrome.storage.local |
| `scripting` | Akses localStorage/sessionStorage via executeScript |
| `history` | Hapus history domain saat clean |
| `<all_urls>` | Akses cookies di semua domain |

---

## Data Model

### Session Object
```javascript
{
  id: "example.com:1726114029343",
  name: "Admin Account",
  domain: "example.com",
  originalUrl: "https://example.com/dashboard",
  cookies: [...],
  localStorage: {...},
  sessionStorage: {...},
  timestamp: 1726114029343,
  index: 1
}
```

### Storage Key
- Primary: `seswi-sessions-blyat`
- Icon Cache: `seswi-icons-cache`

---

## Constraints & Limitations

1. **Domain Restriction**: Restore cookies hanya untuk domain yang cocok
2. **Complex Auth**: Google/Microsoft ecosystem mungkin tidak konsisten
3. **Storage Limit**: chrome.storage.local max ~5MB (QUOTA_BYTES)
4. **Session Cookies**: Cookies dengan flag `session: true` tidak punya expiration

---

## Out of Scope (Tidak Termasuk)

- Sync antar device (chrome.storage.sync)
- Auto-save/auto-restore
- Cloud backup
- Multi-browser support
