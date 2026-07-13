<template>
  <ModalBase
    :open="open"
    title="Scan QR Code"
    icon="fa-solid fa-camera"
    @close="emit('close')"
  >
    <div class="sw-dropzone scan-box">
      <img
        v-if="previewUrl"
        class="scan-box__preview"
        :src="previewUrl"
        alt="Captured tab preview"
      >
      <template v-else>
        <i
          class="fa-solid fa-qrcode"
          aria-hidden="true"
        />
        <p>Navigate to a page with an OTP QR code, then capture the tab.</p>
      </template>
    </div>
    <div
      v-if="detected"
      class="sw-card sw-modal-card detected-card"
    >
      <strong>{{ detected.issuer || 'Unknown issuer' }}</strong>
      <span>{{ detected.accountName }}</span>
    </div>
    <p
      class="sw-message"
      :class="messageClass"
    >
      {{ message || 'The QR code must be visible in the current tab.' }}
    </p>
    <template #footer>
      <button
        class="sw-btn sw-btn--secondary"
        type="button"
        @click="emit('close')"
      >
        Cancel
      </button>
      <button
        class="sw-btn sw-btn--primary"
        :class="{ 'sw-btn--success': actionFeedback.isSuccess('add') }"
        type="button"
        :disabled="busy || actionFeedback.isSuccess('add')"
        @click="detected ? addEntry() : scan()"
      >
        {{ detected ? actionFeedback.label('add', 'Add Entry', busy, 'Saving…') : busy ? 'Scanning…' : 'Capture Tab' }}
      </button>
    </template>
  </ModalBase>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { browser } from 'wxt/browser';
import type { OTPAuthURI } from '@features/two-factor/twoFactor.types';
import { OTPAuth, TwoFactorStorage } from '@features/two-factor/twoFactorStorage';
import { useActionFeedback } from '../composables/useActionFeedback';
import { useModalMessage } from '../composables/useModalMessage';
import ModalBase from './ModalBase.vue';

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: []; saved: [message?: string]; toast: [message: string] }>();

const previewUrl = ref('');
const detected = ref<OTPAuthURI | null>(null);
const busy = ref(false);
const { message, messageClass, setMessage, clearMessage } = useModalMessage();
const actionFeedback = useActionFeedback();

watch(() => props.open, (isOpen) => {
  if (!isOpen) return;
  previewUrl.value = '';
  detected.value = null;
  clearMessage();
});

async function imageDataFromDataUrl(dataUrl: string): Promise<ImageData> {
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas is not available');
  context.drawImage(img, 0, 0);
  return context.getImageData(0, 0, canvas.width, canvas.height);
}

async function scan(): Promise<void> {
  busy.value = true;
  clearMessage();
  try {
    const dataUrl = await browser.tabs.captureVisibleTab({ format: 'png' });
    previewUrl.value = dataUrl;
    const imageData = await imageDataFromDataUrl(dataUrl);
    const { default: jsQR } = await import('jsqr');
    const code = jsQR(imageData.data, imageData.width, imageData.height);
    if (!code) {
      setMessage('No QR code found. Zoom in or center the QR code, then try again.', 'error');
      return;
    }
    const parsed = OTPAuth.parseURI(code.data);
    if (!parsed.success) {
      setMessage(`QR decoded, but ${parsed.error}`, 'error');
      return;
    }
    detected.value = parsed.data;
    setMessage('QR code detected. Review and add the entry.', 'success');
  } catch (error) {
    setMessage(error instanceof Error ? error.message : String(error), 'error');
  } finally {
    busy.value = false;
  }
}

async function addEntry(): Promise<void> {
  if (!detected.value?.secret || !detected.value.accountName) {
    setMessage('Detected QR code is missing account or secret.', 'error');
    return;
  }
  busy.value = true;
  const result = await TwoFactorStorage.add({
    issuer: detected.value.issuer ?? '',
    accountName: detected.value.accountName,
    secret: detected.value.secret,
    algorithm: detected.value.algorithm as 'SHA1' | 'SHA256' | 'SHA512' | undefined,
    digits: detected.value.digits,
    period: detected.value.period,
  });
  busy.value = false;
  if (!result.success) {
    setMessage(result.error, 'error');
    return;
  }
  setMessage('2FA entry added', 'success');
  await actionFeedback.finish('add', 'Saved!', () => emit('saved', '2FA entry added'));
}
</script>

<style scoped>
.scan-box {
  min-height: 160px;
}

.scan-box i {
  color: var(--clr-primary);
  font-size: 40px;
}

.scan-box__preview {
  max-width: 100%;
  max-height: 180px;
  border-radius: var(--radius-md);
  object-fit: contain;
}

.detected-card {
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin-top: 8px;
}
</style>
