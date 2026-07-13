# Session and 2FA Manager Split

## Manage Tab
The former single Session Manager surface is now two explicit Manage cards:
- **Session Manager** — manages saved sessions and supports whole-domain deletion.
- **2FA Manager** — reviews saved authenticator entries independently and deletes selected entries in a batch.

## Session Domain Deletion
Every Session Manager domain header now exposes **Delete Domain**. It emits the whole `DomainGroup` to App; App opens the shared ConfirmModal with the domain name and session count. Confirming calls `SessionStorage.deleteMany()` for every session timestamp in the domain. No native browser confirmation is used.

## 2FA Manager
`TwoFactorManagerModal` loads all stored 2FA entries, shows deterministic avatar initials with issuer context, supports Select All, and emits selected entries for the shared ConfirmModal. After approval, App deletes all selected IDs with `TwoFactorStorage.delete()` and refreshes popup data.

## Verification
- `npm test -- app/popup/uiParity.test.ts` — 77 passed
- `npm run lint` — passed
- `npm run type-check` — passed
- `npm run build:chrome` — passed
- `npm run build:firefox` — passed
