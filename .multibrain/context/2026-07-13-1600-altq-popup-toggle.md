# Alt+Q Popup Toggle

Date: 2026-07-13 16:00 UTC

## Decision
`Alt+Q` remains the only browser-level shortcut in the manifest. It opens SesWi from the browser. When the popup is already focused, the popup-level key handler now catches `Alt+Q` and calls `window.close()` so the same shortcut acts as a practical toggle.

## Implementation
- `app/popup/App.vue`: `handleShortcut` handles `Alt+Q` before the Ctrl-only shortcut guard and closes the popup.
- `app/popup/modals/TipsShortcutsModal.vue`: shortcut copy changed to `Open / Close SesWi`.
- `README.md` and `AGENTS.md`: updated Alt+Q behavior docs.
- `app/popup/uiParity.test.ts`: updated assertions for Alt+Q close handling.

## Verification
- `npm test -- app/popup/uiParity.test.ts` passed: 69 tests.
- `npm run type-check` passed.
- `npm run build:chrome` passed.
- `npm run build:firefox` passed.

## Notes
This does not add a second manifest command. Closing only works while the popup has focus because browser extension popups can close themselves with `window.close()`.
