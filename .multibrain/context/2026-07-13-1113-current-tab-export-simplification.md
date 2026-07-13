# Current Tab Export Simplification

## Goal
Remove overlapping current-tab export actions and keep only two clear cookie export choices.

## Changes
- `app/popup/modals/ExportTabDataModal.vue` now renders exactly two actions:
  - `Copy JSON Compatible`: collects current-tab cookies, normalizes them, converts them with `Export.toCookieEditor()`, and copies the raw Cookie Editor-compatible array to the clipboard.
  - `Export Netscape File`: downloads the normalized cookies as a Netscape text file.
- Removed the SesWi-style JSON payload containing cookies/localStorage/sessionStorage, JSON file download, and separate Cookie Editor file download.
- Empty cookie sets report an error for both actions.
- Updated visible copy to clarify this modal exports current-tab cookies without saving a session.
- `app/popup/uiParity.test.ts` asserts exactly two export buttons and absence of the removed actions.

## Verification
- `npm test -- app/popup/uiParity.test.ts` — 69 passed.
- `npm run lint` — passed.
- `npm run type-check` — passed.
- `npm run build:chrome` — passed.
- `npm run build:firefox` — passed.
