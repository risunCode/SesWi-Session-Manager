<template>
  <Transition
    name="lock-screen"
    appear
  >
    <div
      v-if="open"
      class="lock-screen"
    >
      <div class="lock-content">
        <div class="lock-icon">
          <i class="fa-solid fa-lock" />
        </div>
        <h2>SesWi is Locked</h2>
        <p>Enter your master password to unlock</p>
        <div class="lock-pwd-wrap">
          <input
            ref="passwordInput"
            v-model="password"
            :type="showPassword ? 'text' : 'password'"
            placeholder="Master password"
            autocomplete="new-password"
            autofocus
            @keydown.enter="submit"
          >
          <button
            class="lock-eye"
            type="button"
            :aria-label="showPassword ? 'Hide password' : 'Show password'"
            @click="showPassword = !showPassword"
          >
            <i :class="showPassword ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye'" />
          </button>
        </div>
        <label class="lock-remember">
          <input
            :checked="remember"
            type="checkbox"
            @change="emit('update:remember', ($event.target as HTMLInputElement).checked)"
          >
          <span>Remember for 5 minutes</span>
        </label>
        <button
          class="btn btn-primary"
          type="button"
          :disabled="busy"
          @click="submit"
        >
          <i class="fa-solid fa-unlock mr-1" />
          {{ busy ? 'Unlocking...' : 'Unlock' }}
        </button>
        <div
          v-if="error"
          class="lock-error"
        >
          {{ error }}
        </div>
        <button
          class="lock-forgot-link"
          type="button"
          @click="openForgotPage"
        >
          Forgot password?
        </button>
      </div>

      <div
        v-if="resetOpen"
        class="lock-reset-panel"
      >
        <button
          class="lock-reset-back"
          type="button"
          aria-label="Back to unlock"
          @click="closeResetPanel"
        >
          <i class="fa-solid fa-arrow-left" />
        </button>
        <h3><i class="fa-solid fa-life-ring mr-2" />Reset Password</h3>
        <p class="reset-question">
          {{ resetQuestion }}
        </p>

        <div
          v-if="resetHasRecovery && !resetVerified"
          id="resetStep1"
        >
          <input
            v-model.trim="resetAnswer"
            type="text"
            placeholder="Your answer"
            autocomplete="off"
            @keydown.enter="verifyAnswer"
          >
          <button
            class="btn btn-primary"
            type="button"
            :disabled="resetBusy"
            @click="verifyAnswer"
          >
            <i class="fa-solid fa-check mr-1" />{{ resetBusy ? 'Verifying...' : 'Verify' }}
          </button>
        </div>

        <div
          v-if="resetHasRecovery && resetVerified"
          id="resetStep2"
        >
          <div class="reset-pwd-wrap">
            <input
              v-model="resetNewPassword"
              :type="showResetNew ? 'text' : 'password'"
              placeholder="New password"
              autocomplete="new-password"
            >
            <button
              type="button"
              class="pwd-toggle-reset"
              :aria-label="showResetNew ? 'Hide password' : 'Show password'"
              @click="showResetNew = !showResetNew"
            >
              <i :class="showResetNew ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye'" />
            </button>
          </div>
          <div class="reset-pwd-wrap">
            <input
              v-model="resetConfirmPassword"
              :type="showResetConfirm ? 'text' : 'password'"
              placeholder="Confirm new password"
              autocomplete="new-password"
              @keydown.enter="resetPassword"
            >
            <button
              type="button"
              class="pwd-toggle-reset"
              :aria-label="showResetConfirm ? 'Hide password' : 'Show password'"
              @click="showResetConfirm = !showResetConfirm"
            >
              <i :class="showResetConfirm ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye'" />
            </button>
          </div>
          <button
            class="btn btn-primary"
            type="button"
            :disabled="resetBusy"
            @click="resetPassword"
          >
            <i class="fa-solid fa-key mr-1" />{{ resetBusy ? 'Resetting...' : 'Reset Password' }}
          </button>
        </div>

        <div
          v-if="resetMessage"
          class="lock-error"
          :class="{ 'lock-error--success': resetMessageKind === 'success' }"
        >
          {{ resetMessage }}
        </div>
        <p
          v-if="!resetHasRecovery"
          class="reset-no-recovery"
        >
          <i class="fa-solid fa-triangle-exclamation" />
          No recovery question was set. You cannot reset the password.
        </p>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';
import { browser } from 'wxt/browser';
import { MasterPassword } from '@features/security/crypto';

