# SesWi Rebuild - Architecture & Structure

## Filosofi Rebuild

**Prinsip Minimalis:**
- Kurangi file dan folder yang tidak perlu
- Gabungkan modul yang terkait erat
- Hapus abstraksi berlebihan
- Satu file = satu tanggung jawab yang jelas

---

## Perbandingan Struktur

### OLD Structure (Kompleks)
```
old/
├── background/
│   └── service-worker.js
├── modules/
│   ├── ChromeAPI/
│   │   ├── CookieGrabber.js
│   │   ├── DataManager.js
│   │   ├── IconsGrabber.js
│   │   └── LocalGrabber.js
│   ├── Encryption/
│   │   ├── EncryptionUtils.js
│   │   └── sjcl.js
│   ├── Tabs/
│   │   ├── Current-Tab.js
│   │   ├── Group-Tabs.js
│   │   ├── Manage-Tab.js
│   │   └── ModalManager.js
│   └── Utilities/
│       ├── BackupDataValidator.js
│       ├── BackupRestoreJSON.js
│       ├── BackupRestoreOWI.js
│       ├── GlobalPagination.js
│       └── GlobalUtility.js
├── style/
│   ├── BaseStyle.css
│   ├── CurrentTabStyle.css
│   ├── GroupTabStye.css
│   ├── ManageTabStyle.css
│   └── ModalPopUP.css
├── popup.html
├── popup.js
└── manifest.json

Total: 21 files (tanpa assets/docs)
```

### NEW Structure (Minimalis)
```
seswi/
├── assets/
│   └── icons/
│       ├── 16.png
│       ├── 48.png
│       └── 128.png
├── lib/
│   └── sjcl.min.js          # Library enkripsi (external)
├── src/
│   ├── core/
│   │   ├── storage.js       # Chrome storage operations
│   │   ├── cookies.js       # Cookie CRUD operations
│   │   └── crypto.js        # Encryption wrapper
│   ├── ui/
│   │   ├── tabs.js          # Tab switching & rendering
│   │   └── modals.js        # All modal handlers
│   └── utils.js             # Shared utilities
├── styles/
│   └── main.css             # Single consolidated CSS
├── background.js            # Service worker
├── popup.html
├── popup.js                 # Entry point
└── manifest.json

Total: 12 files (tanpa assets)
```

**Pengurangan: 21 → 12 files (43% lebih sedikit)**

---

## Module Responsibilities

### `/src/core/storage.js`
Menggabungkan: DataManager.js + LocalGrabber.js

```javascript
// Exports:
export const SessionStorage = {
  getAll(),
  save(session),
  update(session),
  delete(timestamp),
  getByDomain(domain),
  getGrouped()
}

export const BrowserStorage = {
  getLocalStorage(tabId),
  getSessionStorage(tabId),
  clearAll(tabId)
}

export const TabInfo = {
  getCurrent(),
  cleanCurrentTab()
}
```

### `/src/core/cookies.js`
Menggabungkan: CookieGrabber.js

```javascript
// Exports:
export const Cookies = {
  getForDomain(domain),
  getCurrentTab(),
  remove(domain),
  restore(session)
}
```

### `/src/core/crypto.js`
Menggabungkan: EncryptionUtils.js + BackupRestoreOWI.js

```javascript
// Exports:
export const Crypto = {
  encrypt(data, password),
  decrypt(data, password),
  exportOWI(sessions, password, filename),
  importOWI(fileContent, password)
}
```

### `/src/ui/tabs.js`
Menggabungkan: Current-Tab.js + Group-Tabs.js + Manage-Tab.js

```javascript
// Exports:
export const CurrentTab = {
  render(),
  handleAddSession()
}

export const GroupTab = {
  render(),
  toggleGroup(domain)
}

export const ManageTab = {
  init(),
  handleBackup(),
  handleRestore(),
  handleClean()
}
```

### `/src/ui/modals.js`
Menggabungkan: ModalManager.js + modal logic dari Manage-Tab.js

```javascript
// Exports:
export const Modal = {
  openSessionActions(session),
  openBackupFormat(),
  openRestore(),
  openGroupedAction(),
  close(id)
}
```

### `/src/utils.js`
Menggabungkan: GlobalUtility.js + GlobalPagination.js + BackupDataValidator.js + BackupRestoreJSON.js

