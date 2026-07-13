<template>
  <ModalBase
    :open="open"
    title="Clean Current Tab"
    icon="fa-solid fa-broom"
    @close="emit('close')"
  >
    <template #after-header>
      <div
        class="ct-mode-tabs"
        role="tablist"
        aria-label="Cleanup category"
      >
        <button
          class="ct-mode-tab"
          :class="{ active: activeTab === 'data' }"
          type="button"
          role="tab"
          :aria-selected="activeTab === 'data'"
          @click="switchTab('data')"
        >
          <i class="fa-solid fa-database" aria-hidden="true" />
          Site Data
        </button>
        <button
          class="ct-mode-tab"
          :class="{ active: activeTab === 'window' }"
          type="button"
          role="tab"
          :aria-selected="activeTab === 'window'"
          @click="switchTab('window')"
        >
          <i class="fa-solid fa-window-restore" aria-hidden="true" />
          Window
        </button>
      </div>
    </template>

    <div class="ct-body">
      <p
        v-show="activeTab !== 'window'"
        class="ct-domain-line"
      >
        Data for <strong>{{ domain || 'Current page' }}</strong>
      </p>

      <div
        v-show="activeTab !== 'window'"
        class="ct-select-actions"
        aria-label="Cleanup selection controls"
      >
      <span class="ct-select-actions__label">Data selection</span>
      <button
        class="ct-mini-btn"
        type="button"
        @click="selectAllData"
      >
        Select All
      </button>
      <button
        class="ct-mini-btn"
        type="button"
        @click="uncheckAllData"
      >
        Uncheck All
      </button>
    </div>

      <div
        v-show="activeTab !== 'window'"
        class="clean-options"
        role="tabpanel"
      >
        <div
          v-for="option in visibleOptions"
        :key="option.key"
        class="clean-option-wrap"
      >
        <label class="clean-option">
          <input
            v-model="selected[option.key]"
            type="checkbox"
          >
          <i :class="option.icon" />
          <span class="clean-label">{{ option.label }}</span>
          <span class="clean-count">{{ countFor(option.key) }}</span>
          <button
            class="ct-expand-btn"
            :class="{ expanded: expanded[option.key] }"
            type="button"
            :aria-expanded="expanded[option.key]"
            :aria-label="`Toggle ${option.label} preview`"
            @click.prevent.stop="expanded[option.key] = !expanded[option.key]"
          >
            <i class="fa-solid fa-chevron-down" />
          </button>
        </label>

        <div
          class="ct-data-preview"
          :class="{ show: expanded[option.key] }"
        >
          <template v-if="option.key === 'cookies'">
            <div
              v-if="cookies.length === 0"
              class="empty-data-msg"
            >
              No cookies
            </div>
            <div
              v-for="cookie in cookies"
              v-else
              :key="cookie.name + cookie.domain + cookie.path"
              class="ct-data-row"
            >
              <div class="ct-data-header">
                <span class="ct-data-name">{{ cookie.name }}</span>
                <span
                  class="ct-data-exp"
                  :class="Time.getCookieExpiration(cookie).status"
                >{{ Time.getCookieExpiration(cookie).label }}</span>
              </div>
              <div class="ct-data-flags">
                {{ Format.cookieFlags(cookie) }}
              </div>
              <div class="ct-data-value">
                {{ Format.short(cookie.value, 40) }}
              </div>
            </div>
          </template>

          <template v-else-if="option.key === 'localStorage'">
            <div
              v-if="localEntries.length === 0"
              class="empty-data-msg"
            >
              No localStorage
            </div>
            <div
              v-for="entry in localEntries.slice(0, 15)"
              v-else
              :key="entry.key"
              class="ct-data-row"
            >
              <div class="ct-data-name">
                {{ entry.key }}
              </div>
              <div class="ct-data-value">
                {{ Format.short(entry.value, 50) }}
              </div>
            </div>
            <div
              v-if="localEntries.length > 15"
              class="ct-more"
            >
              +{{ localEntries.length - 15 }} more...
            </div>
          </template>

          <template v-else-if="option.key === 'sessionStorage'">
            <div
              v-if="sessionEntries.length === 0"
              class="empty-data-msg"
            >
              No sessionStorage
            </div>
            <div
              v-for="entry in sessionEntries.slice(0, 15)"
              v-else
              :key="entry.key"
              class="ct-data-row"
            >
              <div class="ct-data-name">
                {{ entry.key }}
              </div>
              <div class="ct-data-value">
                {{ Format.short(entry.value, 50) }}
              </div>
            </div>
            <div
              v-if="sessionEntries.length > 15"
              class="ct-more"
            >
              +{{ sessionEntries.length - 15 }} more...
            </div>
          </template>

          <template v-else-if="option.key === 'history'">
            <div
              v-if="historyItems.length === 0"
              class="empty-data-msg"
            >
              No history
            </div>
            <div
              v-for="item in historyItems"
              v-else
              :key="item.url || item.title || item.lastVisitTime"
              class="ct-data-row ct-history-row"
            >
              <div class="ct-data-header">
                <span class="ct-data-name">{{ Format.short(item.title || 'Untitled', 40) }}</span>
                <span class="ct-data-time">{{ formatHistoryTime(item.lastVisitTime) }}</span>
              </div>
              <div class="ct-data-url">
                {{ Format.short(item.url || '', 50) }}
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>

      <section
        v-show="activeTab === 'window'"
        class="ct-window-action"
        role="tabpanel"
        aria-label="Current window cleanup"
      >
        <div class="ct-window-action__icon">
          <i class="fa-solid fa-window-restore" aria-hidden="true" />
        </div>
        <div class="ct-window-action__copy">
          <span>Current Window</span>
          <strong>Clear Other Tabs</strong>
          <p>{{ windowTabsLabel }}</p>
        </div>
        <button
          class="sw-btn sw-btn--secondary sw-btn--sm"
          type="button"
          :disabled="busy || !windowTabsLoaded || otherWindowTabsCount === 0"
          @click="requestClearOtherTabs"
        >
          Clear Other Tabs
        </button>
      </section>

      <p
        v-if="message && activeTab !== 'window'"
        class="sw-modal-message ct-message"
        :class="messageClass"
      >
        {{ message }}
      </p>
    </div>

    <template #footer>
      <button
        class="sw-btn sw-btn--secondary"
        type="button"
        @click="emit('close')"
      >
        Cancel
      </button>
      <button
        v-if="activeTab !== 'window'"
        class="sw-btn sw-btn--danger"
        :class="{ 'sw-btn--success': actionFeedback.isSuccess('clean') }"
        type="button"
        :disabled="busy || actionFeedback.isSuccess('clean')"
        @click="cleanTab"
      >
        <i class="fa-solid fa-trash" />
        {{ actionFeedback.label('clean', 'Clean Selected', busy, 'Cleaning…', 'Done!') }}
      </button>
    </template>
  </ModalBase>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { browser } from 'wxt/browser';