const props = defineProps<{ open: boolean; remember: boolean; busy: boolean; error: string }>();
const emit = defineEmits<{ unlock: [password: string]; 'update:remember': [value: boolean] }>();
const password = ref('');
const passwordInput = ref<HTMLInputElement | null>(null);
const showPassword = ref(false);
const resetOpen = ref(false);
const resetHasRecovery = ref(true);
const resetVerified = ref(false);
const resetBusy = ref(false);
const resetQuestion = ref('');
const resetAnswer = ref('');
const resetNewPassword = ref('');
const resetConfirmPassword = ref('');
const resetMessage = ref('');
const resetMessageKind = ref<'error' | 'success'>('error');
const showResetNew = ref(false);
const showResetConfirm = ref(false);

watch(() => props.open, (open) => {
  if (open) {
    password.value = '';
    showPassword.value = false;
    closeResetPanel();
    void nextTick(() => passwordInput.value?.focus());
  }
});

function setResetMessage(text: string, kind: 'error' | 'success' = 'error'): void {
  resetMessage.value = text;
  resetMessageKind.value = kind;
}

function resetPanelState(): void {
  resetVerified.value = false;
  resetAnswer.value = '';
  resetNewPassword.value = '';
  resetConfirmPassword.value = '';
  resetMessage.value = '';
  showResetNew.value = false;
  showResetConfirm.value = false;
}

function closeResetPanel(): void {
  resetOpen.value = false;
  resetHasRecovery.value = true;
  resetQuestion.value = '';
  resetPanelState();
}

async function openForgotPage(): Promise<void> {
  await browser.tabs.create({ url: browser.runtime.getURL('forgot-password.html') });
}

async function verifyAnswer(): Promise<void> {
  if (resetBusy.value) return;
  if (!resetAnswer.value) {
    setResetMessage('Please enter your answer');
    return;
  }
  resetBusy.value = true;
  resetMessage.value = '';
  try {
    const result = await MasterPassword.verifyRecoveryAnswer(resetAnswer.value);
    if (result.success) resetVerified.value = true;
    else setResetMessage(result.error || 'Incorrect answer');
  } finally {
    resetBusy.value = false;
  }
}

async function resetPassword(): Promise<void> {
  if (resetBusy.value) return;
  if (!resetNewPassword.value) {
    setResetMessage('Please enter a new password');
    return;
  }
  if (resetNewPassword.value !== resetConfirmPassword.value) {
    setResetMessage('Passwords do not match');
    return;
  }
  resetBusy.value = true;
  resetMessage.value = '';
  try {
    const result = await MasterPassword.resetByRecovery(resetAnswer.value, resetNewPassword.value);
    if (!result.success) {
      setResetMessage(result.error || 'Password reset failed');
      return;
    }
    setResetMessage('Password reset! All sessions cleared.', 'success');
    emit('unlock', resetNewPassword.value);
  } finally {
    resetBusy.value = false;
  }
}

function submit(): void {
  if (!password.value || props.busy) return;
  emit('unlock', password.value);
}
</script>

<style scoped>
.lock-screen {
  position: fixed;
  z-index: 9999;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%);
}

.lock-screen-enter-active,
.lock-screen-leave-active {
  transition: opacity 0.2s ease;
}

.lock-screen-enter-active .lock-content,
.lock-screen-leave-active .lock-content {
  transition: opacity 0.22s ease, transform 0.22s cubic-bezier(0.22, 1, 0.36, 1);
}

.lock-screen-enter-from,
.lock-screen-leave-to {
  opacity: 0;
}

.lock-screen-enter-from .lock-content,
.lock-screen-leave-to .lock-content {
  opacity: 0;
  transform: translateY(12px) scale(0.94);
}

.lock-content {
  max-width: 280px;
  padding: 32px;
  text-align: center;
}

.lock-icon {
  display: flex;
  width: 64px;
  height: 64px;
  align-items: center;
  justify-content: center;
  margin: 0 auto 16px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  color: #a5b4fc;
  font-size: 28px;
}

.lock-content h2 {
  margin: 0 0 8px;
  color: white;
  font-size: 18px;
}

.lock-content p {
  margin: 0 0 20px;
  color: #a5b4fc;
  font-size: 13px;
}

.lock-pwd-wrap {
  position: relative;
}

.lock-content input[type='password'],
.lock-content input[type='text'] {
  width: 100%;
  margin-bottom: 12px;
  padding: 12px 42px 12px 16px;
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.1);
  color: white;
  font-size: 14px;
  text-align: center;
}

