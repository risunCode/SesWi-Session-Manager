# Firefox Command, Cleanup, and Persistence Audit

## User-reported behavior
- Alt+Q did not open the SesWi popup in Firefox.
- Current-tab data appeared not to clear.
- Saved sessions were suspected not to persist.

## Confirmed cause and changes

### Firefox MV2 toolbar action
WXT produces Firefox MV2 with `browser_action`, but the shared background source called MV3-only `browser.action.*`. WXT's browser shim does not alias that namespace, so calls were swallowed by existing catch blocks.

- `app/background/index.ts` now resolves `browser.action ?? browser.browserAction` through `getToolbarAction()`.
- All popup and badge calls use that helper, covering Alt+Q, Alt+W feedback, and userscript-bridge prompts.
- The compiled Firefox artifact was inspected: it contains `browserAction`, `openPopup`, and no direct `.action.openPopup` call.

### Current-tab cleanup
- `app/features/sessions/sessionStorage.ts` now returns the cookie-removal failure instead of continuing/reloading as success.
- Page-storage clearing validates the dynamic script result. A failed or absent execution result now returns a real error rather than a false cleaned state.
- `BrowserStorage.get` also rejects missing/non-object injection results instead of converting them to `{}`.
- `app/features/sessions/cookies.ts` passes native Firefox `firstPartyDomain` and `partitionKey` metadata at runtime (through `Reflect.set` to retain Chrome-compatible typings), and reports any cookie that was not actually removed.
- `app/features/sessions/session.types.ts`, `app/shared/normalize.ts`, and `app/popup/modals/AddSessionModal.vue` preserve that cookie metadata for future cleanup/restore paths.

### Persistence
- `syncProtectedPayload` now returns `Result<null>` and propagates encryption/storage errors.
- Session `save`, `saveMany`, `update`, `delete`, and `deleteMany` stop instead of returning false success when the Master Password encrypted payload fails to write.
- `app/features/two-factor/twoFactorStorage.ts` now applies the same protected-write result handling for all 2FA mutations.

## Evidence from Firefox documentation
- Firefox MV2 uses `browser.browserAction.openPopup()` while `action.openPopup()` is MV3-only: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/browserAction/openPopup and https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/action/openPopup
- Commands are valid in Firefox MV2 and native browser-action commands are supported: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/commands
- Dynamic scripting requires host access and rejects injection on restricted pages: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/scripting/executeScript
- Firefox cookie removal needs `firstPartyDomain` under First-Party Isolation: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/cookies/remove
- `storage.local` is persistent extension storage; quota errors must be surfaced: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/storage/local

## Regression coverage
`app/popup/uiParity.test.ts` now asserts the cross-manifest toolbar-action resolver, protected-write failure checks, and storage-clear result validation.

## Verification
- `npm test` — 4 files, 76 tests passed.
- `npm run lint` — passed.
- `npm run type-check` — passed.
- `npm run build:firefox` — passed.
- Final Firefox output `.output/firefox-mv2/background.js` checked to confirm the `browserAction` fallback is included and a direct `.action.openPopup` call is absent.

## Known runtime limits
Restricted Firefox pages (such as `about:`, PDF viewer, reader view, and browser UI) cannot accept injected storage operations. The app now reports this as an error instead of claiming it cleaned data.
