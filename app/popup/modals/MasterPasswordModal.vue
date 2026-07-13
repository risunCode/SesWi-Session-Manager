<template>
  <ModalBase
    :open="open"
    title="Master Password"
    icon="fa-solid fa-shield-halved"
    panel-class="mp-modal"
    body-class="mp-modal-body"
    @close="emit('close')"
  >
    <div class="mp-stack">
      <div class="sw-modal-card mp-notice">
        <i class="fa-solid fa-circle-info" />
        <span>{{ enabled ? 'Master password is enabled. Enter it to disable protection.' : 'Encrypt sessions and 2FA secrets at rest.' }}</span>
      </div>

      <template v-if="enabled">
        <div class="mp-status-card">
          <i class="fa-solid fa-lock" />
          <span>Master Password is <strong>enabled</strong></span>
        </div>

        <section class="sw-card sw-modal-card mp-section">
          <div class="mp-section__header">
            <strong>Disable protection</strong>
            <span>Enter the current password to remove encryption from saved data.</span>
          </div>

          <label class="sw-field-label">Current password</label>
          <div class="password-field">
            <input
              v-model="currentPassword"
              class="sw-field"
              :type="showCurrentPassword ? 'text' : 'password'"
              placeholder="Current master password"
            >
            <button
              class="password-eye"
              type="button"
              :aria-label="showCurrentPassword ? 'Hide password' : 'Show password'"
              @click="showCurrentPassword = !showCurrentPassword"
            >
              <i :class="showCurrentPassword ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye'" />
            </button>
          </div>
        </section>
      </template>

      <template v-else>
        <section class="sw-card sw-modal-card mp-section">
          <div class="mp-section__header">
            <strong>Set up protection</strong>
            <span>Use a strong password to protect saved sessions and 2FA secrets.</span>
          </div>

          <label class="sw-field-label">New password</label>
          <div class="password-field">
            <input
              v-model="newPassword"
              class="sw-field"
              :type="showNewPassword ? 'text' : 'password'"
              placeholder="At least 8 chars, letters + numbers"
            >
            <button
              class="password-eye"
              type="button"
              :aria-label="showNewPassword ? 'Hide password' : 'Show password'"
              @click="showNewPassword = !showNewPassword"
            >
              <i :class="showNewPassword ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye'" />
            </button>
          </div>

          <label class="sw-field-label">Confirm password</label>
          <div class="password-field">
            <input
              v-model="confirmPassword"
              class="sw-field"
              :type="showConfirmPassword ? 'text' : 'password'"
              placeholder="Confirm password"
            >
            <button
              class="password-eye"
              type="button"
              :aria-label="showConfirmPassword ? 'Hide password' : 'Show password'"
              @click="showConfirmPassword = !showConfirmPassword"
            >
              <i :class="showConfirmPassword ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye'" />
            </button>
          </div>

          <div
            class="strength mp-strength"
            :class="strength.level"
          >
            {{ strength.text || 'Strength appears here' }}
          </div>
        </section>

        <section class="sw-card sw-modal-card recovery mp-recovery-section">
          <div class="mp-recovery-header">
            <i class="fa-solid fa-life-ring" />
            <span>Recovery Question (optional)</span>
          </div>
          <p class="mp-recovery-copy">
            Add a recovery answer if you want a way to reset the master password later.
          </p>
          <select
            v-model="recoveryQuestion"
            class="sw-field"
          >
            <option>What was your first pet's name?</option>
            <option>What city were you born in?</option>
            <option>What was your childhood nickname?</option>
          </select>
          <input
            v-model.trim="recoveryAnswer"
            class="sw-field"
            type="text"
            placeholder="Recovery answer"
          >
        </section>
      </template>
    </div>

    <p
      class="sw-modal-message"
      :class="messageClass"
    >
      {{ message }}
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
        class="sw-btn"
        :class="actionFeedback.isSuccess('submit') ? 'sw-btn--success' : enabled ? 'sw-btn--danger' : 'sw-btn--primary'"
        type="button"
        :disabled="busy || actionFeedback.isSuccess('submit')"
        @click="enabled ? disableConfirmOpen = true : submit()"
      >
        {{ actionFeedback.label('submit', enabled ? 'Disable' : 'Enable', busy, 'Working…', 'Done!') }}
      </button>
    </template>
  </ModalBase>
  <ConfirmModal
    :open="disableConfirmOpen"
    title="Disable Master Password"
    message="Disable Master Password protection? Protected data will be stored without encryption."
    confirm-text="Disable"
    @close="disableConfirmOpen = false"
    @confirm="submit"
  />
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { MasterPassword } from '@features/security/crypto';
import { setMPState } from '@features/sessions/sessionStorage';
import { useActionFeedback } from '../composables/useActionFeedback';
import { useModalMessage } from '../composables/useModalMessage';
import ConfirmModal from './ConfirmModal.vue';
import ModalBase from './ModalBase.vue';

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: []; changed: [message?: string]; toast: [message: string] }>();

