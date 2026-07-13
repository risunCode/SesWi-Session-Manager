# OWI Import Queue and Popup List Overflow Fix

## Goal
Fix encrypted OWI file import UX in Add New Session and prevent Groups/2FA cards from being clipped or compressed when content exceeds popup height.

## OWI Queue Changes
- Add Session now labels encrypted files without a password as `Locked — enter password to review contents`; no payload/session/2FA count is shown before decryption.
- File queue summary now says encrypted files are locked and asks for a password instead of displaying misleading `0/1 ready` output.
- Each locked OWI file has its own password input and `Unlock & Review` button. Enter key also reviews that file.
- Review is explicitly re-run only after a non-empty password is supplied.
- Per-file remove button remains available; queue state/password are removed and summary is recalculated.
- Existing parser contract is preserved and now behavior-tested: OWI without a password returns `needs-password`, `0 ready`, `passwordRequired: 1`, and zero data counts.

## Groups and 2FA Overflow Changes
- `GroupsTab` uses the groups list as the scroll owner (`flex: 1 1 0`, `overflow-y: auto`, contained overscroll), while domain cards use `flex: 0 0 auto` and cannot shrink.
- `TwoFATab` no longer hides overflow. Its 2FA list uses the same scroll-owner contract and `TwoFactorGroup` is non-shrinking, so live TOTP cards remain visible and scroll normally.

## Backup Restore Name Fix
- Found and fixed a separate Add Session import bug: `sessionCandidatesFromItem()` overwrote every imported complete-session name with the filename pattern `sessions-backup (domain)`.
- Confirmed the user's `sessions-backup.json` contains 38 named sessions, including `risundaily`, `risunturu`, and `cicalganteng`.
- Full session JSON backups now take the canonical `json-backup` parse path via `Backup.normalizePayload()` and preserve their name/domain/timestamp metadata. Filename naming remains only for raw cookie-batch imports.
- Wrong-password OWI states now show `Password incorrect — enter the correct password to review` and summary `N encrypted files have an incorrect password`; the verify field remains available for retry.

## Verification
- `npx vitest run app/popup/uiParity.test.ts`: 69 passing, including password-less OWI and named full-session backup behavior.
- `npm run lint`: passing.
- `npm run type-check`: passing.
- `npm run build:chrome`: passing; latest output at `.output/chrome-mv3`.

## Files
- `app/popup/modals/AddSessionModal.vue`
- `app/popup/tabs/GroupsTab.vue`
- `app/popup/tabs/TwoFATab.vue`
- `app/popup/two-factor/TwoFactorGroup.vue`
- `app/popup/uiParity.test.ts`

## Delivery
No commit or push was performed. User requested confirmation before future pushes.