import { CurrentTabSnapshot, type HistoryPreviewItem } from '@features/sessions/currentTabSnapshot';
import { TabInfo } from '@features/sessions/sessionStorage';
import type { Cookie } from '@features/sessions/session.types';
import { Format } from '@shared/format';
import { Time } from '@shared/time';
import { useActionFeedback } from '../composables/useActionFeedback';
import { useModalMessage } from '../composables/useModalMessage';
import ModalBase from './ModalBase.vue';

type CleanKey = 'cookies' | 'localStorage' | 'sessionStorage' | 'history';
type CleanTab = 'data' | 'window';
const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: []; cleaned: [message?: string]; toast: [message: string]; clearOtherTabs: [count: number] }>();

const options: Array<{ key: CleanKey; label: string; icon: string }> = [
  { key: 'cookies', label: 'Cookies', icon: 'fa-solid fa-cookie text-amber-500' },
  { key: 'localStorage', label: 'localStorage', icon: 'fa-solid fa-database text-emerald-500' },
  { key: 'sessionStorage', label: 'sessionStorage', icon: 'fa-solid fa-hard-drive text-blue-500' },
  { key: 'history', label: 'History', icon: 'fa-solid fa-clock-rotate-left text-violet-500' },
];
const selected = reactive<Record<CleanKey, boolean>>({ cookies: true, localStorage: true, sessionStorage: true, history: true });
const activeTab = ref<CleanTab>('data');
const expanded = reactive<Record<CleanKey, boolean>>({ cookies: false, localStorage: false, sessionStorage: false, history: false });
const busy = ref(false);
const loadingPreview = ref(false);
const domain = ref('');
const cookies = ref<Cookie[]>([]);
const localStorageData = ref<Record<string, string>>({});
const sessionStorageData = ref<Record<string, string>>({});
const historyItems = ref<HistoryPreviewItem[]>([]);
const openWindowTabsCount = ref(0);
const otherWindowTabsCount = ref(0);
const windowTabsLoaded = ref(false);
const { message, messageClass, setMessage, clearMessage } = useModalMessage();
const actionFeedback = useActionFeedback();
const localEntries = computed(() => Format.entries(localStorageData.value));
const sessionEntries = computed(() => Format.entries(sessionStorageData.value));
const visibleOptions = computed(() => activeTab.value === 'data' ? options : []);
const windowTabsLabel = computed(() => {
  if (!windowTabsLoaded.value) return 'Checking open tabs…';
  if (openWindowTabsCount.value === 0) return 'No tabs found in this window.';
  const total = openWindowTabsCount.value;
  const other = otherWindowTabsCount.value;
  return `${total} tab${total === 1 ? '' : 's'} open · ${other} other tab${other === 1 ? '' : 's'} can be closed`;
});

