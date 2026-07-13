# Alt+W Removed; Window Tab Cleanup Moved to Clean Current Tab

Date: 2026-07-13 15:55 UTC

## Decision
Browser-level `Alt+W` window clearing was removed from Chrome and Firefox because Firefox popup/command timing made the shortcut flow unreliable. `Alt+Q` remains the only browser-level shortcut and only opens the SesWi popup.

## Implementation
- Removed the `close_all_tabs` manifest command from `wxt.config.ts`.
- Removed Alt+W command/background coordination and deleted the obsolete close-all-tabs shortcut contract/helper files.
- Updated `TipsShortcutsModal.vue`, `README.md`, and `AGENTS.md` to document no browser-level Alt+W.
- Added explicit window cleanup inside `CleanTabModal.vue`:
  - `Select All` and `Uncheck All` controls for current-tab data checkboxes.
  - Additional `Window Tabs` section showing total open tabs and how many other tabs can be closed.
  - `Clear Other Tabs` closes every non-active tab in the current window and keeps the active tab open.

## Verification
- `npm test -- app/popup/uiParity.test.ts` passed: 69 tests.
- `npm run type-check` passed.
- `npm run build:chrome` passed; compiled manifest only contains `open_seswi`/Alt+Q.
- `npm run build:firefox` passed; compiled manifest only contains `open_seswi`/Alt+Q.

## Notes
Do not reintroduce `Alt+W` unless the user explicitly reverses this decision. Future window cleanup should stay user-driven inside the Clean Current Tab modal.
