import { browser } from 'wxt/browser';
import { defineContentScript } from 'wxt/utils/define-content-script';
import {
  USERSCRIPT_BRIDGE_ACTIONS,
  USERSCRIPT_BRIDGE_EXTENSION_SOURCE,
  USERSCRIPT_BRIDGE_PAGE_SOURCE,
  isUserscriptBridgePageRequest,
  isUserscriptBridgeRuntimeMessage,
  type UserscriptBridgeRuntimeResultMessage,
} from '@shared/userscriptBridge';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_start',
  main(ctx) {
    function postResult(message: UserscriptBridgeRuntimeResultMessage): void {
      window.postMessage({ source: USERSCRIPT_BRIDGE_EXTENSION_SOURCE, ...message }, '*');
    }

    async function handlePageMessage(event: MessageEvent<unknown>): Promise<void> {
      if (event.source !== window || !isUserscriptBridgePageRequest(event.data)) return;
      try {
        const response = await browser.runtime.sendMessage({
          action: USERSCRIPT_BRIDGE_ACTIONS.request,
          requestId: event.data.requestId,
          kind: event.data.kind,
        });
        if (isUserscriptBridgeRuntimeMessage(response) && response.action === USERSCRIPT_BRIDGE_ACTIONS.result) {
          postResult(response);
          return;
        }
        postResult({
          action: USERSCRIPT_BRIDGE_ACTIONS.result,
          requestId: event.data.requestId,
          status: 'complete',
          success: false,
          message: 'Unexpected response from SesWi.',
        });
      } catch (error) {
        postResult({
          action: USERSCRIPT_BRIDGE_ACTIONS.result,
          requestId: event.data.requestId,
          status: 'complete',
          success: false,
          message: error instanceof Error ? error.message : 'SesWi bridge unavailable.',
        });
      }
    }

    function handleRuntimeMessage(message: unknown): void {
      if (!isUserscriptBridgeRuntimeMessage(message) || message.action !== USERSCRIPT_BRIDGE_ACTIONS.result) return;
      postResult(message);
    }

    ctx.addEventListener(window, 'message', (event) => {
      void handlePageMessage(event);
    });
    browser.runtime.onMessage.addListener(handleRuntimeMessage);
    ctx.onInvalidated(() => {
      browser.runtime.onMessage.removeListener(handleRuntimeMessage);
    });

    window.postMessage({
      source: USERSCRIPT_BRIDGE_EXTENSION_SOURCE,
      action: 'ready',
      bridge: USERSCRIPT_BRIDGE_PAGE_SOURCE,
    }, '*');
  },
});
