# Root Uninstall Page Fix

## Goal
Make the extension uninstall URL `https://risuncode.github.io/SesWi-Session-Manager/uninstall.html` publishable from GitHub Pages root and link it from the redesigned landing page.

## Changes
- Created root `uninstall.html`, which is the exact GitHub Pages path expected by `browser.runtime.setUninstallURL`.
- Added a light-first, responsive SesWi uninstall feedback experience aligned with root `index.html`.
- Added accessible reason-selector buttons; selection updates the GitHub Issues URL with prefilled title/body but performs no tracking.
- Added navigation between root landing page and uninstall page.
- Added `Uninstall Feedback` to root landing footer.
- Preserved the local untracked `site/uninstall.html` rather than deleting user-owned work; it is not the published root target.

## Verification
- Local root path `/uninstall.html` loads successfully on static server.
- Desktop: light-first, icon loads, no horizontal overflow, theme works, feedback state and generated GitHub Issues URL work.
- Mobile 390×844: no horizontal overflow, 4 reasons render, root home navigation exists.
- GitHub Pages workflow `pages build and deployment` completed successfully for commit `855d999`.
- Fresh public request with `?v=855d999` resolves the root uninstall page and reports title `Thanks for Trying SesWi`; normal no-query request may briefly retain prior CDN 404 cache.

## Files
- `uninstall.html`
- `index.html`
