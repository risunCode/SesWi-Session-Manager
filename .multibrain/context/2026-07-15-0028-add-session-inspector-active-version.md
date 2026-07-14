# v4.0.2 Add Session Inspection, Active Marker, and Versioning

## Scope
Only three enhancements were made; the working Railway capture/restore path was deliberately left untouched.

## Add New Session Raw Inspector
`app/popup/modals/AddSessionModal.vue` now exposes an **Inspect Data** control beside capture statistics. It expands the captured Cookies, localStorage, and sessionStorage as formatted raw JSON and permits copying that exact payload.

## Active Badge Refresh
`TabInfo.invalidate()` clears the cached active-tab result. `App.vue` calls it from the existing shared `handleDataChanged()` path, which runs after Add Session, Replace Session, and Restore. `CurrentTab.vue` now compares saved and active URLs by origin rather than requiring an exact full URL, so an active session remains marked while navigating within the current site.

## Version
`package.json`, `package-lock.json`, popup footer/update defaults, and Manage tab default are v4.0.2. WXT built Chrome and Firefox manifests at v4.0.2.

## Verification
- `npm test -- app/popup/uiParity.test.ts --reporter=dot`: 84 passed
- `npm run type-check`: passed
- `npm run build:chrome`: passed
- `npm run build:firefox`: passed
