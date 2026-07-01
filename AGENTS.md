# Repository Guidelines

Chrome MV3 extension for saving & restoring login sessions (cookies, localStorage, sessionStorage) and managing TOTP 2FA secrets.

## Structure

```
src/
├── core/             # Domain logic
│   ├── backup.js     # Canonical payload shape, create/restore/json export
│   ├── cookies.js    # Chrome cookies API wrap
│   ├── crypto.js     # AES-256-GCM, PBKDF2, OWI format
│   ├── export.js     # JSON/Netscape/Cookie Editor format
│   ├── storage.js    # Session & MP CRUD, protected payload
│   ├── twofa.js      # TOTP generation, TwoFactorStorage, OTPAuth URI
│   └── updater.js    # GitHub release checker (background)
├── ui/
│   ├── modals.js     # All modals (backup, 2FA, QR scan, delete, etc.)
│   ├── tabs.js       # CurrentTab, GroupTab, ManageTab, TwoFATab
│   └── sessionModal.js
├── background.js     # Service worker (context menus, update checker)
├── popup.js          # Entry point — init, tab wiring, event handlers
├── constants.js      # Config, keys, timing
├── utils.js          # DOM helpers, validation, normalize
├── styles/main.css   # Single CSS file (~3600 lines)
├── __tests__/        # Vitest suite (~237 tests)
└── manifest.json
```

## Patterns

- ES modules, async/await, `{ success, data/error }` return shape
  - `Response.success(data)` / `Response.error(msg)` helpers in `utils.js`
- UI: `render()` builds HTML, `_wire*()` binds events on fresh DOM
- TwoFATab uses `tick()` (in-place code/timer updates) instead of full re-render
- Legacy formats upgraded in-memory; canonical payload: `{ version, kind, createdAt, data: { sessions, twoFactorEntries } }`

## Commands

```bash
npm install        # Install
npm run dev        # Vite dev server (HMR)
npm run build      # Production → dist/
npm test           # Vitest (237 tests)
```

Load `dist/` as unpacked extension in `chrome://extensions`.

## Version

v3.4.1 — Tag format `v3.4.1`. Conventional commits:
`feat:` `fix:` `refactor:` `cleanup:` `security:`
