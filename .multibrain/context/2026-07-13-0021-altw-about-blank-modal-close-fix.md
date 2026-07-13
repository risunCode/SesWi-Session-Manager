# Alt+W about:blank and Modal Close Fix

## Date
2026-07-13 00:21 UTC

## Problem
- Alt+W was closing the browser window instead of keeping one blank tab
- Confirm modal remained open after clear operation completed
- Alt+Q was not reliably opening SesWi popup
- Cross-world preload warnings in popup.html

## Solution
- Changed survivor from extension `/blank.html` to native browser `about:blank`
- Modal auto-closes after clear completes (both via second press and button click)
- Alt+Q handler now logs errors properly
- Disabled modulePreload in WXT config to fix preload warnings
- Added runtime command check on startup to warn if Alt+W shortcut is not assigned

## Implementation Details
- `app/background/clearWindowTabs.ts`: navigate existing active tab to about:blank, then remove other tabs
- `app/background/index.ts`: confirm action returns success response, shortcut handler sends confirm message to popup
- `app/popup/App.vue`: onConfirm waits for success response before closeModal, runtime handler closes modal on confirm action
- `wxt.config.ts`: added `modulePreload: false` to build config

## Behavior
- Alt+W first press: opens SesWi popup and shows confirm modal
- Alt+W second press (within 2 seconds) or click "Clear Window": navigates active tab to about:blank, closes other tabs, modal auto-closes
- Browser window stays open with one blank tab
