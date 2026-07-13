<template>
  <ModalBase
    :open="open"
    title="Add New Session"
    icon="fa-solid fa-plus-circle text-blue-500"
    panel-class="add-session-modal__panel"
    @close="emit('close')"
  >
    <template #after-header>
      <div
        class="add-mode-tabs"
        role="tablist"
        aria-label="Add session mode"
      >
        <button
          class="add-mode-tab"
          :class="{ active: activeTab === 'capture' }"
          type="button"
          role="tab"
          :aria-selected="activeTab === 'capture'"
          @click="switchMode('capture')"
        >
          <i
            class="fa-solid fa-camera mr-1"
            aria-hidden="true"
          />
          Capture Tab
        </button>
        <button
          class="add-mode-tab"
          :class="{ active: activeTab === 'import' }"
          type="button"
          role="tab"
          :aria-selected="activeTab === 'import'"
          @click="switchMode('import')"
        >
          <i
            class="fa-solid fa-paste mr-1"
            aria-hidden="true"
          />
          Import Cookies
        </button>
        <button
          class="add-mode-tab"
          :class="{ active: activeTab === 'file' }"
          type="button"
          role="tab"
          :aria-selected="activeTab === 'file'"
          @click="switchMode('file')"
        >
          <i
            class="fa-solid fa-file-import mr-1"
            aria-hidden="true"
          />
          Import File
        </button>
      </div>
    </template>

    <div class="modal-body">
      <div
        v-show="activeTab === 'capture'"
        role="tabpanel"
      >
        <input
          ref="sessionNameInput"
          v-model.trim="sessionName"
          type="text"
          placeholder="Session name..."
          maxlength="50"
          aria-label="Session name"
          autofocus
          @keydown.enter.prevent="submit"
        >

        <div
          class="modal-info-enhanced"
          :class="{ shimmer: loadingCapture }"
        >
          <div class="modal-domain-row">
            <span class="modal-favicon-wrap">
              <img
                v-if="captureIconUrl"
                class="modal-favicon"
                :src="captureIconUrl"
                alt=""
                @error="captureIconUrl = null"
              >
              <span
                v-else
                class="modal-favicon-fallback"
              >
                <i class="fa-solid fa-globe" />
              </span>
            </span>
            <span class="modal-domain-text">{{ captureInfo?.domain ?? '—' }}</span>
          </div>
          <div class="modal-stats-row">
            <span
              class="stat-item"
              :title="`${cookieCount} cookies`"
            >
              <i class="fa-solid fa-cookie text-amber-500" />
              <strong>{{ loadingCapture ? '—' : cookieCount }}</strong>
            </span>
            <span
              class="stat-item"
              :title="`${localCount} localStorage items`"
            >
              <i class="fa-solid fa-database text-emerald-500" />
              <strong>{{ loadingCapture ? '—' : localCount }}</strong>
            </span>
            <span
              class="stat-item"
              :title="`${sessionCount} sessionStorage items`"
            >
              <i class="fa-solid fa-hard-drive text-blue-500" />
              <strong>{{ loadingCapture ? '—' : sessionCount }}</strong>
            </span>
            <button
              type="button"
              class="stats-info-btn"
              title="What's this?"
              @click="showStatsInfo = !showStatsInfo"
            >
              <i class="fa-solid fa-circle-question" />
            </button>
          </div>
        </div>

        <div
          v-show="showStatsInfo"
          class="stats-info-text"
        >
          <div class="stats-info-item">
            <i class="fa-solid fa-cookie text-amber-500" />
            <strong>Cookies:</strong> Login tokens, session IDs
          </div>
          <div class="stats-info-item">
            <i class="fa-solid fa-database text-emerald-500" />
            <strong>localStorage:</strong> Persistent data (survives browser close)
          </div>
          <div class="stats-info-item">
            <i class="fa-solid fa-hard-drive text-blue-500" />
            <strong>sessionStorage:</strong> Temporary data (cleared on tab close)
          </div>
        </div>

        <div
          v-if="isSensitiveDomain"
          class="blocked-compact"
        >
          <span class="blocked-compact-title">
            <i class="fa-solid fa-triangle-exclamation mr-1" />
            Domain Notice
          </span>
          <span>{{ captureInfo?.domain }} uses complex auth. Saving/restoring may not work properly.</span>
        </div>

        <div class="add-options-card">
          <div class="add-options-title">
            Additional:
          </div>
          <label class="modal-checkbox-row">
            <input
              v-model="includeLocalStorage"
              type="checkbox"
            >
            <span>Save localStorage for this domain</span>
          </label>
          <label class="modal-checkbox-row">
            <input
              v-model="includeSessionStorage"
              type="checkbox"
            >
            <span>Save sessionStorage for this domain</span>
          </label>
          <label class="modal-checkbox-row warning-row">
            <input
              v-model="cleanAfterSave"
              type="checkbox"
            >
            <span>Clear data after saving</span>
            <button
              type="button"
              class="info-btn"
              title="Click for info"
              @click.prevent="showClearInfo = !showClearInfo"
            >
              <i class="fa-solid fa-circle-info" />
            </button>
          </label>
          <div
            v-show="showClearInfo"
            class="clear-info-text"
          >
            <i class="fa-solid fa-triangle-exclamation text-amber-500 mr-1" />
            Clears cookies, localStorage & sessionStorage after saving. Useful for storing multiple accounts cleanly.
          </div>
        </div>
      </div>

      <div
        v-show="activeTab === 'import'"
        role="tabpanel"
      >
        <textarea
          ref="importCookieInput"
          v-model="importText"
          class="import-cookie-textarea"
          placeholder="Paste cookies in any format:

