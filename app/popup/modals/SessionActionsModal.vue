<template>
  <ModalBase
    :open="open"
    title="Session Actions"
    icon="fa-solid fa-gear text-slate-500"
    panel-class="sa-modal"
    @close="emit('close')"
  >
    <div class="modal-body">
      <template v-if="session">
        <div class="sa-header">
          <div class="sa-header-card">
            <div class="sa-header-row1">
              <img
                v-if="faviconUrl"
                class="sa-favicon"
                :src="faviconUrl"
                alt=""
                @error="faviconFailed = true"
              >
              <span
                v-else
                class="sa-favicon-fallback visible"
                aria-hidden="true"
              >
                <i class="fa-solid fa-globe" />
              </span>
              <span class="sa-header-domain">{{ session.domain }}</span>
              <button
                class="sa-visit-icon-btn"
                type="button"
                :title="targetUrl"
                aria-label="Open original session URL"
                @click="visitOriginal"
              >
                <i class="fa-solid fa-arrow-up-right-from-square" />
              </button>
            </div>
            <div class="sa-header-row2">
              <span class="sa-header-name">{{ session.name }}</span>
              <span class="sa-header-sep">·</span>
              <span class="sa-header-meta">#{{ session.index || 1 }} · {{ relativeSavedAt }}</span>
            </div>
          </div>
        </div>

        <div class="sa-info-card">
          <button
            class="sa-info-card-top"
            type="button"
            @click="emit('open-saved-data', session)"
          >
            <span class="sa-info-stat">
              <i
                class="fa-solid fa-cookie"
                style="color:#d97706;"
              />
              <span>{{ cookieCount }}</span><label>Cookies</label>
            </span>
            <span class="sa-info-sep" />
            <span class="sa-info-stat">
              <i
                class="fa-solid fa-database"
                style="color:#059669;"
              />
              <span>{{ localCount }}</span><label>Local</label>
            </span>
            <span class="sa-info-sep" />
            <span class="sa-info-stat">
              <i
                class="fa-solid fa-hard-drive"
                style="color:#2563eb;"
              />
              <span>{{ sessionCount }}</span><label>Session</label>
            </span>
            <span class="sa-info-sep" />
            <span class="sa-info-view"><i class="fa-solid fa-chevron-right" /></span>
          </button>

          <button
            class="sa-info-card-bottom sa-exp-bar"
            :class="[expiration.status, { expanded: authExpanded }]"
            type="button"
            @click="authExpanded = !authExpanded"
          >
            <i
              class="sa-exp-icon"
              :class="expiration.icon"
            />
            <span class="sa-exp-text"><span class="sa-exp-status">{{ expiration.label }}</span></span>
            <i class="fa-solid fa-chevron-down sa-exp-chevron" />
          </button>

          <div
            v-if="cookieCount > 0"
            class="exp-details"
            :class="{ show: authExpanded }"
          >
            <div class="exp-details-meta">
              <span><i
                class="fa-solid fa-circle-check"
                style="color:#10b981;"
              /> {{ expiringCookies.length }} expiring</span>
              <span><i
                class="fa-solid fa-clock"
                style="color:#6366f1;"
              /> {{ sessionOnlyCount }} session-only</span>
            </div>
            <div class="exp-pills-list">
              <div
                v-for="cookie in expiringCookies.slice(0, 4)"
                :key="cookie.name + cookie.domain + cookie.path"
                class="exp-pill"
                :class="Time.getCookieExpiration(cookie).status"
              >
                <div class="exp-pill-left">
                  <span class="exp-pill-dot" />
                  <span class="exp-pill-name">{{ Format.short(cookie.name, 18) }}</span>
                </div>
                <div class="exp-pill-right">
                  <span class="exp-pill-date">{{ Time.getCookieExpiration(cookie).exact }}</span>
                  <span class="exp-pill-days">{{ Time.getCookieExpiration(cookie).relative }}</span>
                </div>
              </div>
            </div>
            <div
              v-if="expiringCookies.length > 4"
              class="exp-pills-more"
            >
              +{{ expiringCookies.length - 4 }} more cookies
            </div>
          </div>
        </div>

        <div
          v-if="editing"
          class="sa-inline-edit"
        >
          <input
            v-model.trim="draftName"
            type="text"
            placeholder="Session name"
            maxlength="50"
            @keydown.enter="saveName"
          >
          <button
            class="sa-btn sa-btn-primary"
            :class="{ 'sa-btn-success': actionFeedback.isSuccess('save-name') }"
            type="button"
            :disabled="busy || actionFeedback.isSuccess('save-name')"
            @click="saveName"
          >
            <i class="fa-solid fa-check" />
            <span>{{ actionFeedback.label('save-name', 'Save', busy, 'Saving...', 'Saved!') }}</span>
          </button>
        </div>

        <div
          v-if="message"
          class="sw-modal-message"
          :class="messageType"
        >
          {{ message }}
        </div>

        <div class="sa-split-btn">
          <button
            class="sa-btn sa-btn-primary sa-split-main"
            type="button"
            :disabled="busy"
            @click="restoreSession(false)"
          >
            <i class="fa-solid fa-rotate-left" />
            <span>Restore Session</span>
          </button>
          <button
            class="sa-btn sa-btn-primary sa-split-toggle"
            type="button"
            aria-label="More restore options"
            :aria-expanded="restoreDropdownOpen"
            :disabled="busy"
            @click.stop="restoreDropdownOpen = !restoreDropdownOpen"
          >
            <i class="fa-solid fa-chevron-down" />
          </button>
          <div
            class="sa-split-dropdown"
            :class="{ show: restoreDropdownOpen }"
          >
            <button
              type="button"
              @click="restoreAndGo"
            >
              <i class="fa-solid fa-arrow-up-right-from-square" />
              <span>Restore &amp; Go to Original</span>
            </button>
          </div>
        </div>

        <div class="sa-row">
          <button
            class="sa-btn sa-btn-secondary"
            type="button"
            :disabled="busy"
            @click="toggleEdit"
          >
            <i class="fa-solid fa-pen" />
            <span>Edit</span>
          </button>
          <button
            class="sa-btn sa-btn-secondary"
            type="button"
            :disabled="busy"
            @click="replaceConfirmOpen = true"
          >
            <i class="fa-solid fa-arrows-rotate" />
            <span>Replace</span>
          </button>
        </div>

        <div class="sa-row">
          <button
            class="sa-btn sa-btn-export"
            type="button"
            :disabled="busy"
            @click="exportJSON"
          >
            <i class="fa-solid fa-file-code" />
            <span>Export JSON</span>
          </button>
          <button
            class="sa-btn sa-btn-export"
            type="button"
            :disabled="busy"
            @click="requestOwiExport"
          >
            <i class="fa-solid fa-lock" />
            <span>Export OWI</span>
          </button>
        </div>

        <button
          class="sa-btn sa-btn-danger-outline sa-btn-full"
          type="button"
          :disabled="busy"
          @click="emit('confirm-delete', session)"
        >
          <i class="fa-solid fa-trash" />
          <span>Delete Session</span>
        </button>
      </template>

      <div
        v-else
        class="modal-message error"
      >
        Pick a session first.
      </div>
    </div>
  </ModalBase>
  <OwiPasswordModal
    :open="owiPasswordOpen"
    @close="owiPasswordOpen = false"
    @submit="exportOWI"
  />
  <ConfirmModal
    :open="replaceConfirmOpen"
    title="Replace Saved Session"
    message="Replace this saved session with the current tab data? This overwrites the saved session."
    confirm-text="Replace"
    @close="replaceConfirmOpen = false"
    @confirm="replaceSession"
  />
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { browser } from 'wxt/browser';
import { Backup } from '@features/backup/backup';
import { Crypto } from '@features/security/crypto';
import { Cookies } from '@features/sessions/cookies';
import { CurrentTabSnapshot } from '@features/sessions/currentTabSnapshot';
import { BrowserStorage, SessionStorage, TabInfo, uniqueTimestamp } from '@features/sessions/sessionStorage';
import type { Session } from '@features/sessions/session.types';
import { tabIcons } from '@platform/icons/tabIcons';
import { Domain } from '@shared/domain';
import { DOM } from '@shared/dom';
import { Format } from '@shared/format';
import { Normalize } from '@shared/normalize';
import { Time, type ExpirationInfo } from '@shared/time';
import { useActionFeedback } from '../composables/useActionFeedback';
import { useModalMessage } from '../composables/useModalMessage';
import ConfirmModal from './ConfirmModal.vue';
import ModalBase from './ModalBase.vue';
import OwiPasswordModal from './OwiPasswordModal.vue';