const enabled = ref(false);
const busy = ref(false);
const currentPassword = ref('');
const newPassword = ref('');
const confirmPassword = ref('');
const showCurrentPassword = ref(false);
const showNewPassword = ref(false);
const showConfirmPassword = ref(false);
const disableConfirmOpen = ref(false);
const recoveryQuestion = ref("What was your first pet's name?");
const recoveryAnswer = ref('');
const { message, messageClass, setMessage, clearMessage } = useModalMessage();
const actionFeedback = useActionFeedback();
const strength = computed(() => MasterPassword.getStrength(newPassword.value));

watch(() => props.open, async (isOpen) => {
  if (!isOpen) return;
  enabled.value = await MasterPassword.isEnabled();
  currentPassword.value = '';
  newPassword.value = '';
  confirmPassword.value = '';
  recoveryQuestion.value = "What was your first pet's name?";
  recoveryAnswer.value = '';
  showCurrentPassword.value = false;
  showNewPassword.value = false;
  showConfirmPassword.value = false;
  clearMessage();
});

async function enable(): Promise<void> {
  if (newPassword.value !== confirmPassword.value) {
    setMessage('Passwords do not match.', 'error');
    return;
  }
  if (recoveryAnswer.value && recoveryAnswer.value.trim().length < 3) {
    setMessage('Recovery answer must be at least 3 characters.', 'error');
    return;
  }
  const setup = await MasterPassword.setup(newPassword.value, recoveryAnswer.value ? { question: recoveryQuestion.value, answer: recoveryAnswer.value } : undefined);
  if (!setup.success) {
    setMessage(setup.error, 'error');
    return;
  }
  const payload = await MasterPassword.decryptProtectedData(newPassword.value);
  if (payload.success) setMPState(true, newPassword.value, payload.data.sessions, payload.data.twoFactorEntries);
  setMessage('Master password enabled', 'success');
  await actionFeedback.finish('submit', 'Done!', () => emit('changed', 'Master password enabled'));
}

async function disable(): Promise<void> {
  const result = await MasterPassword.remove(currentPassword.value);
  if (!result.success) {
    setMessage(result.error, 'error');
    return;
  }
  setMPState(false, null);
  setMessage('Master password disabled', 'success');
  await actionFeedback.finish('submit', 'Done!', () => emit('changed', 'Master password disabled'));
}

async function submit(): Promise<void> {
  disableConfirmOpen.value = false;
  busy.value = true;
  clearMessage();
  try {
    if (enabled.value) await disable();
    else await enable();
  } catch (error) {
    setMessage(error instanceof Error ? error.message : String(error), 'error');
  } finally {
    busy.value = false;
  }
}
</script>

<style scoped>
.mp-modal {
  width: 360px;
  max-width: 92vw;
}

.mp-modal-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px 12px 12px;
}

.mp-stack {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.mp-notice {
  display: flex;
  gap: 10px;
  padding: 12px;
  background: #ede9fe;
  color: #5b21b6;
  font-size: 12px;
  line-height: 1.5;
}

.mp-notice i {
  flex-shrink: 0;
  margin-top: 2px;
}

.mp-status-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border: 1px solid #bbf7d0;
  border-radius: 8px;
  background: #f0fdf4;
  color: #166534;
  font-size: 13px;
}

.mp-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px;
}

.mp-section__header {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: 2px;
}

.mp-section__header strong {
  color: var(--clr-text);
  font-size: var(--fs-sm);
}

.mp-section__header span {
  color: var(--clr-text-light);
  font-size: var(--fs-xs);
  line-height: 1.45;
}

.password-field {
  position: relative;
}

.password-field .sw-field {
  margin-bottom: 0;
  padding-right: 42px;
}

.password-eye {
  position: absolute;
  top: 7px;
  right: 8px;
  display: inline-flex;
  width: 30px;
  height: 30px;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--clr-text-muted);
  cursor: pointer;
}

.password-eye:hover {
  background: var(--clr-surface-hover);
  color: var(--clr-primary);
}

.mp-strength {
  min-height: 16px;
  margin-top: -2px;
  color: var(--clr-text-light);
  font-size: 12px;
}

.strength.weak {
  color: var(--clr-danger);
}

.strength.fair {
  color: #d97706;
}

.strength.good {
  color: #059669;
}

.strength.strong {
  color: #7c3aed;
}

.mp-recovery-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border: 1px solid #fcd34d;
  background: #fef3c7;
}

.mp-recovery-header {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #92400e;
  font-size: 13px;
  font-weight: 600;
}

.mp-recovery-header i {
  color: #d97706;
}

.mp-recovery-copy {
  margin: 0;
  color: #92400e;
  font-size: 12px;
  line-height: 1.45;
}

.mp-recovery-section :deep(.sw-field) {
  margin-bottom: 0;
  border-color: #fcd34d;
}

.mp-recovery-section :deep(.sw-field:focus) {
  border-color: #f59e0b;
}
</style>
