<template>
  <ModalBase
    :open="open"
    title="Backup & Restore"
    icon="fa-solid fa-arrow-right-arrow-left text-blue-500"
    panel-class="br-modal__panel"
    @close="emit('close')"
  >
    <div class="modal-body">
      <div class="br-tabs">
        <button
          class="br-tab"
          :class="{ active: mode === 'export' }"
          type="button"
          @click="mode = 'export'"
        >
          <i class="fa-solid fa-download mr-1" />
          Export
        </button>
        <button
          class="br-tab"
          :class="{ active: mode === 'import' }"
          type="button"
          @click="switchToImport"
        >
          <i class="fa-solid fa-upload mr-1" />
          Import
        </button>
      </div>

      <section
        v-show="mode === 'export'"
        class="br-pane active"
      >
        <div class="br-section-label">
          <i class="fa-solid fa-file-export mr-1" />
          Format
        </div>
        <div class="modal-options">
          <button
            class="option-card"
            :class="{ selected: format === 'json' }"
            type="button"
            @click="format = 'json'"
          >
            <i class="fa-solid fa-file-code text-2xl text-amber-500" />
            <span class="option-title">JSON</span>
            <span class="option-desc">Raw</span>
          </button>
          <button
            class="option-card"
            :class="{ selected: format === 'owi' }"
            type="button"
            @click="format = 'owi'"
          >
            <i class="fa-solid fa-lock text-2xl text-violet-500" />
            <span class="option-title">OWI</span>
            <span class="option-desc">Encrypted</span>
          </button>
        </div>
        <p
          class="format-note"
          :class="format"
        >
          <i :class="format === 'owi' ? 'fa-solid fa-shield-halved' : 'fa-solid fa-triangle-exclamation'" />
          <span v-if="format === 'owi'">OWI encrypts the backup with your password. Use this for private backups or sharing between devices.</span>
          <span v-else>JSON keeps data raw and readable. Use it only for local debugging or temporary exports.</span>
        </p>

        <div class="br-section-label mt-3">
          <i class="fa-solid fa-database mr-1" />
          Include
        </div>
        <div class="include-card">
          <button
            v-for="option in exportKinds"
            :key="option.kind"
            class="include-option"
            :class="{ active: kind === option.kind }"
            type="button"
            @click="kind = option.kind"
          >
            <div class="include-option-left">
              <div
                class="option-icon-wrap"
                :class="option.iconClass"
              >
                <i :class="option.icon" />
              </div>
              <div class="include-option-text">
                <div class="option-title">
                  {{ option.title }}
                </div>
                <div class="option-desc">
                  {{ option.desc }} · {{ option.countLabel }}
                </div>
              </div>
            </div>
            <div class="include-check">
              <i class="fa-solid fa-circle-check" />
            </div>
          </button>
        </div>

        <div
          class="export-action-row"
          :class="{ 'json-row': format === 'json' }"
        >
          <div
            v-if="format === 'owi'"
            class="password-field"
          >
            <input
              v-model="password"
              :type="showExportPassword ? 'text' : 'password'"
              placeholder="Enter password for encryption"
              autocomplete="new-password"
            >
            <button
              class="password-eye"
              type="button"
              :aria-label="showExportPassword ? 'Hide password' : 'Show password'"
              @click="showExportPassword = !showExportPassword"
            >
              <i :class="showExportPassword ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye'" />
            </button>
          </div>
          <div class="export-buttons">
            <button
              class="btn btn-secondary"
              type="button"
              @click="emit('close')"
            >
              Cancel
            </button>
            <button
              class="btn btn-primary"
              :class="{ 'btn-success': actionFeedback.isSuccess('export') }"
              type="button"
              :disabled="busy || actionFeedback.isSuccess('export')"
              @click="submit"
            >
              <i class="fa-solid fa-download mr-1" />
              {{ actionFeedback.label('export', 'Create Backup', busy, 'Creating...', 'Done!') }}
            </button>
          </div>
        </div>
        <div
          class="sw-modal-message"
          :class="messageType"
        >
          {{ message }}
        </div>
        <div
          v-if="busy"
          class="sw-block-loader"
          aria-label="Working"
        >
          <span
            v-for="index in 18"
            :key="`export-${index}`"
            :style="{ animationDelay: `${index * 45}ms` }"
          />
        </div>
      </section>

      <section
        v-show="mode === 'import'"
        class="br-pane active"
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
            Drop .json, .txt, .owi, or Aegis export file(s)
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
            v-for="item in parsedImportBatch?.items ?? []"
            :key="item.id"
            class="rm-file-item"
            :class="item.status === 'invalid' ? 'error' : item.status === 'needs-password' ? 'warning' : 'success'"
          >
            <i :class="item.detectedKind === 'owi-backup' || item.detectedKind === 'aegis-backup' ? 'fa-solid fa-lock' : 'fa-solid fa-file-code'" />
            {{ item.name }}
            <span>{{ item.status === 'ready' ? `${item.payload?.data.sessions.length ?? 0} sessions · ${item.payload?.data.twoFactorEntries.length ?? 0} 2FA` : item.error }}</span>
            <button
              class="queue-remove-btn"
              type="button"
              aria-label="Remove file"
              @click="removeQueuedFile(item.id)"
            >
              <i class="fa-solid fa-xmark" />
            </button>
          </div>
        </div>

        <div
          v-for="item in parsedImportBatch?.items.filter((entry) => entry.requiresPassword && entry.status !== 'ready') ?? []"
          :key="`${item.id}-password`"
          class="password-row"
        >
          <div class="password-field">
            <input
              v-model="filePasswords[item.id]"
              :type="showImportPassword ? 'text' : 'password'"
              :placeholder="`Password for ${item.name}`"
            >
            <button
              class="password-eye"
              type="button"
              :aria-label="showImportPassword ? 'Hide password' : 'Show password'"
              @click="showImportPassword = !showImportPassword"
            >
              <i :class="showImportPassword ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye'" />
            </button>
          </div>
        </div>

        <div
          v-if="fileQueue.length"
          class="import-preview"
          :class="{ invalid: hasImportQueueBlockers }"
        >
          <i :class="hasImportQueueBlockers ? 'fa-solid fa-circle-xmark text-red-500' : 'fa-solid fa-circle-check text-emerald-500'" />
          <span>{{ importPreviewLabel }}</span>
        </div>

        <div
          v-if="fileQueue.length"
          class="queue-actions"
        >
          <button
            class="btn btn-primary px-4"
            type="button"
            :disabled="busy"
            @click="verifyImportFile"
          >
            <i class="fa-solid fa-check mr-1" />
            Review Queue
          </button>
        </div>

        <div class="br-restore-options mt-3">
          <div class="br-section-label">
            <i class="fa-solid fa-rotate-left mr-1" />
            Restore
          </div>
          <label class="checkbox-label">
            <input
              v-model="restoreSessions"
              type="checkbox"
            >
            <span>Sessions</span>
          </label>
          <label class="checkbox-label">
            <input
              v-model="restoreTwoFactor"
              type="checkbox"
            >
            <span>2FA entries</span>
          </label>
        </div>

        <div
          class="sw-modal-message"
          :class="messageType"
        >
          {{ message }}
        </div>
        <div
          v-if="busy"
          class="sw-block-loader"
          aria-label="Working"
        >
          <span
            v-for="index in 18"
            :key="`import-${index}`"
            :style="{ animationDelay: `${index * 45}ms` }"
          />
        </div>
        <div class="br-action">
          <button
            class="btn btn-primary"
            :class="{ 'btn-success': actionFeedback.isSuccess('import') }"
            type="button"
            :disabled="busy || actionFeedback.isSuccess('import')"
            @click="submit"
          >
            <i class="fa-solid fa-upload mr-1" />
            {{ actionFeedback.label('import', 'Restore', busy, 'Restoring...', 'Done!') }}
          </button>
        </div>
      </section>
    </div>
  </ModalBase>
  <ConfirmModal
    :open="restoreConfirmOpen"
    title="Restore Backup"
    message="Restore the selected backup data? Existing saved sessions or 2FA entries may be overwritten."
    confirm-text="Restore"
    @close="restoreConfirmOpen = false"
    @confirm="confirmRestore"
  />
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Backup } from '@features/backup/backup';
import type { BackupPayload } from '@features/backup/backup.types';
import { createImportSourcesFromFiles, mergeImportPayloads, parseImportSources, summarizeBatchResult } from '@features/backup/import';
import type { BatchParseResult, ImportSourceItem } from '@features/import/import.types';
import { Crypto } from '@features/security/crypto';
import { SessionStorage } from '@features/sessions/sessionStorage';
import { TwoFactorStorage } from '@features/two-factor/twoFactorStorage';
import { DOM } from '@shared/dom';
import { useActionFeedback } from '../composables/useActionFeedback';
import { useFirefoxFilePicker } from '../composables/useFirefoxFilePicker';
import ConfirmModal from './ConfirmModal.vue';
import ModalBase from './ModalBase.vue';
import { useModalMessage } from '../composables/useModalMessage';

