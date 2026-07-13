# Tips & Shortcuts

## Decision

Manage → Security & Extension → Extension now includes a **Tips & Shortcuts** card. It opens `TipsShortcutsModal.vue` using the primary `ModalBase` shell.

The modal documents:

- `Ctrl+N` — Add Session; popup must be open.
- Double `Ctrl+X` — first press opens cleanup, second within two seconds fast-cleans; popup must be open.
- `Ctrl+D` — fast lock when Master Password is enabled; popup must be open.
- `Alt+W` — browser command; first press prompts, second within two seconds clears old tabs while leaving one `about:blank` tab.
- Popup menu map: Current, Groups, 2FA, and Manage.

The modal labels shortcut scope as **Popup** or **Browser** to avoid implying that all commands work globally.

## Files

- `app/popup/modals/TipsShortcutsModal.vue`
- `app/popup/tabs/ManageTab.vue`
- `app/popup/composables/useModalStack.ts`
- `app/popup/App.vue`
- `app/popup/uiParity.test.ts`

## Verification

```txt
npm test              3 files / 68 tests passed
npm run lint          passed
npm run type-check    passed
npm run build:chrome  passed
npm run build:firefox passed
```