const NAVIGATION_TIMEOUT_MS = 5_000;

const props = defineProps<{ open: boolean; session: Session | null }>();
const emit = defineEmits<{ close: []; changed: [message?: string]; 'session-updated': [session: Session]; toast: [message: string]; 'confirm-delete': [session: Session]; 'open-saved-data': [session: Session] }>();

const busy = ref(false);
const editing = ref(false);
const owiPasswordOpen = ref(false);
const replaceConfirmOpen = ref(false);
const draftName = ref('');
const { message, messageType, setMessage, clearMessage } = useModalMessage();
const actionFeedback = useActionFeedback();
const authExpanded = ref(false);
const restoreDropdownOpen = ref(false);
const faviconFailed = ref(false);


const cookies = computed(() => props.session?.cookies ?? []);
const cookieCount = computed(() => cookies.value.length);
const localCount = computed(() => Object.keys(props.session?.localStorage ?? {}).length);
const sessionCount = computed(() => Object.keys(props.session?.sessionStorage ?? {}).length);
const targetUrl = computed(() => props.session?.originalUrl || (props.session ? `https://${props.session.domain}` : ''));
const faviconUrl = computed(() => {
  if (!props.session || faviconFailed.value) return '';
  return props.session.favicon || tabIcons.getFaviconUrl(props.session.domain) || '';
});
const relativeSavedAt = computed(() => props.session ? Time.formatRelative(props.session.timestamp) : '');
const expiringCookies = computed(() => cookies.value
  .filter(cookie => !cookie.session && typeof cookie.expirationDate === 'number')
  .sort((left, right) => (left.expirationDate ?? 0) - (right.expirationDate ?? 0)));