watch(() => props.open, (open) => {
  if (!open) return;
  resetState();
  void loadPreview();
  void loadWindowTabs();
}, { immediate: true });

function resetState(): void {
  activeTab.value = 'data';
  selected.cookies = true;
  selected.localStorage = true;
  selected.sessionStorage = true;
  selected.history = true;
  openWindowTabsCount.value = 0;
  otherWindowTabsCount.value = 0;
  windowTabsLoaded.value = false;
  expanded.cookies = false;
  expanded.localStorage = false;
  expanded.sessionStorage = false;
  expanded.history = false;
  clearMessage();
}

function selectAllData(): void {
  selected.cookies = true;
  selected.localStorage = true;
  selected.sessionStorage = true;
  selected.history = true;
}

function uncheckAllData(): void {
  selected.cookies = false;
  selected.localStorage = false;
  selected.sessionStorage = false;
  selected.history = false;
}

function switchTab(tab: CleanTab): void {
  activeTab.value = tab;
  clearMessage();
}

function requestClearOtherTabs(): void {
  emit('clearOtherTabs', otherWindowTabsCount.value);
}

function countFor(key: CleanKey): string | number {
  if (loadingPreview.value) return '-';
  if (key === 'cookies') return cookies.value.length;
  if (key === 'localStorage') return localEntries.value.length;
  if (key === 'sessionStorage') return sessionEntries.value.length;
  if (key === 'history') return historyItems.value.length || '—';
  return '—';
}

function formatHistoryTime(timestamp?: number): string {
  if (!timestamp) return '';
  return Time.formatRelative(timestamp).split(' · ')[1] || Time.formatDateTime(timestamp);
}

async function loadPreview(): Promise<void> {
  loadingPreview.value = true;
  const snapshot = await CurrentTabSnapshot.collect({ includeHistory: true });
  if (!snapshot.success) {
    loadingPreview.value = false;
    setMessage('No data available for the current tab.', 'error');
    return;
  }
  domain.value = snapshot.data.domain;
  cookies.value = snapshot.data.cookies;
  localStorageData.value = snapshot.data.localStorage;
  sessionStorageData.value = snapshot.data.sessionStorage;
  historyItems.value = snapshot.data.history;
  loadingPreview.value = false;
}