type BackupKind = 'all' | 'sessions' | 'twoFactor';
type BackupFormat = 'json' | 'owi';
type BackupMode = 'export' | 'import';

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: []; changed: [message?: string]; toast: [message: string] }>();

const { isFirefox, openPicker, consumePendingFiles } = useFirefoxFilePicker('.json,.txt,.owi', true, 'backupRestore');

const mode = ref<BackupMode>('export');
const format = ref<BackupFormat>('owi');
const kind = ref<BackupKind>('all');
const password = ref('');
const showExportPassword = ref(false);
const showImportPassword = ref(false);
const fileQueue = ref<ImportSourceItem[]>([]);
const parsedImportBatch = ref<BatchParseResult | null>(null);
const filePasswords = ref<Record<string, string>>({});
const fileDragOver = ref(false);
const restoreSessions = ref(true);
const restoreTwoFactor = ref(true);
const availableSessions = ref(0);
const availableTwoFactor = ref(0);
const busy = ref(false);
const restoreConfirmOpen = ref(false);
const { message, messageType, setMessage, clearMessage } = useModalMessage();
const actionFeedback = useActionFeedback();

const exportKinds = computed(() => [
  { kind: 'all' as const, title: 'All Data', desc: 'Sessions + 2FA', icon: 'fa-solid fa-layer-group', iconClass: 'option-icon--all', countLabel: `${availableSessions.value} sessions · ${availableTwoFactor.value} 2FA` },
  { kind: 'sessions' as const, title: 'Sessions', desc: 'Cookies & storage', icon: 'fa-solid fa-cookie', iconClass: 'option-icon--sessions', countLabel: `${availableSessions.value} sessions` },
  { kind: 'twoFactor' as const, title: '2FA Entries', desc: 'TOTP secrets', icon: 'fa-solid fa-shield-halved', iconClass: 'option-icon--2fa', countLabel: `${availableTwoFactor.value} 2FA entries` },
]);
const importPreviewLabel = computed(() => parsedImportBatch.value ? summarizeBatchResult(parsedImportBatch.value) : `${fileQueue.value.length} file${fileQueue.value.length === 1 ? '' : 's'} loaded`);
const hasImportQueueBlockers = computed(() => Boolean(parsedImportBatch.value && (parsedImportBatch.value.summary.invalid > 0 || parsedImportBatch.value.summary.passwordRequired > 0)));