• JSON: [{&quot;name&quot;:&quot;token&quot;,&quot;value&quot;:&quot;...&quot;}]
• Netscape: .domain.com[TAB]TRUE[TAB]/[TAB]...
• Header: Cookie: name=value; name2=value
• Key-Value: name=value (one per line)"
          rows="7"
          spellcheck="false"
        />
        <div class="import-format-hint">
          <i class="fa-solid fa-circle-info" />
          Supports: Cookie Editor JSON, Netscape (curl/wget), Header string, Key-Value
        </div>
        <div
          v-if="importText.trim()"
          class="import-preview"
          :class="{ invalid: !importPreview.valid }"
        >
          <i :class="importPreview.valid ? 'fa-solid fa-circle-check text-emerald-500' : 'fa-solid fa-circle-xmark text-red-500'" />
          <span>{{ importPreview.text }}</span>
        </div>
        <input
          v-show="importPreview.valid"
          ref="importSessionNameInput"
          v-model.trim="importSessionName"
          type="text"
          placeholder="Session name..."
          maxlength="50"
          @keydown.enter.prevent="submit"
        >
      </div>

      <div
        v-show="activeTab === 'file'"
        role="tabpanel"
      >
        <label
          class="dropzone"
          :class="{ dragover: fileDragOver }"
          @dragover.prevent="fileDragOver = true"
          @dragleave="fileDragOver = false"
          @drop.prevent="onFileDrop"
          @click="onDropzoneClick"
        >
          <span v-if="fileQueue.length">
            <i class="fa-solid fa-folder-tree mr-1" />
            {{ fileQueue.length }} file{{ fileQueue.length === 1 ? '' : 's' }} loaded
          </span>
          <span v-else>
            <i class="fa-solid fa-folder-open mr-1" />
            Drop .json, .txt, or .owi file(s)
          </span>
          <input
            v-if="!isFirefox"
            class="hidden"
            type="file"
            accept=".json,.txt,.owi"
            multiple
            @change="onFileChange"
          >
        </label>
        <div
          v-if="fileQueue.length"
          class="rm-file-list"
        >
          <div
            v-for="item in parsedFileBatch?.items ?? []"
            :key="item.id"
            class="rm-file-item"
            :class="item.status === 'invalid' ? 'error' : item.status === 'needs-password' ? 'warning' : 'success'"
          >
            <i :class="item.detectedKind === 'owi-backup' ? 'fa-solid fa-lock' : item.detectedKind === 'cookie-batch' ? 'fa-solid fa-cookie' : 'fa-solid fa-file-code'" />
            {{ item.name }}
            <span>{{ fileQueueItemSummary(item) }}</span>
            <button
              class="queue-remove-btn"
              type="button"
              aria-label="Remove file"
              @click="removeQueuedFile(item.id)"
            >
              <i class="fa-solid fa-xmark" />
            </button>
          </div>
          <div
            v-for="item in parsedFileBatch?.items.filter((entry) => entry.status === 'needs-password' || (entry.detectedKind === 'owi-backup' && entry.requiresPassword && entry.status === 'invalid')) ?? []"
            :key="`${item.id}-password`"
            class="file-password-row"
          >
            <div class="file-password-input-wrap">
              <input
                v-model="filePasswords[item.id]"
                :type="filePasswordVisible[item.id] ? 'text' : 'password'"
                :placeholder="`Password for ${item.name}`"
                autocomplete="new-password"
                @keydown.enter.prevent="unlockAndReview(item.id)"
              >
              <button
                class="file-password-eye"
                type="button"
                :aria-label="filePasswordVisible[item.id] ? 'Hide password' : 'Show password'"
                @click="filePasswordVisible[item.id] = !filePasswordVisible[item.id]"
              >
                <i :class="filePasswordVisible[item.id] ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye'" />
              </button>
            </div>
            <button
              class="btn btn-secondary btn-sm"
              type="button"
              :disabled="busy || !filePasswords[item.id]?.trim()"
              @click="unlockAndReview(item.id)"
            >
              Verify Password
            </button>
          </div>
        </div>
        <div
          v-if="fileQueue.length"
          class="import-preview"
          :class="{ invalid: hasFileQueueBlockers }"
        >
          <i :class="hasFileQueueBlockers ? 'fa-solid fa-circle-xmark text-red-500' : 'fa-solid fa-circle-check text-emerald-500'" />
          <span>{{ fileQueueSummary }}</span>
        </div>
      </div>

      <div
        class="sw-modal-message"
        :class="messageType"
      >
        {{ message }}
      </div>
    </div>

    <template #footer>
      <button
        class="btn btn-secondary"
        type="button"
        @click="emit('close')"
      >
        Cancel
      </button>
      <button
        class="btn btn-primary"
        type="button"
        :class="{ 'btn-success': actionFeedback.isSuccess('submit') }"
        :disabled="busy || actionFeedback.isSuccess('submit')"
        @click="submit"
      >
        <i class="fa-solid fa-save mr-1" />
        {{ actionFeedback.label('submit', 'Save Session', busy, 'Saving...') }}
      </button>
    </template>
  </ModalBase>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { Backup } from '@features/backup/backup';
