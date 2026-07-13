# Command, Modal, and 2FA Polish

## Alt+Q Chrome Toggle
The background no longer attempts `browser.action.openPopup()` when the SesWi popup is already open. It first sends the `seswi:toggle-popup` handshake. A live popup responds `{ handled: true }`, schedules its own close on the next tick, and the background returns without calling `openPopup`. When no popup receiver exists, the message rejects and the background opens the popup normally. This prevents Chrome's `Could not find an active browser window` error on the second Alt+Q press.

## Firefox MV3 Cleanup
- Removed obsolete direct dev dependencies: `@crxjs/vite-plugin` and `@types/webextension-polyfill`.
- `app/background/index.ts` now uses WXT's underlying `Browser.runtime.MessageSender` type.
- Removed references to the non-existent `old_3.5/` archive from active README/AGENTS guidance.
- Firefox MV3 `background.scripts`, Gecko metadata, and Chrome's MV3 service worker/offscreen differences are intentional and remain.

## Modal-Only Interactions
- Removed all active `window.confirm`, `window.prompt`, and `window.alert` calls.
- Session Manager bulk delete now emits a confirm request; App owns the ConfirmModal and performs the delete after approval.
- Session Actions replace, Backup Restore, Master Password disable, and Forgot Password reset use SesWi ConfirmModal.
- Session Manager and Session Actions OWI export password input uses new `OwiPasswordModal`.

## 2FA Card
- Issuer remains the group heading and no longer repeats inside each card; account name appears once as the card identity.
- Each card has a left-to-right progress bar based on its configured TOTP period, resetting at code rollover. The default period remains 30 seconds for legacy entries.

## Verification
- `npm test -- app/popup/uiParity.test.ts` — 72 passed
- `npm run lint` — passed
- `npm run type-check` — passed
- `npm run build:chrome` — passed
- `npm run build:firefox` — passed