const sessionOnlyCount = computed(() => cookies.value.filter(cookie => cookie.session || !cookie.expirationDate).length);
const expiration = computed<ExpirationInfo>(() => Time.getSessionExpiration(cookies.value) ?? { status: 'none', icon: 'fa-solid fa-circle-question', label: 'No cookies', days: null, exact: 'No cookies', relative: '', title: 'No cookies saved' });

watch(() => props.open, (open) => {
  if (!open) resetTransientState();
});

watch(() => props.session, (session) => {
  draftName.value = session?.name ?? '';
  resetTransientState();
});

function resetTransientState(): void {
  busy.value = false;
  editing.value = false;
  clearMessage();
  authExpanded.value = false;
  restoreDropdownOpen.value = false;
  faviconFailed.value = false;

}

function toggleEdit(): void {
  editing.value = !editing.value;
  if (props.session) draftName.value = props.session.name;
  clearMessage();
}

async function visitOriginal(): Promise<void> {
  if (!props.session) return;
  if (!Domain.isSafeUrl(targetUrl.value)) {
    setMessage('Invalid URL', 'error');
    return;
  }
  if (browser.tabs?.create) await browser.tabs.create({ url: targetUrl.value });
  else window.open(targetUrl.value, '_blank');
}

async function waitForTabComplete(tabId: number): Promise<void> {
  await new Promise<void>((resolve) => {
    const onUpdated = browser.tabs?.onUpdated;
    if (!onUpdated?.addListener || !onUpdated?.removeListener) {
      window.setTimeout(resolve, 500);
      return;
    }
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      onUpdated.removeListener(listener);
      resolve();
    };
    const listener = (updatedTabId: number, info: { status?: string }) => {
      if (updatedTabId === tabId && info.status === 'complete') finish();
    };
    onUpdated.addListener(listener);
    window.setTimeout(finish, NAVIGATION_TIMEOUT_MS);
  });
}

