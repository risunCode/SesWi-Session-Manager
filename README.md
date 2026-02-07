# SesWi — Session Manager

Chrome extension for saving and restoring login sessions. Captures cookies, localStorage, and sessionStorage per domain.

## Features

- **Save & Restore** — Save complete login sessions and restore them later
- **Smart Expiration** — Tracks cookie expiration based on longest-lasting cookie *(experimental, may be inaccurate)*
- **Domain Groups** — Auto-groups sessions by domain for easy management
- **Backup/Export** — JSON (plain) or OWI (AES-256 encrypted) formats
- **Batch Operations** — Bulk backup, delete expired, or clean by domain
- **Clean Tab** — Selectively clear cookies, storage, history, and cache

## Showcase

| Current Tab | Groups Tab | Manage Tab |
|:-----------:|:----------:|:----------:|
| <img width="280" alt="Current Tab" src="https://github.com/user-attachments/assets/82415046-8903-4e6b-bd63-ef8a35a7eac3" /> | <img width="280" alt="Groups Tab" src="https://github.com/user-attachments/assets/648ba543-bb21-4159-a436-7114e65ef0d7" /> | <img width="280" alt="Manage Tab" src="https://github.com/user-attachments/assets/900dff33-7de2-4a6d-b4ff-5f9b5e82de90" /> |

## Installation

1. Clone/download this repository
2. Run `npm install && npm run build`
3. Open `chrome://extensions` → Enable Developer mode
4. Click "Load unpacked" → Select the `dist` folder

## Usage

- **Current tab** — Sessions for active domain
- **Groups tab** — All sessions grouped by domain
- **Manage tab** — Backup, restore, clean data, delete expired

## Permissions

| Permission | Purpose |
|------------|---------|
| `cookies` | Read/write cookies |
| `storage` | Store sessions locally |
| `scripting` | Access localStorage/sessionStorage |
| `tabs` | Get active tab info |
| `history` | Clean browsing history |
| `browsingData` | Clear cache |

## Development

```bash
npm install
npm run dev      # Development with watch
npm run build    # Production build
```

## License

MIT License - See LICENSE file for details.

## Credits

- [SJCL](https://github.com/bitwiseshiftleft/sjcl) for encryption
- [Netscape Cookies Exporter](https://github.com/osiro/netscape-cookies-exporter) for Netscape format reference
- [FontAwesome](https://fontawesome.com/) for icons
- Built by [risunCode](https://github.com/risunCode)
