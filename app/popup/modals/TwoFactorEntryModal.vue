<template>
  <ModalBase
    :open="open"
    :title="entry ? 'Edit 2FA Entry' : 'Add 2FA Entry'"
    icon="fa-solid fa-shield"
    @close="emit('close')"
  >
    <div class="sw-form-stack">
      <input
        v-model.trim="issuer"
        class="sw-field"
        type="text"
        placeholder="Issuer"
      >
      <input
        v-model.trim="accountName"
        class="sw-field"
        type="text"
        placeholder="Account name"
      >
      <input
        v-model.trim="secret"
        class="sw-field"
        type="text"
        placeholder="Secret or OTPAuth URI"
      >
      <div class="sw-option-row">
        <input
          v-model.number="digits"
          class="sw-field"
          type="number"
          min="6"
          max="8"
          placeholder="Digits"
        >
        <input
          v-model.number="period"
          class="sw-field"
          type="number"
          min="15"
          placeholder="Period"
        >
      </div>
      <select
        v-model="algorithm"
        class="sw-field"
      >
        <option>SHA1</option>
        <option>SHA256</option>
        <option>SHA512</option>
      </select>
    </div>
    <p
      class="sw-message"
      :class="messageClass"
    >
      {{ message || 'Enter a Base32 secret or paste an OTPAuth URI.' }}
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
        :class="{ 'sw-btn--success': actionFeedback.isSuccess('save') }"
        type="button"
        :disabled="busy || actionFeedback.isSuccess('save')"
        @click="save"
      >
        {{ actionFeedback.label('save', 'Save', busy, 'Saving…') }}
      </button>
    </template>
  </ModalBase>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import type { TwoFactorEntry } from '@features/two-factor/twoFactor.types';
import { useActionFeedback } from '../composables/useActionFeedback';
import { useModalMessage } from '../composables/useModalMessage';
import { OTPAuth, TwoFactorStorage } from '@features/two-factor/twoFactorStorage';
import ModalBase from './ModalBase.vue';

type Algorithm = 'SHA1' | 'SHA256' | 'SHA512';

const props = defineProps<{ open: boolean; entry?: TwoFactorEntry | null }>();
const emit = defineEmits<{ close: []; saved: [message?: string]; toast: [message: string] }>();

const issuer = ref('');
const accountName = ref('');
const secret = ref('');
const digits = ref(6);
const period = ref(30);
const algorithm = ref<Algorithm>('SHA1');
const busy = ref(false);
const { message, messageClass, setMessage, clearMessage } = useModalMessage();
const actionFeedback = useActionFeedback();

watch(() => [props.open, props.entry] as const, ([isOpen, entry]) => {
  if (!isOpen) return;
  issuer.value = entry?.issuer ?? '';
  accountName.value = entry?.accountName ?? '';
  secret.value = entry?.secret ?? '';
  digits.value = entry?.digits ?? 6;
  period.value = entry?.period ?? 30;
  algorithm.value = entry?.algorithm ?? 'SHA1';
  clearMessage();
}, { immediate: true });

function payload(): Omit<TwoFactorEntry, 'id' | 'createdAt'> {
  if (secret.value.startsWith('otpauth://')) {
    const parsed = OTPAuth.parseURI(secret.value);
    if (!parsed.success) throw new Error(parsed.error);
    return {
      issuer: parsed.data.issuer || issuer.value,
      accountName: parsed.data.accountName || accountName.value,
      secret: parsed.data.secret ?? '',
      digits: parsed.data.digits ?? digits.value,
      period: parsed.data.period ?? period.value,
      algorithm: (parsed.data.algorithm as Algorithm | undefined) ?? algorithm.value,
    };
  }
  return { issuer: issuer.value, accountName: accountName.value, secret: secret.value, digits: digits.value, period: period.value, algorithm: algorithm.value };
}

async function save(): Promise<void> {
  busy.value = true;
  clearMessage();
  try {
    const next = payload();
    if (!next.accountName || !next.secret) {
      setMessage('Account name and secret are required.', 'error');
      return;
    }
    const result = props.entry ? await TwoFactorStorage.update(props.entry.id, next) : await TwoFactorStorage.add(next);
    if (!result.success) {
      setMessage(result.error, 'error');
      return;
    }
    const savedMessage = props.entry ? '2FA entry updated' : '2FA entry added';
    setMessage(savedMessage, 'success');
    await actionFeedback.finish('save', 'Saved!', () => emit('saved', savedMessage));
  } catch (error) {
    setMessage(error instanceof Error ? error.message : String(error), 'error');
  } finally {
    busy.value = false;
  }
}
</script>