watch(() => props.open, (open) => {
  if (!open) return;
  mode.value = 'export';
  format.value = 'owi';
  kind.value = 'all';
  password.value = '';
  showExportPassword.value = false;
  showImportPassword.value = false;
  fileQueue.value = [];
  parsedImportBatch.value = null;
  filePasswords.value = {};
  restoreSessions.value = true;
  restoreTwoFactor.value = true;
  clearMessage();
  void refreshCounts();
  void consumePendingFiles().then((files) => { if (files.length) { mode.value = 'import'; processDroppedFiles(files); } });
}, { immediate: true });

watch([mode, format, kind], () => clearMessage());

async function refreshCounts(): Promise<void> {
  const sessions = await SessionStorage.getAll();
  const twoFactor = await TwoFactorStorage.getAll();
  availableSessions.value = sessions.success ? sessions.data.length : 0;
  availableTwoFactor.value = twoFactor.success ? twoFactor.data.length : 0;
}

async function queueFiles(files: FileList | File[] | null | undefined): Promise<void> {
  if (!files || !files.length) return;
  const sources = await createImportSourcesFromFiles(files);
  fileQueue.value = [...fileQueue.value, ...sources];
  clearMessage();
  await reviewImportQueue();
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

function switchToImport(): void {
  mode.value = 'import';
}

async function processDroppedFiles(files: File[]): Promise<void> {
  await queueFiles(files);
  await reviewImportQueue();
  await nextTick();
  const firstPw = document.querySelector<HTMLInputElement>('.password-row .password-field input');
  firstPw?.focus();
}

async function reviewImportQueue(): Promise<BatchParseResult | null> {
  if (!fileQueue.value.length) {
    parsedImportBatch.value = null;
    return null;
  }
  const result = await parseImportSources(fileQueue.value, { passwords: filePasswords.value });
  parsedImportBatch.value = result;
  return result;
}

function removeQueuedFile(id: string): void {
  fileQueue.value = fileQueue.value.filter((item) => item.id !== id);
  delete filePasswords.value[id];
  void reviewImportQueue();
}

async function verifyImportFile(): Promise<void> {
  const result = await reviewImportQueue();
  if (!result) {
    setMessage('Select file(s) first', 'error');
    return;
  }
  if (result.summary.passwordRequired > 0) {
    setMessage('Enter passwords for all encrypted files first', 'error');
    return;
  }
  if (result.summary.invalid > 0) {
    setMessage('Remove or fix invalid files before importing', 'error');
    return;
  }
  setMessage(`Verified! ${summarizeBatchResult(result)}`, 'success');
}

function ensureExportHasData(payload: BackupPayload): boolean {
  const sessionCount = payload.data.sessions.length;
  const twoFactorCount = payload.data.twoFactorEntries.length;
  const emptyLabel = kind.value === 'sessions' ? 'No sessions to export'
    : kind.value === 'twoFactor' ? 'No 2FA entries to export'
      : 'No sessions or 2FA entries to export';
  if (kind.value === 'all' && !sessionCount && !twoFactorCount) {
    setMessage(emptyLabel, 'error');
    return false;
  }
  if (kind.value === 'sessions' && !sessionCount) {
    setMessage(emptyLabel, 'error');
    return false;
  }
  if (kind.value === 'twoFactor' && !twoFactorCount) {
    setMessage(emptyLabel, 'error');
    return false;
  }
  return true;
}

async function exportBackup(): Promise<void> {
  const payloadResult = await Backup.createPayload(kind.value);
  if (!payloadResult.success) {
    setMessage(payloadResult.error, 'error');
    return;
  }
  if (!ensureExportHasData(payloadResult.data)) return;
  const sessionCount = payloadResult.data.data.sessions.length;
  const twoFactorCount = payloadResult.data.data.twoFactorEntries.length;
  const label = kind.value === 'sessions' ? `${sessionCount} sessions`
    : kind.value === 'twoFactor' ? `${twoFactorCount} 2FA entries`
      : `${sessionCount} sessions and ${twoFactorCount} 2FA entries`;
  const filename = kind.value === 'sessions' ? 'sessions-backup'
    : kind.value === 'twoFactor' ? 'twofactor-backup'
      : 'seswi-backup';
  if (format.value === 'owi') {
    if (!password.value.trim()) {
      setMessage('Password required', 'error');
      return;
    }
    const result = await Crypto.exportOWI(payloadResult.data, password.value, filename);
    if (!result.success) {
      setMessage(result.error, 'error');
      return;
    }
    setMessage(`Exported ${label} (encrypted)`, 'success');
  } else {
    DOM.downloadFile(Backup.exportJSON(payloadResult.data), `${filename}.json`, 'application/json');
    setMessage(`Exported ${label}`, 'success');
  }
  await actionFeedback.finish('export', 'Done!', () => {
    emit('toast', 'Backup created');
    emit('close');
  });
}

async function importBackup(): Promise<void> {
  if (!fileQueue.value.length) {
    setMessage('No backup data loaded — select file(s) first', 'error');
    return;
  }
  const parsed = await reviewImportQueue();
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
  const payload = mergeImportPayloads(parsed.items.filter((item) => item.status === 'ready' && item.payload));
  const result = await Backup.restorePayload(payload, { restoreSessions: restoreSessions.value, restoreTwoFactor: restoreTwoFactor.value });
  if (!result.success) {
    setMessage(result.error, 'error');
    return;
  }
  const restored = result.data.restoredSessions + result.data.restoredTwoFactorEntries;
  const restoredMessage = `Restored ${restored} item${restored === 1 ? '' : 's'}`;
  setMessage(restoredMessage, 'success');
  await actionFeedback.finish('import', 'Done!', () => emit('changed', restoredMessage));
}

async function submit(): Promise<void> {
  if (mode.value === 'import') {
    restoreConfirmOpen.value = true;
    return;
  }
  busy.value = true;
  clearMessage();
  try {
    await exportBackup();
  } catch (error) {
    setMessage(error instanceof Error ? error.message : String(error), 'error');
  } finally {
    busy.value = false;
  }
}

async function confirmRestore(): Promise<void> {
  restoreConfirmOpen.value = false;
  busy.value = true;
  clearMessage();
  try {
    await importBackup();
  } catch (error) {
    setMessage(error instanceof Error ? error.message : String(error), 'error');
  } finally {
    busy.value = false;
  }
}
</script>

<style scoped>
.br-modal__panel {
  width: 360px;
  max-width: 92vw;
  max-height: calc(100vh - 32px);
}

.modal-body {
  max-height: calc(100vh - 88px);
  overflow-y: auto;
  padding: 8px 10px 10px;
}

.br-tabs {
  display: flex;
  gap: 4px;
  padding: 4px;
  margin-bottom: 6px;
  border-radius: 8px;
  background: var(--clr-background-alt);
}

.br-tab {
  flex: 1;
  padding: 6px 10px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--clr-text-muted);
  cursor: pointer;
  font-size: var(--fs-sm);
  font-weight: 500;
  transition: all 0.2s;
}