async function loadWindowTabs(): Promise<void> {
  try {
    const tabs = await browser.tabs.query({ currentWindow: true });
    openWindowTabsCount.value = tabs.length;
    otherWindowTabsCount.value = tabs.filter((tab) => !tab.active && typeof tab.id === 'number').length;
  } catch {
    openWindowTabsCount.value = 0;
    otherWindowTabsCount.value = 0;
  } finally {
    windowTabsLoaded.value = true;
  }
}

async function cleanTab(): Promise<void> {
  const selectedCount = Object.values(selected).filter(Boolean).length;
  if (selectedCount === 0) {
    setMessage('Select at least one option', 'error');
    return;
  }
  busy.value = true;
  clearMessage();
  const result = await TabInfo.cleanCurrentTab({
    cookies: selected.cookies,
    localStorage: selected.localStorage,
    sessionStorage: selected.sessionStorage,
    history: selected.history,
  });
  busy.value = false;
  if (!result.success) {
    setMessage(result.error, 'error');
    return;
  }
  CurrentTabSnapshot.invalidate();
  setMessage('Cleaned successfully!', 'success');
  await actionFeedback.finish('clean', 'Done!', () => emit('cleaned', 'Current tab cleaned'));
}
</script>

<style scoped>
.ct-mode-tabs {
  display: grid;
  grid-template-columns: 1.3fr 1fr;
  margin: 0 -1px;
  border-bottom: 1px solid var(--clr-border);
}

.ct-mode-tab {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 42px;
  padding: 0 8px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--clr-text-muted);
  cursor: pointer;
  font-size: var(--fs-sm);
  font-weight: 800;
}

.ct-mode-tab:hover {
  color: var(--clr-text);
  background: var(--clr-background-alt);
}

.ct-mode-tab.active {
  border-bottom-color: var(--clr-danger);
  color: var(--clr-danger);
}

.ct-body {
  min-height: 264px;
  padding-top: 2px;
}

.ct-domain-line {
  margin: 0 0 8px;
  color: var(--clr-text-muted);
  font-size: var(--fs-sm);
}

.ct-select-actions {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
  margin: 0 0 10px;
}

.ct-select-actions__label {
  margin-right: 2px;
  color: var(--clr-text-light);
  font-size: var(--fs-xs);
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.ct-mini-btn {
  padding: 5px 10px;
  border: 1px solid var(--clr-border);
  border-radius: 7px;
  background: var(--clr-background);
  color: var(--clr-text-muted);
  cursor: pointer;
  font-size: var(--fs-sm);
  font-weight: 700;
}

.ct-mini-btn:hover {
  border-color: #cbd5e1;
  background: var(--clr-background-alt);
  color: #334155;
}

.clean-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}

.ct-window-action {
  display: grid;
  grid-template-columns: 42px 1fr;
  gap: 12px;
  align-items: start;
  margin-top: 12px;
  padding: 16px;
  border: 1px solid color-mix(in srgb, var(--clr-danger) 24%, var(--clr-border));
  border-radius: 12px;
  background: linear-gradient(135deg, color-mix(in srgb, var(--clr-danger) 7%, var(--clr-background)), var(--clr-background));
}

.ct-window-action__icon {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  border-radius: 11px;
  background: color-mix(in srgb, var(--clr-danger) 13%, var(--clr-background));
  color: var(--clr-danger);
}

.ct-window-action__copy {
  min-width: 0;
}

.ct-window-action__copy > span {
  display: block;
  color: var(--clr-text-light);
  font-size: var(--fs-xs);
  font-weight: 800;
  letter-spacing: .06em;
  text-transform: uppercase;
}

.ct-window-action__copy strong {
  display: block;
  margin-top: 3px;
  color: var(--clr-text);
  font-size: var(--fs-lg);
}

.ct-window-action__copy p {
  margin: 4px 0 14px;
  color: var(--clr-text-muted);
  font-size: var(--fs-sm);
}

.ct-window-action .sw-btn {
  grid-column: 1 / -1;
  width: 100%;
}

