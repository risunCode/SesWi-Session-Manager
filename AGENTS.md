# Repository Guidelines

SesWi is a WXT + Vue 3 + TypeScript browser extension for session capture and restore, encrypted backups, TOTP 2FA, Master Password protection, current-tab utilities, and confirmed userscript bridge actions.

This is the canonical contributor and agent guide.

## Multi Brain Startup

Before meaningful repository work:

1. Read `.multibrain/session.md`.
2. Read only the relevant file under `.multibrain/indexes/`.
3. Follow a pointed file in `.multibrain/context/` only when deeper detail is needed.
4. After a meaningful change, refresh the relevant index entry and context snapshot.

Keep Multi Brain concise. `session.md` is an index, not a work log. This file remains the canonical engineering convention.

## Active Source Layout

All active source code lives under `app/`.

```txt
app/
├── entrypoints/              # Thin WXT bridges only
│   ├── background.ts
│   ├── popup/
│   ├── forgot-password/
│   ├── offscreen/
│   └── userscript-bridge.content.ts
├── background/               # Runtime coordination and browser commands
├── popup/                    # Vue popup, tabs, modals, controls, and tests
├── forgot-password/          # Full-page Master Password recovery
├── features/                 # Domain features
│   ├── backup/
│   ├── import/
│   ├── security/
│   ├── sessions/
│   ├── two-factor/
│   ├── updates/
│   └── userscript/
├── platform/                 # Browser/platform adapters
├── shared/                   # Cross-feature contracts and helpers
├── styles/                   # Global design primitives
└── public/                   # Static assets copied by WXT
```

Do not create or reintroduce root-level active source directories:

```txt
src/
core/
components/
composables/
public/
styles/
types/
utils/
entrypoints/
```

There is no options/control page. Do not add `options_ui`, `app/options/`, or `app/entrypoints/options/` unless the user explicitly reverses this decision.

## Key Entry Points

- `app/entrypoints/background.ts` → `app/background/index.ts`
- `app/entrypoints/popup/main.ts` → `app/popup/main.ts`
- `app/entrypoints/forgot-password/main.ts` → `app/forgot-password/main.ts`
- `app/entrypoints/offscreen/main.ts` → Master Password in-memory remember cache
- `app/entrypoints/userscript-bridge.content.ts` → page/userscript request relay
- `app/popup/App.vue` → popup shell, modal orchestration, shortcuts, bridge confirmation
- `app/background/index.ts` → context menus, update checks, uninstall URL, browser command and bridge coordination
- `wxt.config.ts` → aliases, entrypoint/public roots, manifest permissions, browser-specific configuration

## TypeScript and Domain Patterns

- Use TypeScript and ES modules.
- Prefer `async`/`await`.
- Keep feature logic in `app/features/<domain>/`.
- Keep browser/platform adapters in `app/platform/`.
- Keep small cross-feature contracts and utilities in `app/shared/`.
- Use configured aliases: `@app`, `@features`, `@platform`, `@shared`, and `@styles`.
- Feature APIs return the existing result shape:

  ```ts
  { success: true, data }
  { success: false, error }
  ```

- Use `app/shared/response.ts` rather than inventing result variants.

### Session Data

Canonical session data includes cookies, `localStorage`, `sessionStorage`, domain/original URL metadata, and timestamp/index metadata.

Normalize imported or legacy data before saving or restoring. Never assume `cookie.session` or `cookie.expirationDate` exists. Reuse:

- `app/shared/normalize.ts`
- `app/shared/validate.ts`
- `app/shared/domain.ts`
- `app/shared/time.ts`

Use `CurrentTabSnapshot.collect()` from `app/features/sessions/currentTabSnapshot.ts` for current-tab data. Use `SessionStorage.saveMany()` for bulk imports and restores.

## Security and Userscript Bridge

### Master Password

- Protected data is managed by `app/features/security/crypto.ts` and `app/features/sessions/sessionStorage.ts`.
- Popup locking is coordinated by `app/popup/composables/useMasterLock.ts` and rendered by `app/popup/layout/LockScreen.vue`.
- Recovery lives in `app/forgot-password/ForgotPasswordApp.vue`.
- Remembered unlock lasts five minutes and stays in extension memory only: Chrome uses the offscreen document; Firefox falls back to background memory.
- Do not store a recoverable Master Password or unlock token in extension storage.
- `Ctrl+D` fast-locks SesWi when Master Password is enabled.
- Never render protected popup content while Master Password is enabled and locked.

### Userscript Bridge

