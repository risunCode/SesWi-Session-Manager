# Popup Startup Optimization

## Goal
Make SesWi popup feel responsive during service-worker cold starts without weakening Master Password protection.

## Changes
- Added a non-sensitive loading shell to `App.vue` for the period before Master Password state is resolved. It reveals no sessions, storage, TOTP, or protected content.
- Kept `masterLock.init()` as the gate before any protected popup content or pending privileged prompt is handled.
- Started current-tab lookup in parallel with the Master Password gate.
- Moved update checking off the startup critical path: it runs after Vue's first render (`nextTick` + `requestAnimationFrame`) and failures only log a warning.
- Used `Promise.allSettled` for current-tab and post-lock prompt synchronization so a transient background/service-worker message failure cannot block popup readiness.
- Lazy-loaded and conditionally mounted heavyweight popup modals: backup/restore, session manager, session actions, export, Master Password modal, tips, 2FA entry, and QR scan. This keeps QR dependency (`jsQR`) out of first popup-open parsing/mount work.
- Added architecture regression coverage for loading shell, protected startup ordering, deferred update check, and async modal boundary.
- Updated stale test reference from `site/uninstall.html` to published root `uninstall.html`.

## Security Invariant
No protected popup content or userscript confirmation is processed before `masterLock.init()` finishes. The new loading shell is visual-only.

## Verification
- `npx vitest run app/popup/uiParity.test.ts`: 65 passing.
- `npm run lint`: passing.
- `npm run type-check`: passing.
- `npm run build:chrome`: passing. Build output confirms modal chunks and `jsQR` (130.5 kB) are emitted separately from the popup entry chunk.

## Files
- `app/popup/App.vue`
- `app/popup/uiParity.test.ts`
