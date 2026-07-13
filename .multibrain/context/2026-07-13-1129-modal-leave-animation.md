# Modal Leave Animation

## Problem
Shared CSS already defined `.sw-modal-leave-*`, but lazy modal components in `App.vue` were conditionally mounted using `v-if="activeModal === ..."`. Closing set `activeModal` to null and unmounted the complete component before `ModalBase` could run Vue's leave transition.

## Changes
- `app/popup/composables/useModalStack.ts`
  - Added `renderedModal` alongside `activeModal`.
  - Closing sets `activeModal` to null immediately so `ModalBase` receives `open=false`.
  - The rendered lazy component remains mounted for the shared 220 ms leave duration and is then removed.
  - Opening another modal cancels a pending unmount timer.
  - Exported the named `ModalStack` interface.
- `app/popup/App.vue`
  - Lazy modal `v-if` conditions now use `renderedModal`; their `open` props use `activeModal`.
  - Two-factor entry data is retained while its close animation runs.
- `app/popup/uiParity.test.ts`
  - Added a behavioral timer regression proving the active key clears before the rendered key.
  - Added explicit assertions for the global leave selectors.

## Verification
- `npm test -- app/popup/uiParity.test.ts` — 70 passed.
- `npm run lint` — passed.
- `npm run type-check` — passed.
- `npm run build:chrome` — passed.
- `npm run build:firefox` — passed.
