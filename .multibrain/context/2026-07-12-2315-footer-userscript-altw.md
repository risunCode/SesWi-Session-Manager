# Footer, Userscript Workaround, and Alt+W Correction

## Decisions

- Manage no longer shows Userscript Bridge or Project Page cards.
- Userscript Bridge remains functional as a README-documented workaround using `app/public/userscripts/seswi-bridge-helper.user.js`; its popup helper modal and generator were removed.
- The footer shows `SesWi v3.5.0 by risunCode` on the left and a GitHub `Open Project Page` action on the right. The conditional update badge remains.
- `Alt+W` no longer removes every tab and closes the window. It creates one active `about:blank` tab first, then removes all old tabs in the current window.

## Files

- `app/background/index.ts`
- `app/popup/App.vue`
- `app/popup/layout/AppFooter.vue`
- `app/popup/tabs/ManageTab.vue`
- `app/public/userscripts/seswi-bridge-helper.user.js`
- `README.md`
- `AGENTS.md`