.lock-content input::placeholder {
  color: rgba(255, 255, 255, 0.5);
}

.lock-content input:focus {
  border-color: #818cf8;
  background: rgba(255, 255, 255, 0.15);
  outline: none;
}

.lock-eye {
  position: absolute;
  top: 11px;
  right: 10px;
  display: inline-flex;
  width: 28px;
  height: 28px;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: rgba(255, 255, 255, 0.62);
  cursor: pointer;
}

.lock-eye:hover {
  background: rgba(255, 255, 255, 0.12);
  color: white;
}

.lock-content .btn {
  width: 100%;
  padding: 12px;
  border: none;
  border-radius: 8px;
  background: #6366f1;
  color: white;
  cursor: pointer;
  font-weight: 600;
}

.lock-content .btn:hover:not(:disabled) {
  background: #4f46e5;
}

.lock-content .btn:disabled {
  cursor: not-allowed;
  opacity: 0.72;
}

.lock-error {
  margin-top: 12px;
  color: #fca5a5;
  font-size: 13px;
}

.lock-remember {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin: 0 0 12px;
  color: rgba(255, 255, 255, 0.8);
  cursor: pointer;
  font-size: 13px;
}

.lock-remember input[type='checkbox'] {
  width: 16px;
  height: 16px;
  min-width: 16px;
  margin: 0;
  padding: 0;
  border: none;
  accent-color: var(--clr-violet);
  cursor: pointer;
}

.lock-remember span {
  line-height: 1;
}

.lock-remember:hover {
  color: white;
}

.lock-forgot-link {
  margin-top: 12px;
  border: none;
  background: none;
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  font-size: 12px;
}

.lock-forgot-link:hover {
  color: #c7d2fe;
}

.lock-reset-panel {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 30px;
  background: rgba(15, 23, 42, 0.97);
  animation: slide-in-right 0.25s ease-out;
}

@keyframes slide-in-right {
  from {
    opacity: 0;
    transform: translateX(20px);
  }

  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.lock-reset-back {
  position: absolute;
  top: 16px;
  left: 16px;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  color: white;
  cursor: pointer;
  font-size: 14px;
}

.lock-reset-back:hover {
  background: rgba(255, 255, 255, 0.2);
}

.lock-reset-panel h3 {
  margin: 0 0 16px;
  color: white;
  font-size: 18px;
}

.lock-reset-panel h3 i {
  color: var(--clr-violet);
}

.reset-question {
  margin: 0 0 12px;
  color: rgba(255, 255, 255, 0.9);
  font-size: 14px;
  font-style: italic;
  text-align: center;
}

.lock-reset-panel input {
  width: 100%;
  max-width: 280px;
  margin-bottom: 10px;
  padding: 12px 16px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.1);
  color: white;
  font-size: 14px;
}

.lock-reset-panel input::placeholder {
  color: rgba(255, 255, 255, 0.4);
}

.lock-reset-panel input:focus {
  border-color: var(--clr-violet);
  outline: none;
}

.lock-reset-panel .btn {
  width: 100%;
  max-width: 280px;
  margin-top: 8px;
  padding: 12px;
  border: none;
  border-radius: 8px;
  background: #6366f1;
  color: white;
  cursor: pointer;
  font-weight: 600;
}

.lock-reset-panel .btn:hover:not(:disabled) {
  background: #4f46e5;
}

.lock-reset-panel .btn:disabled {
  cursor: not-allowed;
  opacity: 0.72;
}

.reset-no-recovery {
  margin-top: 16px;
  color: #fbbf24;
  font-size: 13px;
  text-align: center;
}

.reset-no-recovery i {
  margin-right: 6px;
}

#resetStep1,
#resetStep2 {
  display: flex;
  width: 100%;
  max-width: 280px;
  flex-direction: column;
  align-items: center;
}

.reset-pwd-wrap {
  position: relative;
  width: 100%;
  margin-bottom: 10px;
}

.reset-pwd-wrap input {
  width: 100%;
  padding-right: 44px;
}

.pwd-toggle-reset {
  position: absolute;
  top: 50%;
  right: 10px;
  padding: 4px;
  border: none;
  background: none;
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  font-size: 14px;
  transform: translateY(-50%);
}

.pwd-toggle-reset:hover {
  color: rgba(255, 255, 255, 0.8);
}

.lock-error--success {
  color: #4ade80;
}
</style>
