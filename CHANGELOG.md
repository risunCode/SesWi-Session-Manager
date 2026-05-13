# Changelog

## v3.2.0 (2026-05-13)

### New Features
- **Import Cookies (Paste)** — New tab in Add Session modal to paste raw cookie JSON arrays directly (Cookie Editor format supported)
- **Import File** — New tab in Add Session modal to import sessions from `.json` or `.owi` files without going to Manage tab
- **Batch JSON Restore** — Restore modal now accepts multiple `.json` files at once; each file is parsed individually with per-file status feedback
- **Manage by Domain (Tree View)** — Group Manage modal redesigned as collapsible tree: domain as parent with session children, select-all per domain, individual session selection, scrollable (max 5 visible per group)
- **Copy Value in Saved Data** — Each row in the Saved Data modal now has a copy button to copy the full value to clipboard
- **Export Tab Data** — "Quick Action" renamed and expanded: now includes Copy JSON to clipboard, Export JSON File, and Export Netscape File
- **Browser Context Menu** — Right-click on any page for quick actions:
  - *Save Session* — Opens popup with Add Session modal
  - *Restore Last* — Instantly restores most recent session for current domain
  - *Clean Tab* — Clears cookies + storage for current domain and reloads
- **Keyboard Shortcuts**:
  - `Ctrl+N` — Open Add Session modal
  - `Ctrl+X` — Open Clean Tab modal; double-tap within 2s = instant clean without modal
- **Active Session Badge** — Small "active" badge next to cookie count for last-restored session, persists across popup close/reopen via `chrome.storage.local`

### UI Redesign
- **Session Actions Header** — Redesigned as a card with favicon, domain (bold), visit icon-only button, and session name + metadata on second row
- **Manage Tab** — Regrouped into two sections (Sessions / Current Tab) with section labels; items renamed for clarity; icon colors moved from fragile `nth-child` selectors to explicit CSS classes
- **Delete button** — Changed from full-width red block to subtle outline style; turns red only on hover
- **Export buttons** — Removed dashed border style
- **Shimmer replaced with badge** — Removed restore/save shimmer animations, replaced with simple "active" badge indicator

### Bug Fixes
- Fixed `wireActions()` async race condition — `allowed` domain check now happens at click time, not modal open time
- Fixed `parsedSessions` and `fileType` not resetting when Restore modal was reopened
- Fixed `format` variable not resetting when Backup modal was reopened (could silently export OWI without password prompt)
- Fixed Replace session losing `index` and `originalUrl` from the original session
- Fixed `msg.classList.add('error')` in Backup modal never being removed on reopen
- Fixed `addEventListener('change', updateCount)` stacking on every `openGroupManage()` call
- Fixed Delete Expired items not showing `selected` class despite checkbox being checked
- Fixed history filter in Clean Tab using manual string matching instead of `Domain.isMatch()`
- Fixed `latestSession` in domain card using sort-by-index instead of sort-by-timestamp
- Fixed `statusClass` for cookies expiring in 1–7 days showing `expired` instead of `warning`
- Fixed Manage by Domain expand requiring precise click on chevron icon
- Fixed `Export JSON` in Session Actions exporting full session object instead of cookies array
- Fixed `cleanCurrentTab` crashing on `chrome://` pages (now skips scripting)
- Fixed Delete Expired using sequential deletes (now uses batch `deleteMany`)
- Fixed active badge not showing instantly after restore (now renders immediately)
- Fixed context menu disappearing when service worker sleeps (now recreates on every wake)

### Cleanup & Refactor
- **Removed ~860 lines of dead CSS** — old group-card, auth-status-card, modal-actions-grid, exp-info-card, saved-data-card, inspector-area, tag-selector, legacy buttons, unused Tailwind utilities
- Consolidated Tailwind utilities from ~70 to ~25 actually used classes
- Fixed duplicate `.flex-1` and `.btn-primary` CSS definitions
- Removed `renderCookieExpiration()` dead code (was immediately overwritten)
- Removed `_current.activeTab` (written but never read)
- Removed unused `import { Crypto }` in `sessionModal.js`
- Extracted `getExpStatusText(exp)` helper — eliminated duplicate status text building
- Extracted `renderExpDetails(cookies)` — replaced inline IIFE that duplicated pill logic
- Merged identical `localStorage` and `sessionStorage` render blocks in `renderSavedDataContent`
- Merged `_wireOWIExportModal` and `_wireBatchOWIModal` into shared `_wireOWIModal(modal, ids, getExportData)`
- Replaced all inline `Blob → createObjectURL → a.click()` patterns with `DOM.downloadFile()`
- Replaced `nth-child` color selectors with explicit `.card-icon--*` classes
- Added `SessionStorage.deleteMany(timestamps)` for batch deletion
- Extended `Normalize.importSessions()` to handle raw cookie arrays and `{cookies, localStorage, sessionStorage}` format
- Removed unnecessary `async` from `initTabs()`

