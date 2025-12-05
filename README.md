# SesWi — Advanced Session Manager (Chrome Extension)

SesWi is a Chrome extension (Manifest V3) for saving and restoring login sessions per domain. It captures cookies along with `localStorage` and `sessionStorage` snapshots, lets you list and group sessions across domains, backup/restore sessions (plain JSON or password-encrypted OWI), and clean current tab data when needed.

## What's New in v2.1

### 🔄 Complete Architecture Rebuild
- **43% fewer files** — Consolidated from 21 files to 12 files
- **Modular structure** — Clean separation: `core/` for Chrome APIs, `ui/` for interface
- **Single CSS file** — All styles consolidated into `main.css` with Tailwind utilities
- **Vite build system** — Modern bundler for faster development and optimized builds

### ✨ New Features
- **Selective storage save** — Choose to include/exclude localStorage and sessionStorage when saving
- **Clear after save** — Option to clear tab data immediately after saving a session
- **Enhanced Clean Tab modal** — Selectively clear cookies, localStorage, sessionStorage, history, or cache
- **Improved favicon caching** — Faster icon loading with persistent cache
- **Better sensitive domain detection** — Expanded warnings for Google/Microsoft ecosystems

### 🛠️ Improvements
- **Faster popup load** — Reduced file count and optimized imports
- **Better error handling** — Consistent Response pattern across all modules
- **Improved pagination** — Smoother navigation in session lists
- **Enhanced UI feedback** — Better visual states for actions and selections

### 🔧 Technical Changes
- Migrated to ES modules throughout
- Removed redundant abstraction layers
- Unified utility functions in `utils.js`
- Backward compatible — existing sessions will work without migration

## Features

- **Save sessions per domain**: cookies + `localStorage` + `sessionStorage`
- **Restore cookies** only when on the same domain (prevents cross-domain conflicts)
- **Three tabs**: `Current` (active domain), `Groups` (all domains), `Manage` (backup/restore, bulk actions, clean data)
- **Backup/Restore**: export all sessions to JSON (plain) or OWI (AES-CCM 256-bit via SJCL), restore with password verification for OWI
- **Clean Current Tab**: selectively remove cookies, localStorage, sessionStorage, history, and cache for the active domain
- **Cached favicons** per domain for a faster, informative UI

## Installation (Load Unpacked)

1. Clone or download this repository
2. Run `npm install` and `npm run build` to generate the `dist` folder
3. Open Chrome → `chrome://extensions`
4. Enable `Developer mode` (top right)
5. Click `Load unpacked` and select the `dist` folder
6. Pin the extension icon if needed

## Usage

- Click the extension icon to open the popup
- Header displays the current domain and `Add Session` button
- **Current tab**: shows sessions for the active domain; click a card to open Session Actions (Restore, Edit, Replace, Delete, Backup JSON/OWI)
- **Groups tab**: grouped sessions across all domains with expand/collapse and pagination
- **Manage tab**:
  - `Backup All Sessions`: export to JSON (unencrypted) or OWI (encrypted)
  - `Restore Sessions`: import from `.json` or `.owi` file with password verification
  - `Group Manage`: select domains for bulk backup or delete
  - `Clean Current Tab`: selectively clear cookies, localStorage, sessionStorage, history, and cache

> **Note**: Session restore is restricted to the same domain as the current tab to prevent cross-domain cookie conflicts.

## Permissions

Declared in `manifest.json`:

| Permission | Purpose |
|------------|---------|
| `tabs` | Read active tab, reload after restore/clean, fetch favicons |
| `cookies` | Read, delete, and set cookies per domain |
| `storage` | Store sessions and icon cache in `chrome.storage.local` |
| `scripting` | Execute scripts to read/write `localStorage` and `sessionStorage` |
| `history` | Search and delete browsing history for current domain |
| `browsingData` | Clear cache (optional) |
| `favicon` | Access favicon API for domain icons |
| `host_permissions: <all_urls>` | Enable cookie operations across all domains |
 

## Security & Privacy

- Sessions are stored locally in `chrome.storage.local` (unencrypted). Protect your device.
- OWI encrypted backups use [SJCL](https://github.com/bitwiseshiftleft/sjcl) with AES-CCM 256-bit. Passwords are never stored.
- Sensitive domains (Google, Microsoft ecosystems) use complex auth flows; saving/restoring may not always work. The UI displays a warning for these domains.

## Development

```bash
# Install dependencies
npm install

# Development build with watch
npm run dev

# Production build
npm run build
```

## License

```
MIT License

Copyright (c) 2025 risunCode

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to use,
copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
derivative works of the Software, subject to the following conditions:

1. The Software may be used for commercial purposes as part of a larger system or service.
2. The Software itself may not be sold as a standalone product or bundled and sold directly.
3. The above copyright notice and this permission notice shall be included in all
   copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE
FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
DEALINGS IN THE SOFTWARE.
```

## Credits

- [SJCL](https://github.com/bitwiseshiftleft/sjcl) (Stanford Javascript Crypto Library) for encryption
- [FontAwesome](https://fontawesome.com/) for icons
- Built by [risunCode](https://github.com/risunCode)