import { createImportSourcesFromFiles, importPayloadSummary, isAegisImport, isOwiImport, mergeImportPayloads, parseAegisImportText, parseCookieImportText, parseImportSources, parseOwiImportText, parsePlainImportText, summarizeBatchResult } from '@features/backup/import';
import type { BatchParseResult, ParsedImportItem, ImportSourceItem } from '@features/import/import.types';
import { useActionFeedback } from '../composables/useActionFeedback';
import { useFirefoxFilePicker } from '../composables/useFirefoxFilePicker';
import ModalBase from './ModalBase.vue';
import { useModalMessage } from '../composables/useModalMessage';
import { CurrentTabSnapshot } from '@features/sessions/currentTabSnapshot';
import { SessionStorage, TabInfo, uniqueTimestamp } from '@features/sessions/sessionStorage';
import type { Cookie, Session } from '@features/sessions/session.types';
import { tabIcons } from '@platform/icons/tabIcons';
import { Domain } from '@shared/domain';
import { Normalize } from '@shared/normalize';

type AddTab = 'capture' | 'import' | 'file';
type CaptureInfo = { domain: string; url: string; cookies: Cookie[]; localStorage: Record<string, string>; sessionStorage: Record<string, string> };

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: []; saved: [message?: string]; toast: [message: string] }>();

const { isFirefox, openPicker, consumePendingFiles } = useFirefoxFilePicker('.json,.txt,.owi', true, 'addSession');

const activeTab = ref<AddTab>('capture');
const sessionNameInput = ref<HTMLInputElement | null>(null);
const importCookieInput = ref<HTMLTextAreaElement | null>(null);
const importSessionNameInput = ref<HTMLInputElement | null>(null);
const sessionName = ref('');
const importSessionName = ref('');
const includeLocalStorage = ref(true);
const includeSessionStorage = ref(true);
const cleanAfterSave = ref(false);
const importText = ref('');
const fileQueue = ref<ImportSourceItem[]>([]);
const parsedFileBatch = ref<BatchParseResult | null>(null);
const filePasswords = ref<Record<string, string>>({});
const filePasswordVisible = ref<Record<string, boolean>>({});
const fileDragOver = ref(false);
const captureInfo = ref<CaptureInfo | null>(null);
const captureIconUrl = ref<string | null>(null);
const loadingCapture = ref(false);
const showStatsInfo = ref(false);
const showClearInfo = ref(false);
const busy = ref(false);
const { message, messageType, setMessage, clearMessage } = useModalMessage();
const actionFeedback = useActionFeedback();

