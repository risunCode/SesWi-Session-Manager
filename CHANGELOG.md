# Changelog

## v4.0.0 (2026-07-13)

### Breaking Changes
- **Manifest V3 everywhere** — Chrome and Firefox now both ship as MV3 builds. Firefox packages are produced in `.output/firefox-mv3`.
- **Browser commands simplified** — Alt+Q is the single browser-level command; window cleanup is an explicit Current Tab → Window action.

### New Features
- **Authenticator intake** — Add 2FA manually, scan QR codes, or import encrypted/plain Aegis JSON, Google Authenticator migration URIs, and standard OTPAuth URI lists.
- **2FA management** — Dedicated 2FA Manager supports batch deletion; 2FA cards have deterministic initials, explicit actions, and one shared expiry indicator.
- **Session domain cleanup** — Session Manager can delete every saved session for a domain after confirmation.

### Security and Data Integrity
- **Audited restore pipeline** — Ready cookie-batch files now merge into the final restore payload instead of reporting a false-success zero restore.
- **Atomic 2FA changes** — Batch deletion uses a single storage write; edits validate Base32 secrets before persistence.
- **Safe importer boundaries** — Aegis import limits scrypt work, skips unsupported credential slots, validates password-protected vaults before preview, and ignores stale async file/decrypt results.
- **Approved-tab bridge scope** — Userscript actions now operate only on the exact tab and URL that requested approval.
- **Master Password lifetime** — Remembered plaintext cache is proactively purged at expiry; Master Password and recovery setup validate together before source data is cleared.

### Fixes
- **Uninstall release status** — The uninstall feedback page checks GitHub Releases at open and shows the latest available SesWi version with a direct release link.
- **2FA OTPAuth batch intake** — Plain-text `.txt` files containing OTPAuth URI lists are recognized as 2FA batches rather than incorrectly falling through to cookie/session import.
- **Firefox import picker reliability** — File selection now persists picker intent before opening Firefox’s focusable background picker, eliminating intermittent Add Session and Backup & Restore clicks.
- **Page-storage null handling** — Restore normalizes Firefox-serialized null storage payloads, avoiding `can't convert null to object` after a successful login restore.
- **Current Tab pagination** — Current Tab shows five saved sessions per page.
- **Subdomain authentication capture** — Session and Netscape exports now collect cookies for the active base domain and its subdomains in the active browser cookie store, retaining host-only authentication cookies such as Railway’s `backboard.railway.com` session.
- **Page-storage restore sequencing** — Restore now reloads after cookie installation before writing local/session storage, then reloads again so authenticated page state can initialize from the restored cookies in both Chrome and Firefox. Storage writes remain verified and failures are surfaced.
- **Current-tab active badge** — Newly saved and replaced sessions for the open tab now show the `ACTIVE` badge before the cookie count, below their validity status.
- **Restore ordering** — Restored sessions retain their original saved date while separate restore-order metadata places them at the top of the current and grouped session lists.
- **Firefox restore cookie store** — Restored cookies now target the active tab's Firefox cookie store instead of reusing a source browser `storeId`; failed cookie writes are surfaced instead of reported as success.
- **Replace Session freshness** — Replaced sessions receive a fresh timestamp and update by stable session ID, so Session Actions and Session Manager immediately show `just now` / `1m ago`.
- **Backup & Restore count** — The modal loads session and 2FA counts on its initial mount.
- **Current-tab cleanup scope** — Current Tab no longer exposes a browser-global cache deletion; cleanup remains scoped to selected site data and history.
- **Alt+Q compatibility** — Chrome manifest declares the Chrome 127 baseline required by `action.openPopup()`.
- **Firefox popup layout** — Popup shell height matches the Firefox viewport, keeping the footer visible.

---

## v3.5.0 (2026-07-13)

### Bug Fixes
- **Alt+W window clear** — Fixed window clear to use native browser blank page (`about:blank`) instead of extension page, ensuring browser window stays open
- **Alt+W confirm modal** — Modal now auto-closes after clear operation completes (both via second press and button click)
- **Alt+Q popup** — Fixed Alt+Q to reliably open SesWi popup with proper error logging
- **Preload warnings** — Disabled modulePreload in WXT config to fix cross-world extension resource mismatch warnings in popup.html
- **Runtime command check** — Added startup check for Alt+W shortcut assignment; warns to console if not configured and directs to chrome://extensions/shortcuts
- **Window clear approach** — Changed from creating new tab to navigating existing active tab to about:blank, then removing other tabs (prevents browser closure)

