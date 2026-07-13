import { browser } from 'wxt/browser';
import { Response, type Response as Result } from '@shared/response';

export interface UpdateStatus {
  hasUpdate: boolean;
  latestVersion: string;
  releaseUrl: string;
  currentVersion: string;
}

const CACHE_KEY = '_seswi_update_status';
const CACHE_TTL = 60 * 60 * 1000;

function compareVersions(a: string, b: string): number {
  const left = a.replace(/^v/, '').split('.').map(Number);
  const right = b.replace(/^v/, '').split('.').map(Number);
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const delta = (left[index] ?? 0) - (right[index] ?? 0);
    if (delta !== 0) return delta;
  }
  return 0;
}

export async function fetchUpdateStatus(force = false): Promise<Result<UpdateStatus | null>> {
  try {
    const manifest = browser.runtime.getManifest();
    const currentVersion = manifest.version;
    if (!force) {
      const cached = await browser.storage.local.get(CACHE_KEY);
      const value = cached[CACHE_KEY];
      if (value && typeof value === 'object' && 'createdAt' in value && typeof value.createdAt === 'number' && Date.now() - value.createdAt < CACHE_TTL && 'data' in value) {
        return Response.success(value.data as UpdateStatus);
      }
    }
    const response = await fetch('https://api.github.com/repos/risunCode/SesWi-Session-Manager/releases/latest', { cache: 'no-store' });
    if (!response.ok) return Response.error(`GitHub API failed: ${response.status}`);
    const release = await response.json() as { tag_name?: string; html_url?: string };
    const latestVersion = release.tag_name?.replace(/^v/, '') ?? currentVersion;
    const data: UpdateStatus = { hasUpdate: compareVersions(latestVersion, currentVersion) > 0, latestVersion, releaseUrl: release.html_url ?? '', currentVersion };
    await browser.storage.local.set({ [CACHE_KEY]: { createdAt: Date.now(), data } });
    return Response.success(data);
  } catch (error) {
    return Response.error(error instanceof Error ? error : String(error), 'fetchUpdateStatus');
  }
}

export async function checkForUpdate(force = false): Promise<UpdateStatus | null> {
  const response = await browser.runtime.sendMessage({ action: 'checkForUpdate', force });
  return response && typeof response === 'object' ? response as UpdateStatus : null;
}
