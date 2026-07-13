// ==UserScript==
// @name         SesWi Bridge Helper
// @namespace    https://github.com/risunCode/SesWi-Session-Manager
// @version      1.0.0
// @description  Request confirmed SesWi save, restore, and clean actions.
// @match        *://*/*
// @grant        GM_registerMenuCommand
// ==/UserScript==

(() => {
  const PAGE_SOURCE = 'seswi-userscript-bridge';
  const EXTENSION_SOURCE = 'seswi-extension-bridge';
  const REQUEST_TIMEOUT_MS = 30_000;

  function createRequestId(kind) {
    return `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function requestSesWi(kind) {
    const requestId = createRequestId(kind);
    return new Promise((resolve, reject) => {
      function cleanup() {
        window.clearTimeout(timeoutId);
        window.removeEventListener('message', handleMessage);
      }

      function handleMessage(event) {
        const data = event.data;
        if (!data || data.source !== EXTENSION_SOURCE || data.action !== 'userscriptBridge:result' || data.requestId !== requestId) return;
        if (data.status === 'pending') return;
        cleanup();
        if (data.success) resolve(data);
        else reject(new Error(data.message || 'SesWi request failed.'));
      }

      const timeoutId = window.setTimeout(() => {
        cleanup();
        reject(new Error('SesWi did not respond in time. Open the extension popup and try again.'));
      }, REQUEST_TIMEOUT_MS);

      window.addEventListener('message', handleMessage);
      window.postMessage({ source: PAGE_SOURCE, action: 'request', requestId, kind }, '*');
    });
  }

  const bridge = {
    saveCurrentDomain: () => requestSesWi('save-current-domain'),
    restoreLatestSession: () => requestSesWi('restore-latest-session'),
    cleanCurrentTab: () => requestSesWi('clean-current-tab'),
  };

  window.SesWiBridge = bridge;

  const registerMenuCommand = globalThis.GM_registerMenuCommand;
  if (typeof registerMenuCommand === 'function') {
    registerMenuCommand('SesWi: Save Current Domain', () => { void bridge.saveCurrentDomain(); });
    registerMenuCommand('SesWi: Restore Latest Session', () => { void bridge.restoreLatestSession(); });
    registerMenuCommand('SesWi: Clean Current Tab', () => { void bridge.cleanCurrentTab(); });
  }

  console.info('[SesWi Bridge] Ready. Use window.SesWiBridge or the userscript menu commands.');
})();
