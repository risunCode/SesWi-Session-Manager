# Two-Factor Edit Fix and Card Redesign

## Edit Bug
`TwoFactorEntryModal` watched `open` and `entry` without `{ immediate: true }`. When an Edit action first mounted the modal with a selected entry, the watcher did not run and fields stayed at manual-entry defaults. The watcher is now immediate, so the selected entry populates issuer, account name, secret, digits, period, and algorithm on first mount. Regression coverage exercises this contract.

## Layout
- Each card now uses a deterministic initial avatar based on `accountName`; a stable hash selects one of six colors, and the first account-name letter is the visible initial.
- Card identity contains account name and a large clickable OTP code; clicking only the code copies it.
- Actions are explicit compact buttons labeled **Edit** and **Delete**, not unlabeled mini icons.
- Issuer remains the group section heading, so it does not duplicate inside cards.

## Unified TOTP Status
The expiry copy and right-to-left progress bar moved below the 2FA search/add toolbar. The strip uses the nearest code rollover among visible entries, with `Automatically refreshes at Xs`; the bar begins full and shrinks toward the left. Individual cards no longer duplicate countdown UI.

## Verification
- `npm test -- app/popup/uiParity.test.ts` — 76 passed
- `npm run lint` — passed
- `npm run type-check` — passed
- `npm run build:chrome` — passed
- `npm run build:firefox` — passed
