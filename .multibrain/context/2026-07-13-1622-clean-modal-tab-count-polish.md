# Clean Current Tab: Tab Count Resilience and Layout Polish

Date: 2026-07-13 16:22 UTC

## Fix
The Clean Current Tab modal previously loaded current-window tab counts only after `CurrentTabSnapshot.collect()` succeeded. On pages where the extension lacks host access, preview collection fails and the modal incorrectly stayed on `Checking open tabs…`, leaving Clear Other Tabs disabled.

## Implementation
- Run `loadPreview()` and `loadWindowTabs()` independently when the modal opens.
- Keep Clear Other Tabs enabled when tab enumeration succeeds, even if page-data preview is unavailable.
- Replace the unhelpful `Data for —` with `Data for Current page` and explain that window tab actions remain available when preview access is denied.
- Move Select All / Uncheck All controls to the left and add a `Data selection` label.
- Restyle the window action as an explicit `Additional` section with a clear `Clear Other Tabs` heading and open-tab count.

## Verification
- `npm test -- app/popup/uiParity.test.ts` passed: 69 tests.
- `npm run type-check` passed.
- `npm run lint` passed.
- `npm run build:chrome` passed.
- `npm run build:firefox` passed.