### Font
- JetBrains Mono (local only, no external requests)

---

## v3.1.0 (2026-03-21)

### Codebase Cleanup & Refactor
- **Removed duplicate logic** — Unified modal close animation (`DOM.closeModal`), expiration calculation, and domain matching into shared utils
- **Deleted dead code** — Removed unused `getExpirationStatus()`, duplicate `SessionStorage.getGrouped()`, unused `Renderer.pagination()`, and redundant `extractDomain()` wrapper
- **Centralized import parsing** — New `Normalize.importSessions()` handles all formats (raw array, legacy wrapper, single object) in one place
- **Merged BrowserStorage** — `getLocal()` and `getSession()` now share a single `get(tabId, type)` implementation
- **Extracted cookie restore helper** — `cleanForRestore()` and `getCookieUrl()` centralize backward-compat scrubbing for Chrome's cookies API

### Security & Storage
- **Randomized storage key** — Session data key is now a random hex string generated on first install instead of a hardcoded value. Migration from old key is automatic with zero user interaction
- **Consistent domain matching** — All domain comparisons now use the shared `Domain.isMatch()` util instead of scattered manual implementations

### Export Format
- **Raw JSON exports** — All JSON exports now output a plain session array instead of the proprietary `{version, exportDate, sessions}` wrapper. Import still accepts both formats for backward compatibility
- **Label cleanup** — "Export JSON (raw)" → "Export JSON", "Copy Raw JSON" → "Copy JSON"

### UI Fixes
- **Saved Data modal** — Fixed tab buttons (Cookies/localStorage/sessionStorage) overlapping by adjusting modal width and tab sizing
- **No more alert()** — Replaced remaining `alert()` calls in export flow with proper modal dialogs

### Developer Experience
- **Shared debounce helper** — `DOM.debounceInput()` replaces copy-pasted debounce patterns in search handlers
- **Cleaner utils** — Added `DOM.closeModal()`, `DOM.debounceInput()`, and `Normalize` module to `utils.js`

---

## v3.0.0 (2026-02-07)

### New Features
- **UI Overhaul** — New macOS-inspired "Traffic Lights" modal design with smooth entry/exit animations
- **Delete Expired Sessions** — New batch action in Manage tab to find and delete sessions with expired auth cookies
- **Edit Session Modal** — Proper modal dialog for editing session names (replaces browser prompt)
- **Replace Session Modal** — Safe confirmation dialog for replacing sessions (replaces browser confirm)
- **Batch OWI Export** — New modal for password-protected batch exports
- **Saved Data Card** — New card in Session Actions showing cookies/localStorage/sessionStorage counts
- **Repo Info Card** — Added repository and author information card in the popup

### UI Improvements
- **Cleaner Session Cards** — Removed data counts from cards, now shows only expiration status
- **Compact Expiration Info** — New format: "Expiration info (Valid: 48d)" with expand toggle
- **Domain Badge** — Shows simplified domain (e.g., "facebook" not "facebook.com") next to Visit button
- **Better Layout** — URL on left, timestamp on right in session cards
- **Auto Domain Grouping** — Sessions grouped by domain instead of manual tags
- **Consistent Icons** — All favicons now have a unified light grey background for better visibility
- **Enhanced Add Session Button** — Improved button styling with better visibility and hover effects

### Changes
- **Simplified Expiration Logic** — Now uses longest cookie expiration date instead of complex login cookie detection
- **Removed isLoginCookie()** — No more pattern matching for auth cookies, simpler and more reliable

### Removed
- **Tag System** — Replaced with automatic domain-based grouping
- **Data Counts in Cards** — Moved to Session Actions modal for cleaner list view
- **Native Dialogs** — All `alert()`, `confirm()`, and `prompt()` calls replaced with custom modals
- **Smart Cookie Detection** — Removed complex login cookie heuristics in favor of simple expiration tracking

### Documentation
- Added Showcase section with screenshot table in README
- Added experimental warning for Smart Expiration feature
- Added Netscape Cookies Exporter to credits

### Bug Fixes
- Fixed false expiration detection on tracking cookies (wd, wl_cbv, dbln)
- Fixed sessions with >30 days showing only checkmark without days count
- Fixed password field eye icon alignment in export modal
- Fixed visibility of white icons/favicons on light backgrounds

---

## v2.2.0

### Clean Current Tab Enhancements
- Data preview for cookies, localStorage, sessionStorage, and history
- Expandable sections with cookie expiration status
- History preview with relative visit times

### Bug Fixes & Security
- Fixed CSP violations (removed inline event handlers)
- Fixed history clearing using proper Chrome API
- Improved cookie domain matching

---

## v2.1.0

### Architecture Rebuild
- 43% fewer files (21 → 12)
- Modular structure with core/ and ui/ separation
- Single consolidated CSS file
- Vite build system

### New Features
- Selective storage save options
- Clear after save option
- Enhanced Clean Tab modal
- Improved favicon caching
