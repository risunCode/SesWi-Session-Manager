<template>
  <ModalBase
    :open="open"
    title="Import 2FA Entries"
    icon="fa-solid fa-file-import"
    @close="emit('close')"
  >
    <section class="twofa-import__sources">
      <article class="sw-card sw-modal-card">
        <i class="fa-solid fa-shield-halved" aria-hidden="true" />
        <div><strong>Aegis Authenticator</strong><span>Plaintext or password-protected JSON export</span></div>
      </article>
      <article class="sw-card sw-modal-card">
        <i class="fa-brands fa-google" aria-hidden="true" />
        <div><strong>Google Authenticator</strong><span>Paste an account-transfer migration URI</span></div>
      </article>
      <article class="sw-card sw-modal-card">
        <i class="fa-solid fa-link" aria-hidden="true" />
        <div><strong>Bitwarden, Ente & OTPAuth</strong><span>One standard <code>otpauth://</code> URI per line</span></div>
      </article>
    </section>

    <label class="sw-dropzone twofa-import__dropzone" @click="onDropzoneClick">
      <i class="fa-solid fa-folder-open" aria-hidden="true" />
      <span>{{ fileName || 'Choose an Aegis JSON or OTPAuth text export' }}</span>
      <input v-if="!isFirefox" type="file" accept="application/json,.json,text/plain,.txt" @change="readFile">
    </label>

    <label class="twofa-import__label" for="twofa-import-text">Or paste a Google migration or OTPAuth URI</label>
    <textarea
      id="twofa-import-text"
      v-model.trim="raw"
      class="sw-field twofa-import__textarea"
      rows="3"
      placeholder="otpauth-migration://offline?data=…"
      @input="inspect"
    />

    <div v-if="preview" class="sw-card sw-modal-card twofa-import__preview">
      <template v-if="preview.passwordRequired && !entries.length">
        <strong>Aegis encrypted export detected</strong>
        <span>Enter its export password to validate and preview entries.</span>
        <input
          v-model="password"
          class="sw-field"
          type="password"
          autocomplete="current-password"
          placeholder="Aegis export password"
          @keyup.enter="unlock"
        >
        <button class="sw-btn sw-btn--secondary" type="button" :disabled="busy || !password" @click="unlock">
          {{ busy ? 'Validating…' : 'Validate Password' }}
        </button>
      </template>
      <template v-else>
        <strong>{{ previewLabel }}</strong>
        <span>{{ entries.length }} valid TOTP {{ entries.length === 1 ? 'entry' : 'entries' }} ready to import.</span>
      </template>
    </div>

    <p class="sw-message" :class="messageClass">{{ message || 'Import validates entries before anything is saved.' }}</p>
    <template #footer>
      <button class="sw-btn sw-btn--secondary" type="button" @click="emit('close')">Cancel</button>
      <button class="sw-btn sw-btn--primary" type="button" :disabled="busy || !entries.length" @click="importEntries">
        {{ busy ? 'Importing…' : `Import ${entries.length || ''} Entries` }}
      </button>
    </template>
  </ModalBase>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { TwoFactorEntry } from '@features/two-factor/twoFactor.types';
import { inspectTwoFactorImport, unlockAegisImport, type TwoFactorImportPreview } from '@features/two-factor/importFormats';
import { TwoFactorStorage } from '@features/two-factor/twoFactorStorage';
import { useFirefoxFilePicker } from '../composables/useFirefoxFilePicker';
import { useModalMessage } from '../composables/useModalMessage';
import ModalBase from './ModalBase.vue';

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: []; saved: [message?: string]; toast: [message: string] }>();

const { isFirefox, openPicker, consumePendingFiles } = useFirefoxFilePicker('application/json,.json,text/plain,.txt', false, 'twoFactorImport');