async function restoreSession(goToOriginal: boolean): Promise<void> {
  if (!props.session || busy.value) return;
  const hasCookies = cookieCount.value > 0;
  const hasLocal = localCount.value > 0;
  const hasSession = sessionCount.value > 0;
  if (!hasCookies && !hasLocal && !hasSession) {
    setMessage('Nothing to restore', 'error');
    return;
  }
  busy.value = true;
  clearMessage();
  try {
    const tab = await TabInfo.getCurrent();
    if (!tab.success) {
      setMessage(tab.error, 'error');
      return;
    }
    if (!Domain.isSafeUrl(targetUrl.value)) {
      setMessage('Invalid URL', 'error');
      return;
    }
    if (goToOriginal) {
      setMessage('Navigating...');
      await browser.tabs.update(tab.data.tabId, { url: targetUrl.value });
      await waitForTabComplete(tab.data.tabId);
    } else if (!Domain.isMatch(props.session.domain, tab.data.domain)) {
      setMessage(`Open ${props.session.domain} first`, 'error');
      return;
    }

    setMessage('Restoring...');
    if (hasCookies) {
      const cookiesResult = await Cookies.restore(props.session, tab.data.tabId);
      if (!cookiesResult.success) {
        setMessage(cookiesResult.error, 'error');
        return;
      }
      await browser.tabs.reload(tab.data.tabId);
      await waitForTabComplete(tab.data.tabId);
    }
    if (hasLocal || hasSession) {
      const storage = await BrowserStorage.restore(tab.data.tabId, props.session.localStorage ?? {}, props.session.sessionStorage ?? {});
      if (!storage.success) {
        setMessage(storage.error, 'error');
        return;
      }
      await browser.tabs.reload(tab.data.tabId);
      await waitForTabComplete(tab.data.tabId);
    }
    const refreshedSession: Session = { ...props.session, lastRestoredAt: Date.now() };
    const updated = await SessionStorage.update(refreshedSession);
    if (!updated.success) {
      setMessage(updated.error, 'error');
      return;
    }
    emit('session-updated', refreshedSession);
    setMessage('Restored!', 'success');
    emit('changed', 'Session restored');
  } catch (error) {
    setMessage(error instanceof Error ? error.message : String(error), 'error');
  } finally {
    busy.value = false;
  }
}

async function restoreAndGo(): Promise<void> {
  restoreDropdownOpen.value = false;
  await restoreSession(true);
}

async function replaceSession(): Promise<void> {
  replaceConfirmOpen.value = false;
  if (!props.session || busy.value) return;
  busy.value = true;
  clearMessage();
  try {
    const tab = await TabInfo.getCurrent();
    if (!tab.success) {
      setMessage(tab.error, 'error');
      return;
    }
    if (!Domain.isMatch(props.session.domain, tab.data.domain)) {
      setMessage(`Open ${props.session.domain} first`, 'error');
      return;
    }
    const collected = await CurrentTabSnapshot.collect({ force: true });
    if (!collected.success) {
      setMessage(collected.error, 'error');
      return;
    }
    const updated: Session = {
      ...props.session,
      originalUrl: collected.data.url,
      timestamp: uniqueTimestamp(),
      cookies: Normalize.cookies(collected.data.cookies, props.session.domain),
      localStorage: collected.data.localStorage,
      sessionStorage: collected.data.sessionStorage,
    };
    const result = await SessionStorage.update(updated);
    if (!result.success) {
      setMessage(result.error, 'error');
      return;
    }
    setMessage('Replaced!', 'success');
    emit('session-updated', updated);
    emit('changed', 'Session replaced');
  } catch (error) {
    setMessage(error instanceof Error ? error.message : String(error), 'error');
  } finally {
    busy.value = false;
  }
}