```javascript
// Exports:
export const DOM = { escapeHtml, createElement }
export const Domain = { getBase, isMatch, isSensitive }
export const Time = { formatRelative, getDaysLeft }
export const Pagination = { getPage, render }
export const Backup = { validateJSON, exportJSON, importJSON }
export const Response = { success, error }
export const Logger = { log, warn, error }
```

---

## Data Flow

```
┌─────────────────────────────────────────────────────────┐
│                      popup.js                           │
│                   (Entry Point)                         │
└─────────────────────┬───────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
┌───────────┐  ┌───────────┐  ┌───────────┐
│ tabs.js   │  │ modals.js │  │ utils.js  │
│ (UI Tabs) │  │ (Dialogs) │  │ (Helpers) │
└─────┬─────┘  └─────┬─────┘  └───────────┘
      │              │
      └──────┬───────┘
             ▼
┌─────────────────────────────────────────────────────────┐
│                    /src/core/                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │storage.js│  │cookies.js│  │ crypto.js│              │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘              │
└───────┼─────────────┼─────────────┼─────────────────────┘
        │             │             │
        ▼             ▼             ▼
┌─────────────────────────────────────────────────────────┐
│                  Chrome APIs                            │
│  chrome.storage  chrome.cookies  chrome.scripting      │
│  chrome.tabs     chrome.history                         │
└─────────────────────────────────────────────────────────┘
```

---

## CSS Consolidation

### OLD: 5 CSS files
- BaseStyle.css (layout, colors, typography)
- CurrentTabStyle.css (current tab specific)
- GroupTabStye.css (group tab specific)
- ManageTabStyle.css (manage tab specific)
- ModalPopUP.css (modal styles)

### NEW: 1 CSS file dengan sections
```css
/* main.css */

/* ========== Variables ========== */
:root { ... }

/* ========== Base & Layout ========== */
.app-container { ... }
.app-header { ... }
.app-footer { ... }

/* ========== Tab Navigation ========== */
.tab-navigation { ... }
.tab-btn { ... }
.tab-content { ... }

/* ========== Session Cards ========== */
.session-card { ... }
.session-header { ... }
.session-meta { ... }

/* ========== Group View ========== */
.group-card { ... }
.group-header { ... }
.group-sessions { ... }

/* ========== Manage Cards ========== */
.manage-card { ... }

/* ========== Modals ========== */
.modal { ... }
.modal-content { ... }
.modal-header { ... }
.modal-body { ... }
.modal-footer { ... }

/* ========== Components ========== */
.btn-primary { ... }
.btn-secondary { ... }
.notification { ... }
.pagination { ... }

/* ========== States ========== */
.hidden { ... }
.disabled { ... }
.just-saved { ... }
```

---

## Implementation Priority

### Phase 1: Core Infrastructure
1. `manifest.json` - Extension config
2. `src/utils.js` - Shared utilities
3. `src/core/storage.js` - Data layer
4. `src/core/cookies.js` - Cookie operations

### Phase 2: UI Foundation
5. `popup.html` - HTML structure
6. `styles/main.css` - Consolidated styles
7. `popup.js` - Entry point & initialization

### Phase 3: UI Components
8. `src/ui/tabs.js` - Tab rendering
9. `src/ui/modals.js` - Modal handlers

### Phase 4: Advanced Features
10. `src/core/crypto.js` - Encryption
11. `background.js` - Service worker

---

## Migration Notes

### Breaking Changes
- Storage key tetap: `seswi-sessions-blyat` (backward compatible)
- Data format tidak berubah
- API Chrome yang digunakan sama

### Improvements
- Faster load time (fewer files)
- Easier maintenance (consolidated code)
- Better code organization
- Reduced redundancy

---

## File Size Estimates

| File | Est. Lines | Purpose |
|------|------------|---------|
| storage.js | ~200 | Session & browser storage |
| cookies.js | ~80 | Cookie operations |
| crypto.js | ~100 | Encryption/decryption |
| tabs.js | ~300 | Tab UI rendering |
| modals.js | ~400 | Modal handlers |
| utils.js | ~150 | Shared utilities |
| popup.js | ~50 | Entry point |
| main.css | ~500 | All styles |
| **Total** | **~1780** | vs ~2500+ lines in old |

---

## Next Steps

1. ✅ Requirements documented
2. ✅ Architecture designed
3. ⬜ Create new folder structure
4. ⬜ Implement core modules
5. ⬜ Implement UI modules
6. ⬜ Consolidate CSS
7. ⬜ Testing & validation
8. ⬜ Migration guide
