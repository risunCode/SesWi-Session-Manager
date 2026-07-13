# SesWi v4.0.0 Release Journey

## Release Direction
v4.0.0 is a clean product and platform cutover. SesWi now targets Manifest V3 on Chrome and Firefox, while the popup and current-tab workflows are simplified around deliberate, visible user actions.

## Product Journey
1. **Popup foundation and responsiveness** — the popup starts behind a safe loading shell, defers non-critical update work, parallelizes startup reads, and lazy-loads heavy modal chunks. Master Password gating remains strict: protected popup content never renders locked.
2. **Session clarity** — saved session data is shown in a dedicated detail modal, and Groups remains compact while collapsed. Group and TOTP lists scroll rather than compress or clip data.
3. **Current-tab control** — export is intentionally limited to Cookie Editor JSON clipboard copy and Netscape file output. Clean Current Tab has two clear surfaces: Site Data for cookies, browser storage, history, and cache; Window for explicit confirmed Clear Other Tabs while retaining the active tab.
4. **Security correctness** — encrypted session and TOTP writes propagate failures; OWI import review remains lock-aware; cookie and injected-storage cleanup verify actual browser results instead of returning false success.
5. **Browser command simplification** — Alt+Q is the sole browser-level command and toggles the focused popup. The unreliable Alt+W browser command was removed; window cleanup belongs to the visible Clean Current Tab flow.
6. **Firefox MV3 parity** — Firefox development and release builds explicitly target MV3. Generated Firefox manifests use `action`, separate host permissions, and Firefox's persistent MV3 background page. Its Master Password remember cache safely uses background memory because Chrome offscreen is unavailable.

## Release Contracts
- Version: `v4.0.0`
- Supported browser manifests: Chrome MV3 and Firefox MV3
- Firefox output: `.output/firefox-mv3`
- Master Password remembered unlock: five minutes, extension memory only
- Browser command: Alt+Q only
- Window cleanup: Current Tab → Clean Current Tab → Window → Clear Other Tabs

## Documentation Alignment
- `README.md` documents v4 highlights, browser builds, and current keyboard/window-cleanup behavior.
- `AGENTS.md` treats Firefox MV3 and `browser.action` as the active manifest/action contract.
- Root landing page labels v4.0.0, Firefox Manifest V3, and the Current Tab cleanup flow.
- Historical bug-by-bug notes were compressed out of the active Multi Brain index; the detailed context files stay available for archaeology.

## Verification
- `npm test` — 75 passed
- `npm run lint` — passed
- `npm run type-check` — passed
- `npm run build:chrome` — passed
- `npm run build:firefox` — passed
- After the final popup-height fix, the Firefox MV3 package was rebuilt and the user manually confirmed its footer renders correctly.
