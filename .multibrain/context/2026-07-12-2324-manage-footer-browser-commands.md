# Manage, Footer, and Browser Commands

## Final decision

This note supersedes the earlier `manage-security-hierarchy` and `tips-shortcuts` placement notes.

### Manage

`app/popup/tabs/ManageTab.vue` has three icon-labelled sections:

1. **Sessions** — collapsible and open by default; contains Backup & Restore and Session Manager.
2. **Security** — always open and not collapsible; contains Master Password.
3. **Miscellaneous** — collapsible and open by default; contains Tips & Shortcuts, Check for Updates, and a visually bounded Danger Zone with Reset All Data.

`ManageSection.vue` accepts an optional Font Awesome `icon` prop for both static and collapsible headings.

### Footer

The footer left identity contains the SesWi cookie-bite icon, `SesWi v3.5.0 by risunCode`, and the new-version badge when an update exists. Open Project Page remains on the right.

### Browser commands

- `Alt+Q` maps to manifest command `open_seswi` and calls `browser.action.openPopup()`.
- `Alt+W` remains the double-press clear-window command that leaves one `about:blank` tab.
- Tips & Shortcuts labels both commands as browser-level and keeps `Ctrl+N`, double `Ctrl+X`, and `Ctrl+D` labelled as popup-level.

Both Chrome MV3 and Firefox MV2 generated manifests were inspected and contain `open_seswi` with `Alt+Q` and `close_all_tabs` with `Alt+W`.

## Files

- `wxt.config.ts`
- `app/background/index.ts`
- `app/popup/manage/ManageSection.vue`
- `app/popup/tabs/ManageTab.vue`
- `app/popup/layout/AppFooter.vue`
- `app/popup/modals/TipsShortcutsModal.vue`
- `app/popup/uiParity.test.ts`
- `README.md`
- `AGENTS.md`

## Verification

```txt
npx vitest run app/popup/uiParity.test.ts  64 tests passed
npm test                                  3 files / 68 tests passed
npm run lint                              passed
npm run type-check                        passed
npm run build:chrome                      passed
npm run build:firefox                     passed
```
