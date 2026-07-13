<template>
  <main class="forgot-page">
    <section class="recovery-shell">
      <aside class="recovery-hero">
        <div class="brand-lockup">
          <span class="brand-mark"><i class="fa-solid fa-cookie-bite" /></span>
          <div>
            <strong>SesWi</strong>
            <span>Password recovery</span>
          </div>
        </div>

        <div class="hero-copy">
          <p class="eyebrow">
            Master Password
          </p>
          <h1>Recover your SesWi vault.</h1>
          <p>
            Use your recovery question to set a new master password. SesWi clears encrypted sessions after recovery for safety.
          </p>
        </div>

        <div class="hero-actions">
          <div class="safety-card">
            <i class="fa-solid fa-shield-halved" />
            <span>Recovery never reveals the old password.</span>
          </div>
          <div class="danger-card">
            <div>
              <strong>Forgot your password?</strong>
              <span>You can reset SesWi, but all saved data will be cleaned.</span>
            </div>
            <button
              type="button"
              @click="resetConfirmOpen = true"
            >
              Reset app data
            </button>
          </div>
        </div>
      </aside>

      <section class="recovery-panel">
        <div class="panel-chrome">
          <span class="dot red" />
          <span class="dot yellow" />
          <span class="dot green" />
        </div>

        <template v-if="loading">
          <div class="center-state">
            <span class="loader" />
            <h2>Checking recovery setup</h2>
            <p>Looking for your recovery question.</p>
          </div>
        </template>

        <template v-else-if="!hasRecovery">
          <div class="center-state warning">
            <i class="fa-solid fa-triangle-exclamation" />
            <h2>No recovery question</h2>
            <p>Recovery was not configured, so this password cannot be reset here.</p>
          </div>
        </template>

        <template v-else-if="done">
          <div class="center-state success">
            <i class="fa-solid fa-circle-check" />
            <h2>Password reset complete</h2>
            <p>Your master password was reset. Encrypted sessions were cleared for safety.</p>
            <button
              class="primary-action"
              type="button"
              @click="window.close()"
            >
              Close page
            </button>
          </div>
        </template>

        <template v-else>
          <p class="panel-eyebrow">
            {{ step === 'answer' ? 'Step 1 of 2' : 'Step 2 of 2' }}
          </p>
          <h2>Reset Master Password</h2>
          <p class="question">
            {{ question }}
          </p>

          <div
            v-if="step === 'answer'"
            class="form-stack"
          >
            <label>
              <span>Your answer</span>
              <input
                v-model.trim="answer"
                type="text"
                autocomplete="off"
                placeholder="Type your recovery answer"
                @keydown.enter="verifyAnswer"
              >
            </label>
            <button
              class="primary-action"
              type="button"
              :disabled="busy"
              @click="verifyAnswer"
            >
              <i class="fa-solid fa-check" />
              {{ busy ? 'Verifying...' : 'Verify answer' }}
            </button>
          </div>

          <div
            v-else
            class="form-stack"
          >
            <label>
              <span>New password</span>
              <div class="password-wrap">
                <input
                  v-model="newPassword"
                  :type="showNew ? 'text' : 'password'"
                  autocomplete="new-password"
                  placeholder="At least 8 chars, letters + numbers"
                >
                <button
                  type="button"
                  :aria-label="showNew ? 'Hide password' : 'Show password'"
                  @click="showNew = !showNew"
                >
                  <i :class="showNew ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye'" />
                </button>
              </div>
            </label>
            <label>
              <span>Confirm password</span>
              <div class="password-wrap">
                <input
                  v-model="confirmPassword"
                  :type="showConfirm ? 'text' : 'password'"
                  autocomplete="new-password"
                  placeholder="Confirm new password"
                  @keydown.enter="resetPassword"
                >
                <button
                  type="button"
                  :aria-label="showConfirm ? 'Hide password' : 'Show password'"
                  @click="showConfirm = !showConfirm"
                >
                  <i :class="showConfirm ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye'" />
                </button>
              </div>
            </label>
            <button
              class="primary-action"
              type="button"
              :disabled="busy"
              @click="resetPassword"
            >
              <i class="fa-solid fa-key" />
              {{ busy ? 'Resetting...' : 'Reset password' }}
            </button>
          </div>

          <p
            v-if="message"
            class="message"
            :class="messageType"
          >
            {{ message }}
          </p>
        </template>
      </section>
    </section>
  </main>
  <ConfirmModal
    :open="resetConfirmOpen"
    title="Reset App Data"
    message="Reset SesWi and delete all saved sessions, 2FA entries, backups, and settings? This cannot be undone."
    confirm-text="Reset Everything"
    @close="resetConfirmOpen = false"
    @confirm="resetAppData"
  />
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { browser } from 'wxt/browser';
import ConfirmModal from '@app/popup/modals/ConfirmModal.vue';
import { MasterPassword } from '@features/security/crypto';