const raw = ref('');
const fileName = ref('');
const password = ref('');
const preview = ref<TwoFactorImportPreview | null>(null);
const entries = ref<TwoFactorEntry[]>([]);
const busy = ref(false);
const requestVersion = ref(0);
const { message, messageClass, setMessage, clearMessage } = useModalMessage();

const previewLabel = computed(() => {
  if (preview.value?.kind === 'aegis-json' || preview.value?.kind === 'aegis-encrypted') return 'Aegis export validated';
  if (preview.value?.kind === 'google-migration') return 'Google Authenticator migration detected';
  return 'OTPAuth URI list validated';
});

watch(() => props.open, (isOpen) => {
  if (!isOpen) return;
  requestVersion.value += 1;
  raw.value = '';
  fileName.value = '';
  password.value = '';
  preview.value = null;
  entries.value = [];
  busy.value = false;
  clearMessage();
  void consumePendingFiles().then(async (files) => {
    const file = files[0];
    if (!file) return;
    fileName.value = file.name;
    raw.value = await file.text();
  });
});

function onDropzoneClick(event: MouseEvent): void {
  if (!isFirefox) return;
  event.preventDefault();
  void openPicker();
}

function inspect(): void {
  requestVersion.value += 1;
  busy.value = false;
  password.value = '';
  entries.value = [];
  preview.value = null;
  clearMessage();
  if (!raw.value) return;
  const result = inspectTwoFactorImport(raw.value);
  if (!result.success) {
    setMessage(result.error, 'error');
    return;
  }
  preview.value = result.data;
  entries.value = result.data.entries;
}

async function readFile(event: Event): Promise<void> {
  const input = event.target;
  if (!(input instanceof HTMLInputElement) || !input.files?.[0]) return;
  const file = input.files[0];
  const version = ++requestVersion.value;
  fileName.value = file.name;
  const text = await file.text();
  if (version !== requestVersion.value) return;
  raw.value = text;
  inspect();
}

async function unlock(): Promise<void> {
  if (!raw.value || !password.value) return;
  const version = ++requestVersion.value;
  const importText = raw.value;
  const importPassword = password.value;
  busy.value = true;
  clearMessage();
  const result = await unlockAegisImport(importText, importPassword);
  if (version !== requestVersion.value || raw.value !== importText) return;
  busy.value = false;
  if (!result.success) {
    setMessage(result.error, 'error');
    return;
  }
  preview.value = result.data;
  entries.value = result.data.entries;
  setMessage(`${entries.value.length} entries validated. Review and import when ready.`, 'success');
}

async function importEntries(): Promise<void> {
  busy.value = true;
  const result = await TwoFactorStorage.importMany(entries.value, { source: preview.value?.kind });
  busy.value = false;
  if (!result.success) {
    setMessage(result.error, 'error');
    return;
  }
  const { restored, skipped, invalid } = result.data;
  const summary = `Imported ${restored} 2FA entries${skipped ? `, skipped ${skipped} duplicates` : ''}${invalid ? `, ${invalid} invalid` : ''}.`;
  setMessage(summary, 'success');
  emit('saved', summary);
}
</script>

<style scoped>
.twofa-import__sources { display: grid; gap: 6px; }
.twofa-import__sources article { display: flex; align-items: center; gap: 10px; padding: 9px 10px; }
.twofa-import__sources i { width: 20px; color: var(--clr-primary); text-align: center; }
.twofa-import__sources div { display: grid; gap: 2px; }
.twofa-import__sources span, .twofa-import__preview span { color: var(--clr-text-muted); font-size: var(--fs-xs); }
.twofa-import__dropzone { margin-top: 12px; }
.twofa-import__dropzone input { display: none; }
.twofa-import__label { display: block; margin: 12px 0 6px; color: var(--clr-text-secondary); font-size: var(--fs-xs); font-weight: 800; }
.twofa-import__textarea { resize: vertical; }
.twofa-import__preview { display: grid; gap: 8px; margin-top: 10px; }
</style>
