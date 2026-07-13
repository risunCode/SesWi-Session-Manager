# Firefox Manifest V3 Migration

## Decision
Firefox is now a first-class Manifest V3 target alongside Chrome. SesWi no longer produces or documents Firefox MV2 builds.

## Changes
- `wxt.config.ts` sets `manifestVersion: 3` explicitly, preventing WXT's Firefox-default MV2 behavior.
- `package.json` Firefox development and production scripts both pass `--mv3`.
- `app/background/index.ts` now uses the MV3 `browser.action.openPopup()` API directly; the obsolete MV2 `browser.browserAction` fallback was removed.
- `app/popup/uiParity.test.ts` covers the Firefox MV3 script contract, the MV3 action API contract, and preserved Gecko metadata.
- `README.md` and the root landing page point Firefox installs to `.output/firefox-mv3` and label Firefox as Manifest V3.

## Verified Generated Contract
`.output/firefox-mv3/manifest.json` contains:
- `manifest_version: 3`
- `action`, not `browser_action`
- `background.scripts` (Firefox's persistent MV3 background page), not a Chrome service worker
- separate `host_permissions`
- preserved Gecko ID, Firefox minimum version `109.0`, and required `data_collection_permissions: ['none']`

## Master Password Cache
Firefox MV3 has no Chrome offscreen API. The existing runtime feature-detects that absence and uses the background in-memory cache. Firefox's WXT MV3 output has a persistent background page, so the five-minute in-memory cache contract remains intact.

## Verification
- `npm test -- app/popup/uiParity.test.ts` — 71 passed
- `npm run lint` — passed
- `npm run type-check` — passed
- `npm run build:chrome` — passed
- `npm run build:firefox` — passed
