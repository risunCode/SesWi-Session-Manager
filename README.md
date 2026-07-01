# SesWi — Session Manager

Chrome extension for saving and restoring login sessions. Captures cookies, localStorage, sessionStorage, and TOTP 2FA secrets per domain.

## Features

- **Save & Restore** — Save complete login sessions and restore them later
- **2FA Manager** — Store TOTP secrets with auto-updating codes, QR scan, manual entry, issuer grouping
- **Smart Expiration** — Tracks cookie expiration based on longest-lasting cookie *(experimental)*
- **Domain Groups** — Auto-groups sessions by domain for easy management
- **Backup/Export** — JSON, Netscape, Cookie Editor, or OWI (AES-256-GCM encrypted) formats; per-type (sessions/2FA)
- **Batch Operations** — Bulk backup, delete expired, or manage by domain
- **Import Cookies** — Paste raw cookie JSON (Cookie Editor format) or import from file
- **Clean Tab** — Selectively clear cookies, storage, history, and cache
- **Randomized Storage** — Session data stored under a unique random key per installation
- **Native Encryption** — Web Crypto API (AES-256-GCM) with PBKDF2 key derivation

## Showcase

| Current Tab | Groups Tab | 2FA Tab | Manage Tab |
|:-----------:|:----------:|:-------:|:----------:|
| <img width="200" alt="Current Tab" src="https://github.com/user-attachments/assets/82415046-8903-4e6b-bd63-ef8a35a7eac3" /> | <img width="200" alt="Groups Tab" src="https://github.com/user-attachments/assets/648ba543-bb21-4159-a436-7114e65ef0d7" /> | *Screenshot pending* | <img width="200" alt="Manage Tab" src="https://github.com/user-attachments/assets/900dff33-7de2-4a6d-b4ff-5f9b5e82de90" /> |

## Installation

1. Clone/download this repository
2. Run `npm install && npm run build`
3. Open `chrome://extensions` → Enable Developer mode
4. Click "Load unpacked" → Select the `dist` folder

## Usage

- **Current tab** — Sessions for active domain
- **Groups tab** — All sessions grouped by domain
- **2FA tab** — TOTP secrets with auto-updating codes, QR scan, manual entry
- **Manage tab** — Backup, restore, manage by domain, delete expired, clean tab, export tab data

### Add Session Modes
| Mode | Description |
|------|-------------|
| Capture Tab | Capture cookies + localStorage + sessionStorage from active tab |
| Import Cookies | Paste raw cookie JSON array (Cookie Editor format) |
| Import File | Import from `.json` or `.owi` backup file |

### 2FA Add Modes
| Mode | Description |
|------|-------------|
| Scan QR | Capture visible tab → jsQR decode → preview → save |
| Manual | Enter issuer, account, secret, and algorithm manually |

### Export Formats
| Format | Contents |
|--------|----------|
| JSON | `{ cookies, localStorage, sessionStorage }` |
| Cookie Editor | Cookie array compatible with Cookie Editor extension |
| Netscape | Browser-compatible cookie file (curl/wget) |
| OWI | AES-256-GCM encrypted JSON backup |

## Permissions

| Permission | Purpose |
|------------|---------|
| `cookies` | Read/write cookies |
| `storage` | Store sessions locally |
| `scripting` | Access localStorage/sessionStorage |
| `tabs` | Get active tab info |
| `activeTab` | Capture visible tab for QR scan |
| `history` | Clean browsing history |
| `browsingData` | Clear cache |

## Development

```bash
npm install
npm run dev      # Development with watch
npm run build    # Production build
npm test         # Run Vitest suite
```

## License

MIT License - See LICENSE file for details.

## Credits

- [Netscape Cookies Exporter](https://github.com/osiro/netscape-cookies-exporter) for Netscape format reference
- [jsQR](https://github.com/cozmo/jsQR) for QR code scanning
- [FontAwesome](https://fontawesome.com/) for icons
- Built by [risunCode](https://github.com/risunCode)