const cookieCount = computed(() => captureInfo.value?.cookies.length ?? 0);
const localCount = computed(() => Object.keys(captureInfo.value?.localStorage ?? {}).length);
const sessionCount = computed(() => Object.keys(captureInfo.value?.sessionStorage ?? {}).length);
const isSensitiveDomain = computed(() => captureInfo.value ? Domain.isSensitive(captureInfo.value.domain) : false);
const importPreview = computed(() => {
  const raw = importText.value.trim();
  if (!raw) return { valid: false, text: '' };
  const result = Normalize.parseCookieString(raw, { name: importSessionName.value || 'import', domain: captureInfo.value?.domain });
  if (!result.sessions.length) return { valid: false, text: result.error || 'Invalid format' };
  const totalCookies = result.sessions.reduce((sum, session) => sum + (session.cookies?.length ?? 0), 0);
  const labels: Record<string, string> = { json: 'JSON', netscape: 'Netscape', header: 'Header', keyvalue: 'Key-Value' };
  return { valid: true, text: `${totalCookies} cookies · ${labels[result.format] || result.format} · ${result.sessions[0]?.domain || '?'}` };
});
const fileQueueSummary = computed(() => {
  if (!parsedFileBatch.value) return `${fileQueue.value.length} file${fileQueue.value.length === 1 ? '' : 's'} loaded`;
  const { invalid, passwordRequired, total } = parsedFileBatch.value.summary;
  if (passwordRequired > 0) return `${passwordRequired} encrypted file${passwordRequired === 1 ? '' : 's'} locked · Enter password to unlock and review`;
  const wrongPasswords = parsedFileBatch.value.items.filter((item) => item.detectedKind === 'owi-backup' && item.requiresPassword && item.status === 'invalid').length;
  if (wrongPasswords > 0) return `${wrongPasswords} encrypted file${wrongPasswords === 1 ? '' : 's'} have an incorrect password`;
  if (invalid > 0) return `${invalid}/${total} file${total === 1 ? '' : 's'} need attention`;
  return summarizeBatchResult(parsedFileBatch.value);
});
const hasFileQueueBlockers = computed(() => Boolean(parsedFileBatch.value && (parsedFileBatch.value.summary.invalid > 0 || parsedFileBatch.value.summary.passwordRequired > 0)));

watch(() => props.open, (isOpen) => {
  if (!isOpen) return;
  resetForm();
  void ensureCaptureInfo(true);
  void nextTick(() => sessionNameInput.value?.focus());
  void consumePendingFiles().then((files) => { if (files.length) { activeTab.value = 'file'; processDroppedFiles(files); } });
});

watch(importText, async () => {
  if (importPreview.value.valid) await nextTick(() => importSessionNameInput.value?.focus());
});

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && props.open) emit('close');
}
window.addEventListener('keydown', onKeydown);
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown));

function resetForm(): void {
  activeTab.value = 'capture';
  sessionName.value = '';
  importSessionName.value = '';
  importText.value = '';
  fileQueue.value = [];
  parsedFileBatch.value = null;
  filePasswords.value = {};
  filePasswordVisible.value = {};
  includeLocalStorage.value = true;
  includeSessionStorage.value = true;
  cleanAfterSave.value = false;
  captureIconUrl.value = null;
  showStatsInfo.value = false;
  showClearInfo.value = false;
  clearMessage();
}

function switchMode(mode: AddTab): void {
  activeTab.value = mode;
  clearMessage();
  void nextTick(() => {
    if (mode === 'capture') sessionNameInput.value?.focus();
    if (mode === 'import') importCookieInput.value?.focus();
  });
}

async function ensureCaptureInfo(force = false): Promise<CaptureInfo | null> {
  if (captureInfo.value && !force) return captureInfo.value;
  loadingCapture.value = true;
  const result = await CurrentTabSnapshot.collect({ force });
  if (!result.success) {
    loadingCapture.value = false;
    setMessage(result.error, 'error');
    return null;
  }
  const cookies = sanitizeCookies(result.data.cookies, result.data.domain);
  captureInfo.value = { ...result.data, cookies };
  captureIconUrl.value = await tabIcons.getDomainIcon(result.data.domain);
  loadingCapture.value = false;
  return captureInfo.value;
}

async function getNextDomainIndex(domain: string): Promise<number> {
  const all = await SessionStorage.getAll();
  if (!all.success) return 1;
  const domainSessions = all.data.filter(session => session.domain === domain);
  return domainSessions.length ? Math.max(...domainSessions.map(session => session.index ?? 0)) + 1 : 1;
}

