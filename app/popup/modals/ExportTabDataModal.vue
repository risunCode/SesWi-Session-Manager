<template>
  <ModalBase
    :open="open"
    title="Export This Tab"
    icon="fa-solid fa-bolt"
    size="lg"
    panel-class="qa-modal"
    body-class="qa-modal-body"
    @close="emit('close')"
  >
    <div class="qa-desc-row">
      <i
        class="fa-solid fa-circle-info text-slate-400"
        aria-hidden="true"
      />
      <span>Export current-tab cookies without saving a session.</span>
    </div>

    <div class="qa-export-grid">
      <button
        class="qa-export-btn"
        type="button"
        :class="{ 'qa-export-btn--success': actionFeedback.isSuccess('json') }"
        :disabled="busy || actionFeedback.isSuccess('json')"
        @click="copyJSON"
      >
        <span class="qa-export-icon qa-icon--copy">
          <i class="fa-solid fa-clipboard" />
        </span>
        <span class="qa-export-text">
          <span class="qa-export-title">{{ actionFeedback.label('json', 'Copy JSON Compatible', busy, 'Copying…', 'Copied!') }}</span>
          <span class="qa-export-desc">Raw Cookie Editor-compatible JSON</span>
        </span>
      </button>
      <button
        class="qa-export-btn"
        type="button"
        :class="{ 'qa-export-btn--success': actionFeedback.isSuccess('netscape') }"
        :disabled="busy || actionFeedback.isSuccess('netscape')"
        @click="exportFormat('netscape')"
      >
        <span class="qa-export-icon qa-icon--netscape">
          <i class="fa-solid fa-file-lines" />
        </span>
        <span class="qa-export-text">
          <span class="qa-export-title">{{ actionFeedback.label('netscape', 'Export Netscape File', busy, 'Exporting…', 'Done!') }}</span>
          <span class="qa-export-desc">Browser-compatible format</span>
        </span>
      </button>
    </div>

    <div
      v-if="message"
      class="sw-modal-message"
      :class="messageType"
    >
      {{ message }}
    </div>

    <template #footer>
      <button
        class="sw-btn sw-btn--secondary"
        type="button"
        @click="emit('close')"
      >
        Close
      </button>
    </template>
  </ModalBase>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { CurrentTabSnapshot } from '@features/sessions/currentTabSnapshot';
import { Export } from '@features/sessions/exportSession';
import { DOM } from '@shared/dom';
import { Normalize } from '@shared/normalize';
import { useActionFeedback } from '../composables/useActionFeedback';
import { useModalMessage } from '../composables/useModalMessage';
import ModalBase from './ModalBase.vue';

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: []; toast: [message: string] }>();

type ExportFormat = 'netscape';

const busy = ref(false);
const { message, messageType, setMessage, clearMessage } = useModalMessage();
const actionFeedback = useActionFeedback();

watch(() => props.open, (open) => {
  if (!open) {
    busy.value = false;
    clearMessage();
  }
});

async function collect() {
  busy.value = true;
  setMessage('Collecting...');
  const result = await CurrentTabSnapshot.collect();
  busy.value = false;
  if (!result.success) setMessage(result.error, 'error');
  return result;
}

async function copyJSON(): Promise<void> {
  const result = await collect();
  if (!result.success) return;
  const normalizedCookies = Normalize.cookies(result.data.cookies, result.data.domain);
  if (!normalizedCookies.length) {
    setMessage('No cookies found for this tab.', 'error');
    return;
  }
  await navigator.clipboard.writeText(Export.toCookieEditor(normalizedCookies));
  setMessage('Cookie Editor-compatible JSON copied!', 'success');
  await actionFeedback.finish('json', 'Copied!', () => emit('toast', 'Copied compatible cookie JSON'));
}

async function exportFormat(format: ExportFormat): Promise<void> {
  const result = await collect();
  if (!result.success) return;
  const { cookies, domain } = result.data;
  if (!cookies.length) {
    setMessage('No cookies found for this tab.', 'error');
    return;
  }
  const normalizedCookies = Normalize.cookies(cookies, domain);
  DOM.downloadFile(Export.toNetscape(normalizedCookies), `${domain}_cookies_netscape.txt`, 'text/plain');
  await actionFeedback.finish(format, 'Done!', () => {
    emit('toast', 'Tab cookies exported');
    emit('close');
  });
}
</script>

<style scoped>
.qa-modal {
  width: 360px;
  max-width: 92vw;
}

.qa-modal-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
}

.qa-desc-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid var(--clr-border);
  border-radius: 8px;
  background: var(--clr-background);
  color: var(--clr-text-muted);
  font-size: var(--fs-sm);
}

.qa-export-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.qa-export-btn {
  display: flex;
  min-height: 76px;
  align-items: center;
  gap: 9px;
  padding: 10px;
  border: 1px solid var(--clr-border);
  border-radius: 9px;
  background: white;
  color: inherit;
  cursor: pointer;
  text-align: left;
  transition: all 0.15s ease;
}

.qa-export-btn:hover:not(:disabled) {
  border-color: #14b8a6;
  background: #f8fafc;
  transform: translateY(-1px);
}

.qa-export-btn:disabled {
  cursor: not-allowed;
  opacity: 0.65;
}

.qa-export-btn--success {
  border-color: var(--clr-success) !important;
  background: #ecfdf5 !important;
}

.qa-export-icon {
  display: flex;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  font-size: var(--fs-lg);
}

.qa-icon--copy { background: #dcfce7; color: #16a34a; }
.qa-icon--netscape { background: #fef3c7; color: #d97706; }

.qa-export-text {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.qa-export-title {
  color: var(--clr-text);
  font-size: var(--fs-sm);
  font-weight: 800;
}

.qa-export-desc {
  color: var(--clr-text-muted);
  font-size: var(--fs-xs);
  line-height: 1.25;
}


</style>
