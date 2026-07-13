# Saved Data Modal and Groups Status Cleanup

## Goal
Keep collapsed Groups cards visually clean, and move saved session data viewing out of the Session Actions modal into its own modal.

## Changes
- `app/popup/tabs/GroupsTab.vue`: hides the expiration/auth badge unless the corresponding domain card is expanded.
- `app/popup/modals/SavedDataModal.vue`: adds a lazy-loaded dedicated modal for cookies, localStorage, and sessionStorage. It exposes per-value copy actions and transient copy feedback.
- `app/popup/modals/SessionActionsModal.vue`: the saved-data summary card now emits `open-saved-data`; the obsolete inline data viewer, state, copy composable, and styles were removed.
- `app/popup/composables/useModalStack.ts`: adds the `savedData` route key.
- `app/popup/App.vue`: lazily loads and mounts `SavedDataModal`; opening it replaces Session Actions using the selected session.
- `app/popup/uiParity.test.ts`: covers the dedicated modal event/copy flow and confirms collapsed Groups cards do not render an expiration badge.

## Verification
- `npm test -- app/popup/uiParity.test.ts` — 69 passed.
- `npm run lint` — passed.
- `npm run type-check` — passed.
- `npm run build:chrome` — passed; the SavedDataModal was emitted as its own lazy chunk.

## Notes
No compatibility shim remains for the removed inline Saved Data viewer. The normal modal stack has one active modal, so the Session Actions dialog is cleanly replaced by Saved Data.