function sanitizeCookies(cookies: unknown, domain: string): Cookie[] {
  return Normalize.cookies(cookies, domain)
    .filter(cookie => cookie.name && cookie.value !== undefined)
    .map(cookie => {
      const expirationDate = typeof cookie.expirationDate === 'number' && Number.isFinite(cookie.expirationDate) ? cookie.expirationDate : undefined;
      const isSession = typeof cookie.session === 'boolean' ? cookie.session : expirationDate === undefined;
      const safeDomain = cookie.domain || domain;
      return {
        name: String(cookie.name),
        value: String(cookie.value ?? ''),
        domain: safeDomain,
        path: cookie.path || '/',
        secure: Boolean(cookie.secure),
        httpOnly: Boolean(cookie.httpOnly),
        sameSite: cookie.sameSite || 'unspecified',
        hostOnly: typeof cookie.hostOnly === 'boolean' ? cookie.hostOnly : !safeDomain.startsWith('.'),
        session: isSession,
        expirationDate: isSession ? undefined : expirationDate,
        storeId: cookie.storeId,
        firstPartyDomain: cookie.firstPartyDomain,
        partitionKey: cookie.partitionKey,
      };
    });
}

async function saveCapturedSession(): Promise<void> {
  const info = await ensureCaptureInfo();
  if (!info) return;
  if (!sessionName.value) {
    setMessage('Please enter a name');
    sessionNameInput.value?.focus();
    return;
  }
  const cookies = sanitizeCookies(info.cookies, info.domain);
  const localStorage = includeLocalStorage.value ? info.localStorage : {};
  const sessionStorage = includeSessionStorage.value ? info.sessionStorage : {};
  if (!cookies.length && Object.keys(localStorage).length === 0 && Object.keys(sessionStorage).length === 0) {
    setMessage('No data to save: cookies, localStorage, and sessionStorage are empty.', 'error');
    return;
  }
  const timestamp = uniqueTimestamp();
  const session: Session = {
    id: String(timestamp),
    name: sessionName.value,
    domain: info.domain,
    originalUrl: info.url,
    cookies,
    localStorage,
    sessionStorage,
    timestamp,
    index: await getNextDomainIndex(info.domain),
  };
  const result = await SessionStorage.save(session);
  if (!result.success) {
    setMessage(result.error, 'error');
    return;
  }
  if (cleanAfterSave.value) {
    await TabInfo.cleanCurrentTab({ cookies: true, localStorage: includeLocalStorage.value, sessionStorage: includeSessionStorage.value });
    CurrentTabSnapshot.invalidate();
  }
  await finishSubmit('Session saved');
}

async function restoreSessions(sessions: Session[]): Promise<void> {
  const existing = await SessionStorage.getAll();
  if (!existing.success) {
    setMessage(existing.error, 'error');
    return;
  }

  const nextDomainIndex = new Map<string, number>();
  for (const saved of existing.data) {
    const current = nextDomainIndex.get(saved.domain) ?? 1;
    nextDomainIndex.set(saved.domain, Math.max(current, (saved.index ?? 0) + 1));
  }

  const prepared = sessions.map((session) => {
    const timestamp = session.timestamp || uniqueTimestamp();
    const nextIndex = nextDomainIndex.get(session.domain) ?? 1;
    nextDomainIndex.set(session.domain, nextIndex + 1);
    return {
      ...session,
      id: session.id || String(timestamp),
      timestamp,
      lastRestoredAt: Date.now(),
      index: session.index ?? nextIndex,
    };
  });

  const result = await SessionStorage.saveMany(prepared);
  if (!result.success) {
    setMessage(result.error, 'error');
    return;
  }
  if (!result.data.restored) {
    setMessage('Failed to save (duplicate name?)', 'error');
    return;
  }
  await finishSubmit(`Saved ${result.data.restored} session(s)!`);
}