- The contract lives in `app/shared/userscriptBridge.ts`.
- The page relay is `app/entrypoints/userscript-bridge.content.ts`.
- Action execution lives in `app/features/userscript/bridge.ts`.
- The workaround helper is the static file `app/public/userscripts/seswi-bridge-helper.user.js` and is documented in `README.md`; do not add it as a Manage card or popup modal.
- Popup confirmation lives in `app/popup/App.vue`.
- The background owns pending-request coordination and result delivery.
- All userscript actions must require explicit popup confirmation.
- Never add silent approval, direct Tampermonkey/Violentmonkey storage access, or an unguarded page-level action API.
- Keep actions current-tab and current-domain scoped unless a new, explicitly reviewed contract broadens scope.

## Backup, Restore, and Imports

- OWI is the default secure backup format; it is encrypted.
- JSON, Netscape, and Cookie Editor formats are raw/readable.
- Use backup APIs in `app/features/backup/backup.ts` and crypto APIs in `app/features/security/crypto.ts`.
- Shared multi-file intake belongs in `app/features/backup/import.ts` and `app/features/import/` contracts.
- Add Session and Backup & Restore collect all files, validate/review the queue, then commit in a batch.

## Vue and Styling

- Vue components use `<script setup lang="ts">`.
- Popup tabs: `app/popup/tabs/`.
- Popup modals: `app/popup/modals/`.
- Reusable controls: `app/popup/controls/`.
- Layout: `app/popup/layout/`.
- Reuse global primitives from `app/styles/tokens.css`, `base.css`, `components.css`, and `animations.css`.

### Modal Rules

- `app/popup/modals/ModalBase.vue` is the primary modal shell.
- Use the shared `sw-modal-*` styling and the global bounce transition.
- Do not introduce duplicate modal keyframes or a second modal framework.
- Completion feedback belongs on the action button and through parent-routed toasts; do not emit duplicate success toasts.

### UX Rules

- Visible UI copy is English-only.
- Use specific, action-oriented labels.
- Preserve SesWi’s established visual language for session, backup, group, cleanup, lock, and recovery flows.
- Pagination stays boxy-rounded rather than pill-shaped.
- Use focused global or scoped styles; do not duplicate the global style system inside components.

## Browser and Manifest Rules

- Manifest configuration lives in `wxt.config.ts`; SesWi targets Manifest V3 for both Chrome and Firefox.
- Active WXT roots are `entrypointsDir: 'app/entrypoints'` and `publicDir: 'app/public'.
- Firefox development and production builds use `--mv3` and output to `.output/firefox-mv3`. Firefox MV3 uses `action` and a persistent `background.scripts` page; do not reintroduce MV2 `browserAction` compatibility paths.
- Firefox must retain:

  ```ts
  data_collection_permissions: {
    required: ['none'],
  }
  ```

- The uninstall URL is configured in `app/background/index.ts` and points to `site/uninstall.html`.
- `Alt+Q` opens the SesWi popup through the manifest browser command; while the popup is focused, pressing `Alt+Q` closes it via the popup key handler.
- There is no browser-level `Alt+W` command. Window tab cleanup lives inside `Clean Current Tab` as the explicit `Clear Other Tabs` action, which closes every other tab in the current window while keeping the active tab open.

## Testing and Verification

Primary regression coverage lives in `app/popup/uiParity.test.ts`. It intentionally combines component tests with static architecture checks for load-bearing contracts.

When behavior changes, add or update tests for observable contracts: malformed imports, modal events, lock and recovery states, bridge confirmation, keyboard shortcuts, backup formats, and manifest/architecture choices.

Commands:

```bash
npm test
npm run lint
npm run type-check
npm run build:chrome
npm run build:firefox
```

For non-trivial changes, run the relevant targeted test and normally the full gate above before declaring completion.
- Current application version: `v4.0.0`; conventional prefixes are `feat:`, `fix:`, `refactor:`, `cleanup:`, and `security:`. The v4.0.0 release standardizes both supported browsers on Manifest V3, keeps Alt+Q as the only browser-level shortcut, and exposes window tab cleanup through the Clean Current Tab modal.

## Maintenance

- Treat existing user changes as intentional.
- Prefer clean cutovers over compatibility aliases or shims.
- Delete dead code when removing a feature; update affected tests and docs in the same change.
- Avoid abstractions unless they remove real duplication or protect a load-bearing contract.
- Keep `README.md`, this file, and `.multibrain/` aligned after meaningful architectural or product changes.
- Current application version: `v4.0.0`; conventional prefixes are `feat:`, `fix:`, `refactor:`, `cleanup:`, and `security:`.