.ct-message {
  overflow-wrap: anywhere;
  word-break: break-word;
}

@media (max-width: 360px) {
  .ct-mode-tab {
    gap: 0;
    font-size: var(--fs-xs);
  }

  .ct-mode-tab i {
    display: none;
  }
}

.clean-option-wrap {
  display: flex;
  flex-direction: column;
}

.clean-option {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid var(--clr-border);
  border-radius: 8px;
  background: var(--clr-background);
  color: #374151;
  cursor: pointer;
  font-size: var(--fs-md);
}

.clean-option:hover {
  border-color: #cbd5e1;
  background: var(--clr-background-alt);
}

.clean-option input[type='checkbox'] {
  width: 16px;
  height: 16px;
  accent-color: var(--clr-danger);
}

.clean-label {
  flex: 1;
  font-weight: 700;
}

.clean-count {
  min-width: 28px;
  padding: 2px 8px;
  border-radius: 10px;
  background: var(--clr-border);
  color: var(--clr-text-muted);
  font-size: var(--fs-base);
  font-weight: 700;
  text-align: center;
}

.ct-expand-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  border-radius: 5px;
  background: transparent;
  color: var(--clr-text-light);
  cursor: pointer;
  transition: all 0.2s ease;
}

.ct-expand-btn:hover {
  background: white;
  color: var(--clr-text-muted);
}

.ct-expand-btn.expanded {
  transform: rotate(180deg);
}

.ct-data-preview {
  max-height: 0;
  overflow: hidden;
  margin-top: -4px;
  border-radius: 0 0 8px 8px;
  background: var(--clr-background-alt);
  transition: max-height 0.25s ease, padding 0.25s ease;
}

.ct-data-preview.show {
  max-height: 220px;
  overflow-y: auto;
  padding: 8px 10px;
  border: 1px solid var(--clr-border);
  border-top: none;
}

.ct-data-row {
  margin-bottom: 4px;
  padding: 6px 8px;
  border-radius: 4px;
  background: white;
  font-size: var(--fs-sm);
}

.ct-data-row:last-child {
  margin-bottom: 0;
}

.ct-data-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.ct-data-name {
  min-width: 0;
  flex: 1;
  color: #334155;
  font-weight: 700;
  word-break: break-all;
}

.ct-data-exp {
  padding: 2px 6px;
  border-radius: 4px;
  font-size: var(--fs-xs);
  font-weight: 700;
  white-space: nowrap;
}

.ct-data-exp.session { background: #e0e7ff; color: #4f46e5; }
.ct-data-exp.valid { background: #dcfce7; color: #16a34a; }
.ct-data-exp.notice { background: #e0f2fe; color: #0369a1; }
.ct-data-exp.warning { background: #fef3c7; color: #d97706; }
.ct-data-exp.critical,
.ct-data-exp.expired { background: #fee2e2; color: var(--clr-danger-hover); }

.ct-data-flags {
  margin: 2px 0;
  color: var(--clr-text-light);
  font-size: var(--fs-xs);
}

.ct-data-value,
.ct-data-url {
  margin-top: 2px;
  padding: 2px 4px;
  border-radius: 2px;
  background: var(--clr-background);
  color: var(--clr-text-muted);
  font-family: Cause, system-ui, sans-serif;
  font-size: var(--fs-xs);
  word-break: break-all;
}

.ct-more {
  padding: 4px;
  color: var(--clr-text-light);
  font-size: var(--fs-xs);
  font-style: italic;
  text-align: center;
}

.ct-data-time {
  flex-shrink: 0;
  color: var(--clr-text-light);
  font-size: var(--fs-xs);
  white-space: nowrap;
}

.empty-data-msg {
  padding: 8px;
  color: var(--clr-text-light);
  font-size: var(--fs-sm);
  text-align: center;
}

.text-amber-500 { color: #f59e0b; }
.text-emerald-500 { color: #10b981; }
.text-blue-500 { color: #3b82f6; }
.text-violet-500 { color: #8b5cf6; }
.text-slate-500 { color: #64748b; }
</style>