async function restoreText(text: string, password = '', fileName = ''): Promise<void> {
  const raw = text.trim();
  if (!raw) {
    setMessage('Please paste cookies');
    return;
  }
  if (isOwiImport(raw, fileName)) {
    const payloadResult = await parseOwiImportText(raw, password);
    if (!payloadResult.success) {
      setMessage(payloadResult.error, 'error');
      return;
    }
    const result = await Backup.restorePayload(payloadResult.data);
    if (!result.success) {
      setMessage(result.error, 'error');
      return;
    }
    await finishSubmit(`Imported ${importPayloadSummary(result.data.payload)}`);
    return;
  }

  if (isAegisImport(raw)) {
    const aegisResult = await parseAegisImportText(raw, password);
    if (!aegisResult.success) {
      setMessage(aegisResult.error, 'error');
      return;
    }
    const result = await Backup.restorePayload(aegisResult.data.payload);
    if (!result.success) {
      setMessage(result.error, 'error');
      return;
    }
    await finishSubmit(`Imported ${importPayloadSummary(result.data.payload)}`);
    return;
  }

  const parsedCookies = parseCookieImportText(raw, { name: importSessionName.value, domain: captureInfo.value?.domain });
  if (parsedCookies.success) {
    if (!importSessionName.value.trim()) {
      setMessage('Please enter a name');
      importSessionNameInput.value?.focus();
      return;
    }
    const sessions = parsedCookies.data.sessions.map((session, index) => ({ ...session, name: parsedCookies.data.sessions.length === 1 ? importSessionName.value : `${importSessionName.value} (${session.domain || index + 1})` }));
    await restoreSessions(sessions);
    return;
  }

  const payload = parsePlainImportText(raw);
  if (!payload.success) {
    setMessage(parsedCookies.error || payload.error, 'error');
    return;
  }
  const result = await Backup.restorePayload(payload.data);
  if (!result.success) {
    setMessage(result.error, 'error');
    return;
  }
  await finishSubmit(`Imported ${importPayloadSummary(result.data.payload)}`);
}

async function queueFiles(files: FileList | File[] | null | undefined): Promise<void> {
  if (!files || !files.length) return;
  const sources = await createImportSourcesFromFiles(files);
  fileQueue.value = [...fileQueue.value, ...sources];
  clearMessage();
  await reviewFileQueue();
}

function onFileChange(event: Event): void {
  void queueFiles((event.target as HTMLInputElement).files);
}

function onFileDrop(event: DragEvent): void {
  fileDragOver.value = false;
  void queueFiles(event.dataTransfer?.files);
}

function onDropzoneClick(event: MouseEvent): void {
  if (!isFirefox) return;
  event.preventDefault();
  void openPicker();
}

async function processDroppedFiles(files: File[]): Promise<void> {
  await queueFiles(files);
  await reviewFileQueue();
}

function fileQueueItemSummary(item: ParsedImportItem): string {
  if (item.status === 'needs-password') return 'Locked — enter password to review contents';
  if (item.status === 'ready') {
    if (item.sessions?.length) return `${item.sessions.length} sessions ready`;
    return `${item.payload?.data.sessions.length ?? 0} sessions · ${item.payload?.data.twoFactorEntries.length ?? 0} 2FA`;
  }
  if (item.detectedKind === 'owi-backup' && item.requiresPassword) return 'Password incorrect — enter the correct password to review';
  return item.error ?? 'Invalid import';
}

async function reviewFileQueue(): Promise<BatchParseResult | null> {
  if (!fileQueue.value.length) {
    parsedFileBatch.value = null;
    return null;
  }
  const result = await parseImportSources(fileQueue.value, {
    passwords: filePasswords.value,
    cookieHint: { domain: captureInfo.value?.domain },
  });
  parsedFileBatch.value = result;
  return result;
}

async function unlockAndReview(id: string): Promise<void> {
  if (!filePasswords.value[id]?.trim()) return;
  await reviewFileQueue();
}

function removeQueuedFile(id: string): void {
  fileQueue.value = fileQueue.value.filter((item) => item.id !== id);
  parsedFileBatch.value = parsedFileBatch.value ? {
    items: parsedFileBatch.value.items.filter((item) => item.id !== id),
    summary: parsedFileBatch.value.summary,
  } : null;
  delete filePasswords.value[id];
  delete filePasswordVisible.value[id];
  void reviewFileQueue();
}

async function restoreFile(): Promise<void> {
  if (!fileQueue.value.length) {
    setMessage('No backup data loaded — select file(s) first', 'error');
    return;
  }
  const parsed = await reviewFileQueue();
  if (!parsed) {
    setMessage('No files loaded', 'error');
    return;
  }
  if (parsed.summary.passwordRequired > 0) {
    setMessage('Enter passwords for all encrypted files first', 'error');
    return;
  }
  if (parsed.summary.invalid > 0) {
    setMessage('Remove or fix invalid files before importing', 'error');
    return;
  }
  const readyItems = parsed.items.filter((item) => item.status === 'ready');
  const mergedPayload = mergeImportPayloads(readyItems);
  if (!mergedPayload.data.sessions.length && !mergedPayload.data.twoFactorEntries.length) {
    setMessage('No session or 2FA data found in selected files', 'error');
    return;
  }
  const result = await Backup.restorePayload(mergedPayload);
  if (!result.success) {
    setMessage(result.error, 'error');
    return;
  }
  await finishSubmit(`Imported ${importPayloadSummary(result.data.payload)}`);
}

