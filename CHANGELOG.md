# Changelog

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
