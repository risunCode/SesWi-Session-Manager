# Firefox Alt+W Confirm Modal Open Fix (Retry)

## Problem
Firefox Alt+W did not open the confirm modal even after prioritizing popup open. Alt+Q worked correctly.

## Cause
Firefox may not deliver runtime messages to a popup that is not yet open. The previous order started popup open but did not wait for it to complete before sending the prompt message.

## Fix
- `app/background/index.ts` now awaits `getToolbarAction().openPopup()` before sending the prompt message.
- Badge feedback is set first, then popup open is awaited, then the prompt message is sent.

## Verification
- `npm test -- app/popup/uiParity.test.ts` — 70 passed.
- `npm run build:firefox` — passed.