### Changes
- **Alt+W behavior** — First press opens SesWi popup and shows confirm modal "Clear This Window?"; second press within 2 seconds or clicking "Clear Window" executes clear
- **Survivor tab** — Uses native browser `about:blank` instead of extension `/blank.html` for clearer user expectation

---

## v3.5.0 (2026-07-02)

### Hotfixes
- **Updater reliability** — Added forced manual update checks from Manage tab and invalidated stale cached update results when extension version changes
- **Updater feedback** — GitHub API failures now surface as user-visible toast errors instead of silently looking like “no update”
- **Build cleanup** — Removed stale SJCL bundler copy/injection steps so production builds succeed after the Web Crypto migration
- **Add Session modal wiring** — Restored the missing OWI verify control so the Add Session button initializes and opens correctly again
- **Netscape text import** — File import now accepts `.txt` Netscape cookie backups in both Add Session and Backup/Restore flows


---

## v3.4.1 (2026-07-01)

### New Features
- **2FA Tab** — Dedicated tab for TOTP-based two-factor authentication secrets
  - Manual entry with issuer, account, secret, algorithm, digits, period
  - QR scan via `chrome.tabs.captureVisibleTab` + jsQR decode
  - Auto-updating TOTP codes with progress bar countdown
  - Copy code by clicking card body; group by issuer; search support
- **Split Backup/Restore** — Export or import per data type (All/Sessions/2FA)
  - `Backup.createPayload(kind)` with `all|sessions|twoFactor`
  - Selective restore with per-type checkboxes
- **Canonical Backup Payload** — Unified `{ version, kind, data: { sessions, twoFactorEntries } }` format
  - Legacy payloads upgraded in-memory on parse
  - Master password protects both sessions and 2FA entries
- **Cookie Editor Restore Fix** — Raw cookie arrays auto-wrapped into session objects

### UI Changes
- **2FA Card Redesign** — Stacked layout (name, code+timer, actions), body-click copy, amber/red action buttons
- **Include Pills → Card** — Backup export type selector changed to bordered card with icon rows
- **ActiveTab permission** — Added `activeTab` to manifest for `captureVisibleTab`

### Bug Fixes
- Fixed 2FA modal using `DOM.hideModal` (undefined) instead of `DOM.closeModal`
- Fixed QR scan modal close animation
- Fixed issuer fallback to extract domain from email in account name
- Fixed edit/delete buttons requiring multiple clicks (DOM replaced every ticker cycle)
- Fixed toast overlapping action buttons (`pointer-events: none`)

---
## v3.4.0 (2026-05-14)

### Breaking Changes
- **Web Crypto API Only** — Encryption now uses native Web Crypto API (AES-256-GCM) exclusively
  - SJCL library support has been removed
  - Users upgrading from v3.3.0 or earlier must export sessions as JSON first, then re-import after updating
  - OWI files from previous versions are no longer compatible

### New Features
- **Cookie Editor Export** — New export format compatible with Cookie Editor extension
  - Available in Quick Actions modal alongside JSON and Netscape formats
  - Includes `hostOnly`, `session`, `storeId`, and `sameSite` fields
- **Update Checker** — Automatically checks GitHub releases for new versions
  - Badge appears in footer when update is available
  - Checks once per 24 hours (cached to avoid API rate limits)
  - Click badge to go directly to release page

### Security
- **Native AES-256-GCM** — Replaced SJCL with Web Crypto API
  - PBKDF2 with SHA-256 for key derivation (100k iterations)
  - Recovery answers use 200k iterations (compensate for lower entropy)
  - 12-byte IV, 16-byte salt, authenticated encryption
- **Cleaner codebase** — Removed ~100 lines of legacy SJCL compatibility code

---

## v3.2.1 (2026-05-13)

### New Features
- **Browser Context Menu** — Right-click on any page:
  - *Save Session* — Opens popup with Add Session modal for naming
  - *Restore Last* — Instantly restores most recent session for current domain + reload
  - *Clean Tab* — Clears cookies + storage for current domain + reload
- **Ctrl+X Quick Clean** — Single press opens Clean Tab modal; double-tap within 2s = instant clean without modal
- **Active Badge Per-Domain** — "active" badge now persists independently for each domain (not just last-used)

### Bug Fixes
- Fixed active badge only tracking single domain (now uses per-domain map in `chrome.storage.local`)
- Fixed old string format in storage causing badge to never load (auto-migrates to map)
- Fixed `setRestored` using `session.domain` instead of `tabInfo.data.domain` (key mismatch with render lookup)
- Fixed active badge not showing in Groups tab (now reads from per-domain map)
- Fixed context menu disappearing when service worker sleeps (recreates on every wake)
- Fixed Ctrl+X double-tap not closing the Clean Tab modal before executing

---

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
