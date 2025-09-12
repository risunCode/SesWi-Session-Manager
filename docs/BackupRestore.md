# Backup & Restore

Dokumen ini menjelaskan format backup dan proses ekspor/impor yang didukung SesWi.

## JSON Backup
- Dibuat oleh `Utilities/BackupRestoreJSON.exportAll()` atau `Session Actions → Backup JSON`.
- Struktur file (contoh):
```json
{
  "type": "sessions-backup",
  "version": "1.0",
  "backupDate": "2025-01-01T00:00:00.000Z",
  "sessions": [ { /* objek sesi */ } ]
}
```
- Impor:
  - `Manage → Restore Sessions` → pilih `.json` → validasi struktur → deteksi konflik (nama + domain) → merge tanpa duplikasi.

## OWI (Encrypted Backup)
- Dibuat oleh `Utilities/BackupRestoreOWI` dalam dua mode:
  - `create(sessionData, password, filename)` → single session `.owi`.
  - `createFromSessions(sessions, password, filename)` → seluruh sesi `.owi`.
- Struktur file `.owi` (ringkas):
```json
{
  "version": "1.0",
  "format": "OWI",
  "created": "2025-01-01T00:00:00.000Z",
  "type": "single" | "multi",
  "encryptedData": "<SJCL JSON string>"
}
```
- Enkripsi menggunakan SJCL (AES-CCM 256-bit, `ts=128`, `iter=1000`). Password wajib dan tidak disimpan.
- Impor `.owi`:
  - `Manage → Restore Sessions` → pilih file `.owi` → masukkan password → `Verify` → data didekripsi → inspector untuk memilih item.

## Proses Restore & Duplikasi
- Untuk JSON: konflik nama-domain dan timestamp akan dideteksi; item duplikat di-skip.
- Untuk OWI: setelah verifikasi password, data dinormalisasi menjadi `{ sessions: [...] }`.
- Pada `Restore Sessions`, inspector menandai duplikat dan hanya mencentang item yang aman secara default.

## Catatan Keamanan
- File JSON tidak terenkripsi; gunakan OWI jika berisi data sensitif.
- Password OWI tidak pernah disimpan oleh aplikasi.
- Sesi hanya dapat dipulihkan cookies-nya ketika tab aktif berada pada domain yang sama.