const loading = ref(true);
const busy = ref(false);
const resetConfirmOpen = ref(false);
const hasRecovery = ref(false);
const done = ref(false);
const question = ref('');
const answer = ref('');
const newPassword = ref('');
const confirmPassword = ref('');
const step = ref<'answer' | 'reset'>('answer');
const message = ref('');
const messageType = ref<'success' | 'error'>('error');
const showNew = ref(false);
const showConfirm = ref(false);

function setMessage(text: string, type: 'success' | 'error' = 'error'): void {
  message.value = text;
  messageType.value = type;
}

async function loadRecovery(): Promise<void> {
  loading.value = true;
  try {
    hasRecovery.value = await MasterPassword.hasRecovery();
    question.value = hasRecovery.value ? await MasterPassword.getRecoveryQuestion() ?? '' : '';
  } finally {
    loading.value = false;
  }
}

async function verifyAnswer(): Promise<void> {
  if (busy.value) return;
  if (!answer.value) {
    setMessage('Please enter your answer.');
    return;
  }
  busy.value = true;
  message.value = '';
  try {
    const result = await MasterPassword.verifyRecoveryAnswer(answer.value);
    if (!result.success) {
      setMessage(result.error || 'Incorrect answer.');
      return;
    }
    step.value = 'reset';
    setMessage('Answer verified. Choose a new password.', 'success');
  } finally {
    busy.value = false;
  }
}

async function resetAppData(): Promise<void> {
  resetConfirmOpen.value = false;
  busy.value = true;
  try {
    await browser.storage.local.clear();
    await browser.storage.session?.clear?.();
    try { localStorage.clear(); } catch { /* ignore */ }
    done.value = true;
  } finally {
    busy.value = false;
  }
}

async function resetPassword(): Promise<void> {
  if (busy.value) return;
  if (!newPassword.value) {
    setMessage('Please enter a new password.');
    return;
  }
  if (newPassword.value !== confirmPassword.value) {
    setMessage('Passwords do not match.');
    return;
  }
  busy.value = true;
  message.value = '';
  try {
    const result = await MasterPassword.resetByRecovery(answer.value, newPassword.value);
    if (!result.success) {
      setMessage(result.error || 'Password reset failed.');
      return;
    }
    done.value = true;
  } finally {
    busy.value = false;
  }
}

onMounted(() => { void loadRecovery(); });
</script>

<style scoped>
:global(html),
:global(body),
:global(#app) {
  width: 100%;
  min-width: 0;
  min-height: 100vh;
  max-height: none;
}

:global(body) {
  overflow: auto;
  background: #111827;
}

.forgot-page {
  min-height: 100vh;
  padding: clamp(18px, 4vw, 42px);
  background:
    radial-gradient(circle at 16% 10%, rgba(129, 140, 248, 0.32), transparent 31%),
    radial-gradient(circle at 84% 8%, rgba(20, 184, 166, 0.18), transparent 28%),
    linear-gradient(135deg, #1e1b4b 0%, #111827 56%, #0f172a 100%);
  color: white;
}

.recovery-shell {
  display: grid;
  grid-template-columns: minmax(0, 0.92fr) minmax(360px, 440px);
  gap: clamp(22px, 4vw, 46px);
  width: min(980px, 100%);
  min-height: calc(100vh - clamp(36px, 8vw, 84px));
  margin-inline: auto;
  align-items: center;
}

.recovery-hero {
  display: flex;
  min-height: 500px;
  flex-direction: column;
  justify-content: space-between;
}

.brand-lockup {
  display: flex;
  align-items: center;
  gap: 12px;
}

.brand-mark {
  display: grid;
  width: 46px;
  height: 46px;
  place-items: center;
  border-radius: 15px;
  background: rgba(255, 255, 255, 0.12);
  color: #a5b4fc;
  font-size: 20px;
}

.brand-lockup strong,
.brand-lockup span {
  display: block;
}

.brand-lockup strong {
  font-size: 19px;
  line-height: 1;
}

.brand-lockup span,
.hero-copy p,
.safety-card,
.center-state p {
  color: #c7d2fe;
}

.eyebrow,
.panel-eyebrow {
  margin: 0 0 10px;
  color: #5eead4;
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0.17em;
  text-transform: uppercase;
}

.hero-copy h1 {
  max-width: 620px;
  margin: 0;
  font-size: clamp(44px, 7vw, 78px);
  letter-spacing: -0.075em;
  line-height: 0.9;
}

.hero-copy p:not(.eyebrow) {
  max-width: 560px;
  margin: 20px 0 0;
  font-size: clamp(15px, 1.8vw, 18px);
  line-height: 1.55;
}

.brand-mark i {
  line-height: 1;
}

.hero-actions {
  display: grid;
  gap: 12px;
}

.safety-card {
  display: inline-flex;
  width: fit-content;
  align-items: center;
  gap: 9px;
  padding: 12px 15px;
  border: 1px solid rgba(199, 210, 254, 0.22);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.08);
  font-size: 13px;
  font-weight: 800;
}

.danger-card {
  display: grid;
  width: min(100%, 420px);
  gap: 12px;
  padding: 14px;
  border: 1px solid rgba(248, 113, 113, 0.3);
  border-radius: 18px;
  background: rgba(127, 29, 29, 0.22);
}

