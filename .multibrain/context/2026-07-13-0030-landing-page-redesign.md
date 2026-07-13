# Landing Page Redesign

## Goal
Replace the root GitHub Pages landing page with a full, light-first SesWi v3.5.0 product site.

## Changes
- Rebuilt root `index.html` as a standalone responsive landing page.
- Added an interactive Three.js hero vault loaded as a pinned browser module (`three@0.185.1`) with CSS fallback when WebGL/CDN import is unavailable.
- Added product capability bento cards, session/TOTP visual demos, browser shortcut walkthrough, encryption architecture, Chrome/Firefox install instructions, FAQ, and GitHub CTAs.
- Default theme is light even when OS prefers dark; user choice persists in `localStorage`.
- Added semantic skip link, ARIA labels, responsive mobile menu with Escape/focus return, native FAQ disclosures, visible focus treatment, reduced-motion behavior, and safe responsive layouts.

## Verified
- Local static server at `http://127.0.0.1:4173/`.
- Desktop: default light, no horizontal overflow, Three.js canvas present, hero and FAQ render.
- Mobile (390×844): no overflow; menu `aria-expanded` works; theme toggles dark/light; FAQ opens; Escape closes menu and restores focus.
- Local icon resource responds 200.
- Static audit found no `transition: all`, outline removal, paste blocking, zoom blocking, TODOs, or placeholders.

## Pages Asset Fix
- GitHub Pages does not expose the WXT-only `app/public/` path. Copied the 128px icon to root `icon.png` and updated both `index.html` and root `uninstall.html` to use it.
- Local static verification: root `icon.png` returns HTTP 200 and renders with natural width 128.

## Files
- `index.html`
- `uninstall.html`
- `icon.png`