async function finishSubmit(messageText: string): Promise<void> {
  setMessage(messageText, 'success');
  await actionFeedback.finish('submit', 'Saved!', () => emit('saved', messageText));
}

async function submit(): Promise<void> {
  busy.value = true;
  if (!message.value || messageType.value !== 'success') clearMessage();
  try {
    if (activeTab.value === 'capture') await saveCapturedSession();
    else if (activeTab.value === 'import') await restoreText(importText.value);
    else await restoreFile();
  } catch (error) {
    setMessage(error instanceof Error ? error.message : String(error), 'error');
  } finally {
    busy.value = false;
  }
}
</script>

<style scoped>
.add-session-modal__panel {
  width: 340px;
  max-width: 90vw;
  max-height: calc(100vh - 32px);
}

.add-mode-tabs {
  display: flex;
  border-bottom: 1px solid var(--clr-border);
  background: var(--clr-background);
}

.add-mode-tab {
  flex: 1;
  padding: 8px 0;
  border: none;
  border-bottom: 2px solid transparent;
  background: none;
  color: var(--clr-text-muted);
  cursor: pointer;
  font-size: var(--fs-sm);
  font-weight: 600;
  transition: all 0.15s;
}

.add-mode-tab:hover { color: #334155; }
.add-mode-tab.active {
  color: var(--clr-primary);
  border-bottom-color: var(--clr-primary);
  background: #fff;
}

.modal-body {
  max-height: calc(100vh - 150px);
  overflow-y: auto;
  padding: 12px;
}

.modal-body input[type='text'],
.modal-body input[type='password'] {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: var(--fs-lg);
  margin-bottom: 12px;
}

.modal-body input:focus,
.import-cookie-textarea:focus {
  outline: none;
  border-color: var(--clr-primary);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.modal-info-enhanced {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  margin-bottom: 10px;
  border: 1px solid var(--clr-border);
  border-radius: 8px;
  background: var(--clr-background);
  transition: background 0.2s;
}

.modal-info-enhanced.shimmer {
  animation: shimmer-sweep 1.2s infinite linear;
  border-color: #bfdbfe;
  background: linear-gradient(90deg, var(--clr-background) 25%, #e8f0fe 50%, var(--clr-background) 75%);
  background-size: 200% 100%;
}

.modal-domain-row,
.modal-stats-row,
.stat-item,
.file-password-row {
  display: flex;
  align-items: center;
}

.modal-domain-row { gap: 8px; min-width: 0; }
.modal-favicon-wrap {
  display: inline-flex;
  width: 20px;
  height: 20px;
  flex: 0 0 20px;
  align-items: center;
  justify-content: center;
}

.modal-favicon {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  background: var(--clr-border);
  object-fit: cover;
}

.modal-favicon-fallback {
  display: flex;
  width: 20px;
  height: 20px;
  align-items: center;
  justify-content: center;
  color: var(--clr-text-light);
}

.modal-domain-text {
  overflow: hidden;
  color: var(--clr-text);
  font-size: var(--fs-md);
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.modal-stats-row { gap: 12px; }
.stat-item {
  gap: 4px;
  color: var(--clr-text-muted);
  cursor: help;
  font-size: var(--fs-base);
}

.stat-item strong {
  color: #374151;
  font-weight: 600;
}

.stats-info-btn,
.info-btn {
  border: none;
  background: none;
  color: var(--clr-text-light);
  cursor: pointer;
}

.stats-info-btn:hover,
.info-btn:hover { color: var(--clr-primary); }

.stats-info-text {
  display: grid;
  gap: 4px;
  padding: 8px 10px;
  margin-bottom: 8px;
  border: 1px solid #bae6fd;
  border-radius: 6px;
  background: #f0f9ff;
  color: #0c4a6e;
  font-size: var(--fs-sm);
}

.blocked-compact {
  padding: 8px 12px;
  margin: 8px 0;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: #fef2f2;
  color: #78716c;
  font-size: var(--fs-base);
  font-weight: 500;
  line-height: 1.4;
}

.blocked-compact-title {
  display: block;
  margin-bottom: 8px;
  color: #d73502;
  font-weight: bold;
}

.add-options-card {
  padding: 10px 12px;
  margin: 10px 0;
  border: 1px solid var(--clr-border);
  border-radius: 8px;
  background: var(--clr-background);
}

.add-options-title {
  margin-bottom: 6px;
  color: var(--clr-text-muted);
  font-size: var(--fs-sm);
  font-weight: 600;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

.modal-checkbox-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 4px 0;
  color: #374151;
  cursor: pointer;
  font-size: var(--fs-base);
}

.modal-checkbox-row input[type='checkbox'] {
  width: 14px;
  height: 14px;
  cursor: pointer;
}

.modal-checkbox-row.warning-row {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed var(--clr-border);
  color: #b45309;
}

.info-btn { margin-left: auto; padding: 2px 4px; font-size: var(--fs-base); }

.clear-info-text {
  padding: 8px 10px;
  margin-top: 6px;
  border: 1px solid #fde68a;
  border-radius: 6px;
  background: #fffbeb;
  color: #92400e;
  font-size: var(--fs-sm);
  line-height: 1.4;
}

.import-cookie-textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 8px 10px;
  margin-top: 8px;
  border: 1px solid var(--clr-border);
  border-radius: 8px;
  background: var(--clr-background);
  color: #334155;
  font-family: 'Cause', system-ui, sans-serif;
  font-size: var(--fs-xs);
  line-height: 1.5;
  outline: none;
  resize: vertical;
  transition: border-color 0.15s;
}

.import-format-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  color: var(--clr-text-muted);
  font-size: 11px;
}

.import-format-hint i { color: var(--clr-text-light); }

.import-preview {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  margin-top: 6px;
  border: 1px solid #bbf7d0;
  border-radius: 6px;
  background: #f0fdf4;
  color: var(--clr-text-secondary);
  font-size: var(--fs-sm);
}

.import-preview.invalid {
  border-color: #fecaca;
  background: #fef2f2;
}

.dropzone {
  display: flex;
  min-height: 116px;
  align-items: center;
  justify-content: center;
  padding: 24px;
  margin-bottom: 12px;
  border: 2px dashed #cbd5e1;
  border-radius: 10px;
  background: var(--clr-background);
  color: var(--clr-text-secondary);
  cursor: pointer;
  font-size: var(--fs-base);
  text-align: center;
}

.dropzone:hover,
.dropzone.dragover {
  border-color: var(--clr-primary);
  background: #eff6ff;
}

.rm-file-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 156px;
  margin-bottom: 8px;
  overflow-y: auto;
}

.rm-file-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 8px;
  border-radius: 6px;
  font-size: var(--fs-sm);
}