.br-tab.active {
  background: white;
  color: var(--clr-text);
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.br-section-label {
  margin-bottom: 4px;
  color: var(--clr-text-muted);
  font-size: var(--fs-xs);
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.modal-options {
  display: flex;
  gap: 8px;
  margin-bottom: 6px;
}

.option-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 8px 10px;
  border: 2px solid #e5e7eb;
  border-radius: 10px;
  background: var(--clr-surface);
  cursor: pointer;
  transition: all 0.2s ease;
}

.option-card.selected {
  border-color: var(--clr-success);
  background: #ecfdf5;
  box-shadow: 0 0 0 2px rgba(16,185,129,0.15) inset;
}

.option-title { color: #111827; font-size: var(--fs-md); font-weight: 600; }
.option-desc { color: var(--clr-text-muted); font-size: var(--fs-xs); }

.format-note {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  padding: 6px 8px;
  margin-bottom: 7px;
  border: 1px solid #fde68a;
  border-radius: 6px;
  background: #fffbeb;
  color: #92400e;
  font-size: var(--fs-xs);
  line-height: 1.35;
}

.format-note.owi {
  border-color: #bbf7d0;
  background: #f0fdf4;
  color: #166534;
}

.include-card {
  overflow: hidden;
  margin-bottom: 8px;
  border: 1.5px solid var(--clr-border);
  border-radius: 10px;
  background: var(--clr-surface);
  box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
}

.include-option {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  padding: 7px 10px;
  border: none;
  border-bottom: 1px solid var(--clr-border);
  background: none;
  cursor: pointer;
  font: inherit;
  text-align: left;
}

.include-option:last-child { border-bottom: none; }
.include-option.active { background: #ecfdf5; }
.include-option-left { display: flex; min-width: 0; align-items: center; gap: 8px; }
.option-icon-wrap { width: 28px; height: 28px; display: flex; flex-shrink: 0; align-items: center; justify-content: center; border-radius: 6px; font-size: 13px; }
.option-icon--all { background: #dbeafe; color: var(--clr-primary-hover); }
.option-icon--sessions { background: #fef3c7; color: #d97706; }
.option-icon--2fa { background: #d1fae5; color: #059669; }
.include-option-text { min-width: 0; }
.include-option-text .option-title { color: var(--clr-text); font-size: var(--fs-sm); }
.include-option-text .option-desc { color: #6b7280; font-size: var(--fs-xs); }
.include-check { flex-shrink: 0; color: transparent; font-size: 18px; }
.include-option.active .include-check { color: var(--clr-success); }

.export-action-row {
  display: grid;
  gap: 7px;
}

.export-action-row.json-row {
  display: flex;
  justify-content: flex-end;
}

.export-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.password-field {
  position: relative;
  min-width: 0;
}

.password-field input {
  width: 100%;
  height: 100%;
  min-height: 34px;
  padding: 7px 34px 7px 10px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
}

.password-eye {
  position: absolute;
  top: 50%;
  right: 8px;
  transform: translateY(-50%);
  color: var(--clr-text-light);
  background: transparent;
}

.password-eye:hover {
  color: var(--clr-primary);
}

.dropzone {
  display: flex;
  min-height: 82px;
  align-items: center;
  justify-content: center;
  padding: 16px;
  margin-bottom: 8px;
  border: 2px dashed #cbd5e1;
  border-radius: 10px;
  background: var(--clr-background);
  color: var(--clr-text-secondary);
  cursor: pointer;
  font-size: var(--fs-base);
  text-align: center;
}

.dropzone:hover,
.dropzone.dragover { border-color: var(--clr-primary); background: #eff6ff; }
.rm-file-list { display: flex; flex-direction: column; gap: 6px; max-height: 156px; margin-bottom: 8px; overflow-y: auto; }
.rm-file-item { display: flex; align-items: center; gap: 8px; padding: 7px 8px; border-radius: 6px; font-size: var(--fs-sm); }
.rm-file-item.success { background: #f0fdf4; color: #166534; }
.rm-file-item.warning { background: #fffbeb; color: #92400e; }
.rm-file-item.error { background: #fef2f2; color: #b91c1c; }
.rm-file-item span { margin-left: auto; opacity: 0.8; text-align: right; }
.queue-remove-btn { display: inline-flex; width: 24px; height: 24px; align-items: center; justify-content: center; border: none; border-radius: 999px; background: rgba(15, 23, 42, 0.08); color: inherit; cursor: pointer; }
.password-row { display: grid; grid-template-columns: minmax(0, 1fr); gap: 8px; }
.password-row .password-field { min-width: 0; }
.queue-actions { display: flex; justify-content: flex-end; margin-top: 6px; }

.br-restore-options {
  padding: 7px 8px;
  border: 1px solid var(--clr-border);
  border-radius: 8px;
  background: var(--clr-background);
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 3px 0;
  color: var(--clr-text-secondary);
}

.br-action { margin-top: 8px; text-align: right; }

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 7px 12px;
  border: 1px solid transparent;
  border-radius: 6px;
  cursor: pointer;
  font-size: var(--fs-md);
  font-weight: 600;
}
.btn-primary { background: var(--clr-primary); color: white; }
.btn-success { background: var(--clr-success); color: white; }
.btn-secondary { background: white; border-color: var(--clr-border); color: var(--clr-text-secondary); }
.btn:disabled { cursor: not-allowed; opacity: 0.55; }
.hidden { display: none !important; }
.mr-1 { margin-right: 0.25rem; }
.mr-2 { margin-right: 0.5rem; }
.mt-3 { margin-top: 0.75rem; }
.px-4 { padding-left: 1rem; padding-right: 1rem; }
.text-2xl { font-size: 1.5rem; line-height: 2rem; }
.text-blue-500 { color: #3b82f6; }
.text-amber-500 { color: #f59e0b; }
.text-violet-500 { color: #8b5cf6; }

</style>