function exportJSON(): void {
  if (!props.session) return;
  DOM.downloadFile(JSON.stringify([props.session], null, 2), `${Format.fileName(props.session.domain)}-${Format.fileName(props.session.name)}.json`, 'application/json');
  setMessage('JSON exported!', 'success');
}

function requestOwiExport(): void {
  if (!props.session || busy.value) return;
  owiPasswordOpen.value = true;
}

async function exportOWI(password: string): Promise<void> {
  if (!props.session || busy.value) return;
  owiPasswordOpen.value = false;
  busy.value = true;
  clearMessage();
  const payload = Backup.normalizePayload({ sessions: [props.session], twoFactorEntries: [] });
  const result = await Crypto.exportOWI(payload, password, `${Format.fileName(props.session.domain)}-${Format.fileName(props.session.name)}`);
  busy.value = false;
  if (!result.success) {
    setMessage(result.error, 'error');
    return;
  }
  setMessage('OWI exported!', 'success');
}

async function saveName(): Promise<void> {
  if (!props.session || busy.value) return;
  if (!draftName.value) {
    setMessage('Session name is required.', 'error');
    return;
  }
  busy.value = true;
  const result = await SessionStorage.update({ ...props.session, name: draftName.value });
  busy.value = false;
  if (!result.success) {
    setMessage(result.error, 'error');
    return;
  }
  setMessage('Updated!', 'success');
  await actionFeedback.finish('save-name', 'Saved!', () => emit('changed', 'Session updated'));
}


</script>

<style scoped>
.sa-modal {
  width: 340px;
  max-width: 92vw;
  max-height: calc(100vh - 32px);
}

.modal-body {
  display: flex;
  max-height: calc(100vh - 92px);
  flex-direction: column;
  gap: 8px;
  overflow-y: auto;
  padding: 10px;
}

.sa-header-card {
  padding: 9px 10px;
  border: 1px solid var(--clr-border);
  border-radius: 8px;
  background: var(--clr-surface);
}

.sa-header-row1 {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
}

.sa-favicon,
.sa-favicon-fallback {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  border-radius: 3px;
}

.sa-favicon-fallback {
  display: none;
  align-items: center;
  justify-content: center;
  color: var(--clr-text-light);
  font-size: var(--fs-sm);
}

.sa-favicon-fallback.visible { display: flex; }