.danger-card strong,
.danger-card span {
  display: block;
}

.danger-card strong {
  color: #fecaca;
  font-size: 14px;
}

.danger-card span {
  margin-top: 4px;
  color: #fca5a5;
  font-size: 13px;
  line-height: 1.45;
}

.danger-card button {
  justify-self: start;
  padding: 10px 13px;
  border-radius: 12px;
  background: #dc2626;
  color: white;
  font-size: 13px;
  font-weight: 900;
}

.danger-card button:hover {
  background: #b91c1c;
}

.recovery-panel {
  position: relative;
  min-height: 500px;
  padding: clamp(22px, 4vw, 34px);
  border: 1px solid rgba(199, 210, 254, 0.24);
  border-radius: 28px;
  background: rgba(15, 23, 42, 0.8);
  box-shadow: 0 28px 74px rgba(0, 0, 0, 0.32);
  backdrop-filter: blur(20px);
}

.panel-chrome {
  display: flex;
  gap: 8px;
  margin-bottom: 30px;
}

.dot {
  width: 11px;
  height: 11px;
  border-radius: 50%;
}

.dot.red { background: #ff5f57; }
.dot.yellow { background: #ffbd2e; }
.dot.green { background: #28c840; }

.recovery-panel h2,
.center-state h2 {
  margin: 0 0 16px;
  font-size: clamp(30px, 4.2vw, 42px);
  letter-spacing: -0.05em;
  line-height: 1;
}

.question {
  margin: 0 0 22px;
  padding: 15px;
  border: 1px solid rgba(129, 140, 248, 0.28);
  border-radius: 17px;
  background: rgba(255, 255, 255, 0.08);
  color: #e0e7ff;
  font-size: 16px;
  font-style: italic;
  line-height: 1.45;
}

.form-stack {
  display: grid;
  gap: 15px;
}

label {
  display: grid;
  gap: 8px;
  color: #c7d2fe;
  font-size: 13px;
  font-weight: 900;
}

input {
  width: 100%;
  padding: 14px 15px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.1);
  color: white;
  font-size: 14px;
}

input::placeholder {
  color: rgba(255, 255, 255, 0.38);
}

input:focus {
  border-color: #818cf8;
  outline: none;
  box-shadow: 0 0 0 4px rgba(129, 140, 248, 0.16);
}

.password-wrap {
  position: relative;
}

.password-wrap input {
  padding-right: 46px;
}

.password-wrap button {
  position: absolute;
  top: 50%;
  right: 11px;
  width: 30px;
  height: 30px;
  border-radius: 8px;
  background: transparent;
  color: rgba(255, 255, 255, 0.58);
  transform: translateY(-50%);
}

.password-wrap button:hover {
  background: rgba(255, 255, 255, 0.1);
  color: white;
}

.primary-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  width: 100%;
  padding: 14px 17px;
  border-radius: 14px;
  background: linear-gradient(135deg, #6366f1, #14b8a6);
  color: white;
  font-weight: 900;
  box-shadow: 0 16px 38px rgba(99, 102, 241, 0.25);
}

.primary-action:disabled {
  cursor: not-allowed;
  opacity: 0.68;
}

.message {
  margin-top: 15px;
  padding: 12px 14px;
  border-radius: 14px;
  font-size: 13px;
  font-weight: 800;
  line-height: 1.4;
}

.message.success {
  border: 1px solid rgba(34, 197, 94, 0.35);
  background: rgba(34, 197, 94, 0.14);
  color: #86efac;
}

.message.error {
  border: 1px solid rgba(248, 113, 113, 0.35);
  background: rgba(248, 113, 113, 0.12);
  color: #fca5a5;
}

.center-state {
  display: grid;
  min-height: 360px;
  place-items: center;
  align-content: center;
  gap: 13px;
  text-align: center;
}

.center-state i {
  color: #fbbf24;
  font-size: 50px;
}

.center-state.success i {
  color: #4ade80;
}

.center-state p {
  max-width: 340px;
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
}

.loader {
  width: 42px;
  height: 42px;
  border: 3px solid rgba(255, 255, 255, 0.18);
  border-top-color: #818cf8;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 820px) {
  .forgot-page {
    padding: 16px;
  }

  .recovery-shell {
    grid-template-columns: 1fr;
    gap: 16px;
    min-height: auto;
  }

  .recovery-hero {
    min-height: auto;
    gap: 20px;
  }

  .hero-copy h1 {
    max-width: 520px;
    font-size: clamp(38px, 10vw, 56px);
  }

  .recovery-panel {
    min-height: auto;
  }
}

@media (max-width: 460px) {
  .forgot-page {
    padding: 12px;
  }

  .hero-copy h1 {
    font-size: 38px;
  }

  .safety-card,
  .danger-card {
    width: 100%;
  }

  .recovery-panel {
    padding: 18px;
    border-radius: 22px;
  }

  .recovery-panel h2,
  .center-state h2 {
    font-size: 30px;
  }
}
</style>