.rm-file-item.success {
  background: #f0fdf4;
  color: #166534;
}

.rm-file-item.warning {
  background: #fffbeb;
  color: #92400e;
}

.rm-file-item.error {
  background: #fef2f2;
  color: #b91c1c;
}

.rm-file-item span {
  margin-left: auto;
  opacity: 0.8;
  text-align: right;
}

.queue-remove-btn {
  display: inline-flex;
  width: 24px;
  height: 24px;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.08);
  color: inherit;
  cursor: pointer;
}

.file-queue-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 6px;
}

.file-password-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
}

.file-password-input-wrap {
  position: relative;
  min-width: 0;
}

.file-password-row input {
  min-width: 0;
  margin-bottom: 0 !important;
  padding-right: 40px !important;
}

.file-password-eye {
  position: absolute;
  top: 50%;
  right: 8px;
  display: inline-flex;
  width: 28px;
  height: 28px;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--clr-text-light);
  cursor: pointer;
  transform: translateY(-50%);
}

.file-password-eye:hover {
  background: var(--clr-background-alt);
  color: var(--clr-primary);
}

.file-password-row .btn {
  white-space: nowrap;
}

.hidden { display: none !important; }



.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 8px 14px;
  border: 1px solid transparent;
  border-radius: 6px;
  cursor: pointer;
  font-size: var(--fs-md);
  font-weight: 600;
}

.btn-sm { padding: 6px 10px; font-size: var(--fs-sm); }
.btn-primary { background: var(--clr-primary); color: white; }
.btn-success { background: var(--clr-success); color: white; }
.btn-secondary { background: white; border-color: var(--clr-border); color: var(--clr-text-secondary); }
.btn:disabled { cursor: not-allowed; opacity: 0.55; }

.mr-1 { margin-right: 0.25rem; }
.mr-2 { margin-right: 0.5rem; }
.text-blue-500 { color: #3b82f6; }
.text-amber-500 { color: #f59e0b; }
.text-emerald-500 { color: #10b981; }
.text-red-500 { color: #ef4444; }

</style>