.sa-header-domain {
  flex: 1;
  overflow: hidden;
  color: #0f172a;
  font-size: var(--fs-md);
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sa-visit-icon-btn {
  display: flex;
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  border-radius: 5px;
  background: transparent;
  color: #cbd5e1;
  cursor: pointer;
  font-size: var(--fs-sm);
  transition: all 0.15s;
}

.sa-visit-icon-btn:hover {
  background: #eff6ff;
  color: var(--clr-primary-hover);
}

.sa-header-row2 {
  display: flex;
  align-items: center;
  gap: 5px;
  overflow: hidden;
  padding-left: 23px;
}

.sa-header-name {
  min-width: 0;
  overflow: hidden;
  color: #334155;
  font-size: var(--fs-sm);
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sa-header-sep {
  flex-shrink: 0;
  color: #cbd5e1;
  font-size: var(--fs-xs);
}

.sa-header-meta {
  flex-shrink: 0;
  color: var(--clr-text-light);
  font-size: var(--fs-xs);
  white-space: nowrap;
}

.sa-info-card {
  overflow: hidden;
  border: 1px solid var(--clr-border);
  border-radius: 8px;
}

.sa-info-card-top {
  display: flex;
  width: 100%;
  align-items: center;
  padding: 0;
  border: none;
  background: var(--clr-background);
  cursor: pointer;
  transition: background 0.15s;
}

.sa-info-card-top:hover { background: var(--clr-background-alt); }

.sa-info-stat {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 7px 4px;
  color: var(--clr-text);
  font-size: var(--fs-sm);
  font-weight: 600;
}

.sa-info-stat label {
  color: var(--clr-text-light);
  font-size: var(--fs-xs);
  font-weight: 400;
}

.sa-info-sep {
  width: 1px;
  height: 24px;
  flex-shrink: 0;
  background: var(--clr-border);
}

.sa-info-view {
  display: flex;
  align-items: center;
  padding: 0 8px;
  color: #cbd5e1;
  font-size: var(--fs-xs);
}

.sa-exp-bar {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 6px;
  padding: 5px 8px;
  border: none;
  border-top: 1px solid var(--clr-border);
  background: var(--clr-background);
  cursor: pointer;
  font-size: var(--fs-xs);
  transition: all 0.15s;
}

.sa-exp-bar.valid { background: #f0fdf4; }
.sa-exp-bar.warning { background: #fffbeb; }
.sa-exp-bar.critical,
.sa-exp-bar.expired { background: #fef2f2; }
.sa-exp-bar.notice { background: #f0f9ff; }
.sa-exp-bar.session,
.sa-exp-bar.neutral,
.sa-exp-bar.none { background: var(--clr-background); }
.sa-exp-bar.expanded { border-radius: 0; }

.sa-exp-icon { flex-shrink: 0; font-size: var(--fs-xs); }
.sa-exp-text { flex: 1; color: var(--clr-text-secondary); text-align: left; }
.sa-exp-status { color: var(--clr-text); font-weight: 600; }
.sa-exp-chevron { color: var(--clr-text-light); font-size: var(--fs-xs); transition: transform 0.2s; }
.sa-exp-bar.expanded .sa-exp-chevron { transform: rotate(180deg); }

.exp-details {
  display: none;
  padding: 8px 10px;
  border-top: 1px solid var(--clr-border);
  background: white;
}

.exp-details.show { display: block; }

.exp-details-meta {
  display: flex;
  gap: 12px;
  margin-bottom: 8px;
  color: var(--clr-text-muted);
  font-size: var(--fs-xs);
  font-weight: 600;
  letter-spacing: 0.4px;
  text-transform: uppercase;
}

.exp-details-meta span {
  display: flex;
  align-items: center;
  gap: 4px;
}

.exp-pills-list {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.exp-pill {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 5px 8px;
  border: 1px solid var(--clr-border);
  border-radius: 5px;
  background: var(--clr-background);
}

.exp-pill.valid { border-color: #bbf7d0; background: #f0fdf4; }
.exp-pill.warning { border-color: #fde68a; background: #fffbeb; }
.exp-pill.notice { border-color: #bae6fd; background: #f0f9ff; }
.exp-pill.expired { border-color: #fecaca; background: #fef2f2; }

.exp-pill-left,
.exp-pill-right {
  display: flex;
  align-items: center;
  gap: 6px;
}

.exp-pill-left { min-width: 0; }
.exp-pill-right { flex-shrink: 0; }

.exp-pill-dot {
  width: 6px;
  height: 6px;
  flex-shrink: 0;
  border-radius: 50%;
  background: #cbd5e1;
}

.exp-pill.valid .exp-pill-dot { background: var(--clr-success); }
.exp-pill.warning .exp-pill-dot { background: #f59e0b; }
.exp-pill.notice .exp-pill-dot { background: #0284c7; }
.exp-pill.expired .exp-pill-dot { background: var(--clr-danger); }

.exp-pill-name {
  overflow: hidden;
  color: var(--clr-text);
  font-size: var(--fs-xs);
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.exp-pill-date {
  color: var(--clr-text-muted);
  font-size: var(--fs-xs);
}

.exp-pill-days {
  padding: 1px 5px;
  border-radius: 4px;
  background: var(--clr-border);
  color: var(--clr-text-secondary);
  font-size: var(--fs-xs);
  font-weight: 700;
}

.exp-pill.valid .exp-pill-days { background: #dcfce7; color: #15803d; }
.exp-pill.warning .exp-pill-days { background: #fef9c3; color: #a16207; }
.exp-pill.notice .exp-pill-days { background: #e0f2fe; color: #0369a1; }
.exp-pill.expired .exp-pill-days { background: #fee2e2; color: #b91c1c; }

.exp-pills-more {
  margin-top: 5px;
  color: var(--clr-text-light);
  font-size: var(--fs-xs);
  font-style: italic;
  text-align: center;
}

.sa-inline-edit {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 6px;
}

.sa-inline-edit input {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--clr-border);
  border-radius: 6px;
  font-size: var(--fs-sm);
}

.sa-row {
  display: flex;
  gap: 5px;
}

.sa-btn {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 7px 10px;
  border: 1px solid;
  border-radius: 6px;
  cursor: pointer;
  font-size: var(--fs-sm);
  font-weight: 600;
  transition: all 0.15s;
}

.sa-btn:disabled {
  cursor: not-allowed;
  opacity: 0.65;
}

.sa-btn i { flex-shrink: 0; font-size: var(--fs-sm); }
.sa-btn span { flex-shrink: 0; }
.sa-btn-full { width: 100%; flex: none; }

.sa-btn-primary {
  padding: 9px 10px;
  border-color: #0d9488;
  background: linear-gradient(135deg, var(--clr-success), #14b8a6);
  color: white;
}

.sa-btn-primary:hover:not(:disabled) {
  background: linear-gradient(135deg, #059669, #0d9488);
  box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
}

.sa-btn-success {
  background: var(--clr-success) !important;
  border-color: #059669 !important;
  color: white !important;
}

.sa-btn-secondary,
.sa-btn-export {
  border-color: var(--clr-border);
  background: white;
  color: var(--clr-text-secondary);
}

.sa-btn-secondary:hover:not(:disabled) {
  border-color: #cbd5e1;
  background: var(--clr-background);
}

.sa-btn-export:hover:not(:disabled) {
  border-color: var(--clr-text-light);
  background: var(--clr-background);
}

.sa-btn-danger-outline {
  border-color: var(--clr-border);
  border-style: solid;
  background: transparent;
  color: var(--clr-text-light);
}

.sa-btn-danger-outline:hover:not(:disabled) {
  border-color: #fca5a5;
  background: #fef2f2;
  color: var(--clr-danger-hover);
}

.sa-split-btn {
  position: relative;
  display: flex;
  width: 100%;
}

.sa-split-main {
  flex: 1;
  border-right: none;
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
}

.sa-split-toggle {
  width: 36px;
  flex: none;
  padding: 9px 0;
  border-left: 1px solid rgba(255, 255, 255, 0.25);
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
}

.sa-split-toggle i {
  font-size: 10px;
  transition: transform 0.15s;
}

.sa-split-dropdown {
  position: absolute;
  z-index: 10;
  top: 100%;
  right: 0;
  left: 0;
  margin-top: 4px;
  border: 1px solid var(--clr-border);
  border-radius: 6px;
  background: white;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  opacity: 0;
  transform: translateY(-4px);
  transition: all 0.15s ease;
  visibility: hidden;
}

.sa-split-dropdown.show {
  opacity: 1;
  transform: translateY(0);
  visibility: visible;
}

.sa-split-dropdown button {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border: none;
  background: transparent;
  color: var(--clr-text-secondary);
  cursor: pointer;
  font-size: var(--fs-sm);
  font-weight: 500;
  transition: all 0.12s;
}

.sa-split-dropdown button:hover {
  background: #f0fdf4;
  color: #059669;
}

.sa-split-dropdown button i {
  color: var(--clr-success);
  font-size: var(--fs-sm);
}


</style>
