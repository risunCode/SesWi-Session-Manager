# Alt+W Survivor Tab Fix

## Problem

The old `Alt+W` flow created a new `about:blank` tab and then removed the prior tab snapshot in bulk. In real browser lifecycle behavior, the window could still close. It also targeted `windows.getCurrent()` from a background/service-worker context rather than explicitly selecting the last-focused normal browser window.

## Browser API findings

Official Chrome documentation says the current window in a service worker falls back to the last active window and can differ from the topmost/focused window. `windows.getLastFocused()` explicitly returns the most recently focused window and supports filtering to `normal` windows.

Official Chrome/MDN tabs documentation says `tabs.create()` resolves once a tab is created, not once it finishes loading; `tabs.update()` can navigate an existing tab to `about:blank`; and `tabs.remove()` closes every supplied tab ID.

## Fix

`app/background/clearWindowTabs.ts` now enforces a survivor-tab invariant:

1. Query tabs in the target window.
2. Choose the active existing tab, falling back to the first tab with an ID.
3. Update that existing tab to `about:blank`, active and unpinned.
4. Only after the update resolves, remove every other tab ID.

The browser window therefore never reaches zero tabs during the operation. A one-tab window only updates its existing tab and never calls `tabs.remove()`.

`app/background/index.ts` now targets `browser.windows.getLastFocused({ windowTypes: ['normal'] })`.

## Verification

- Behavioral helper tests prove survivor selection, update-before-remove order, exclusion of the survivor from removal, one-tab handling, and empty/invalid-tab handling.
- Focused test run: 2 files / 67 tests passed.
- Full test run: 4 files / 71 tests passed.
- ESLint passed.
- TypeScript passed.
- Chrome MV3 build passed.
- Firefox MV2 build passed.

## Sources

- Chrome Windows API: https://developer.chrome.com/docs/extensions/reference/api/windows
- Chrome Tabs API: https://developer.chrome.com/docs/extensions/reference/api/tabs
- MDN `tabs.update()`: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/tabs/update
- MDN `tabs.remove()`: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/tabs/remove
