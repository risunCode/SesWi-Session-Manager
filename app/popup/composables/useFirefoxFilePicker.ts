import { browser } from 'wxt/browser';

export interface PendingFileData { name: string; content: string; }

const PENDING_KEY = 'seswi:pending-files';
const INTENT_KEY = 'seswi:intent';

export function useFirefoxFilePicker(accept: string, multiple: boolean, intent?: string) {
  const isFirefox = import.meta.env.BROWSER === 'firefox';

  async function openPicker(): Promise<void> {
    if (intent) await browser.storage.session.set({ [INTENT_KEY]: intent });
    await browser.runtime.sendMessage({ action: 'seswi:pick-files', accept, multiple });
  }

  async function consumePendingFiles(): Promise<File[]> {
    const raw = await browser.storage.session.get([PENDING_KEY, INTENT_KEY]);
    const items: PendingFileData[] = (raw?.[PENDING_KEY] as PendingFileData[]) ?? [];
    if (!items.length) return [];
    await browser.storage.session.remove(PENDING_KEY);
    return items.map((item) => new File([item.content], item.name, { type: 'application/json' }));
  }

  async function consumeIntent(): Promise<string | null> {
    const raw = await browser.storage.session.get(INTENT_KEY);
    const value = raw?.[INTENT_KEY] as string | undefined;
    if (value) await browser.storage.session.remove(INTENT_KEY);
    return value ?? null;
  }

  return { isFirefox, openPicker, consumePendingFiles, consumeIntent };
}
