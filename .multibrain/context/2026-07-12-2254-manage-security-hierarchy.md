# Manage Security & Extension Hierarchy

## Goal

Make the Security & Extension area easier to scan and prevent the destructive reset action from reading like a normal extension utility.

## Decision

`app/popup/tabs/ManageTab.vue` now groups its collapsed Security & Extension content into:

1. **Protection** — Master Password.
2. **Extension** — Check for Updates only. Userscript Bridge is a README-only workaround; Project Page lives in the footer.
3. **Danger Zone** — Reset All Data, with a red-tinted visual boundary and irreversible-action copy.

The section remains collapsed by default. The footer owns the repository link with `SesWi v3.5.0 by risunCode` on the left and `Open Project Page` on the right.

## Verification

```txt
npm test              3 files / 66 tests passed
npm run lint          passed
npm run type-check    passed
npm run build:chrome  passed
npm run build:firefox passed
```

## Files

- `app/popup/tabs/ManageTab.vue`
- `app/popup/uiParity.test.ts`
