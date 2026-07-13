# Firefox Alt+W Confirm Modal Open Fix

## Problem
Firefox Alt+W did not open the SesWi confirm modal. Alt+Q worked correctly.

## Cause
Firefox requires `browserAction.openPopup()` to be called directly from the command gesture. The previous order awaited badge and runtime message operations first, which caused the gesture to expire before the popup could open.

## Fix
- `app/background/index.ts` now starts `getToolbarAction().openPopup()` immediately in the Alt+W command handler.
- Badge and runtime message operations run after the popup open is initiated.
- The popup syncs its state from the background when mounted.

## Verification
- `npm test -- app/popup/uiParity.test.ts` — 70 passed.
- `npm run build:firefox` — passed.
