# Current Project State

## Goal

Keep a compact, reliable handoff for SesWi’s active architecture and product boundaries.

## Active Product

SesWi is a WXT + Vue 3 + TypeScript Chrome/Firefox extension that saves and restores browser sessions, manages TOTP 2FA entries, creates encrypted backups, protects local data with a Master Password, and provides current-tab tools.

## Architecture

- Active source is only under `app/`; root-level `src/`, `core/`, `components/`, `composables/`, `public/`, `styles/`, `types/`, `utils/`, and `entrypoints/` are forbidden.
- `old_3.5/` is archived reference only.
- WXT entrypoints are thin bridges in `app/entrypoints/` for popup, background, forgot-password recovery, offscreen memory, and userscript relay.
- There is no options/control page. Do not reintroduce one without explicit user approval.
- `ModalBase.vue` and shared `sw-modal-*` styling are the primary modal system. Preserve the global bounce transition.

## Load-Bearing Decisions

### Sessions and Backups

- Session data includes cookies, `localStorage`, `sessionStorage`, domain/original URL, and timestamp/index metadata.
- Normalize external data with shared helpers before saving or restoring.
- OWI is the default encrypted backup format. Batch imports must review/validate all selected files and commit through batch APIs.
- Current Tab lists sessions only for the active domain.

### Master Password

- Locked popup content must never render behind the lock screen.
- Remembered unlock is five minutes and lives only in extension memory: Chrome offscreen document or Firefox background memory.
- Do not persist recoverable passwords or unlock tokens in extension storage.

### Userscript Bridge

- The helper is a README-documented workaround at `app/public/userscripts/seswi-bridge-helper.user.js`; it has no Manage card or popup modal.
- The helper targets Tampermonkey/Violentmonkey-style managers and exposes save-current-domain, restore-latest-session, and clean-current-tab actions.
- Flow: page/userscript `postMessage` → content script → background pending request → popup confirmation → existing SesWi action engine → result back to page.
- All requests require explicit popup confirmation. Closing the confirmation rejects the request; replacing a request rejects the previous request.
- Do not add silent approvals, direct userscript-manager storage access, or broad unscoped page APIs.

### Browser Commands

- `Ctrl+N`: Add Session.
- `Ctrl+X`: Clean Current Tab; double press fast-cleans.
- `Ctrl+D`: fast lock when Master Password is enabled.
- `Alt+W`: first press prompts; second press within two seconds clears all old tabs in the current window while preserving one new `about:blank` tab.

## Verification Baseline

The userscript bridge delivery passed:

```txt
npm test              3 files / 66 tests passed
npm run lint          passed
npm run type-check    passed
npm run build:chrome  passed
npm run build:firefox passed
```

Both production outputs include `content-scripts/userscript-bridge.js`.

## Documentation

- `README.md` is lightweight and user-facing.
- `AGENTS.md` is the canonical engineering guide.
- Update this index/context after meaningful architecture or product decisions; do not use it as a stream-of-consciousness log.

## Next

No active implementation work is pending from this snapshot. Future userscript work may add a session selector or carefully reviewed per-domain trust behavior, but neither is committed scope.
