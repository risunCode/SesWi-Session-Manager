<template>
  <ModalBase
    :open="open"
    title="Tips & Shortcuts"
    icon="fa-solid fa-lightbulb"
    size="md"
    body-class="tips-modal-body"
    @close="emit('close')"
  >
    <div class="tips-intro">
      <i
        class="fa-solid fa-wand-magic-sparkles"
        aria-hidden="true"
      />
      <p>Move around SesWi faster and keep the right tool close at hand.</p>
    </div>

    <section class="tips-section">
      <div class="tips-section__heading">
        <div>
          <span>Keyboard Shortcuts</span>
          <small>Popup shortcuts work while SesWi is open</small>
        </div>
      </div>

      <div class="shortcut-list">
        <article class="shortcut-row">
          <div class="shortcut-row__keys">
            <kbd>Ctrl</kbd><span>+</span><kbd>N</kbd>
          </div>
          <div class="shortcut-row__copy">
            <strong>Add Session</strong>
            <span>Open the session capture and import modal.</span>
          </div>
          <span class="shortcut-scope">Popup</span>
        </article>

        <article class="shortcut-row">
          <div class="shortcut-row__keys">
            <kbd>Ctrl</kbd><span>+</span><kbd>X</kbd><span>×2</span>
          </div>
          <div class="shortcut-row__copy">
            <strong>Fast Clean</strong>
            <span>First press opens cleanup; press again within two seconds to run it.</span>
          </div>
          <span class="shortcut-scope">Popup</span>
        </article>

        <article class="shortcut-row">
          <div class="shortcut-row__keys">
            <kbd>Ctrl</kbd><span>+</span><kbd>D</kbd>
          </div>
          <div class="shortcut-row__copy">
            <strong>Fast Lock</strong>
            <span>Lock SesWi immediately when Master Password is enabled.</span>
          </div>
          <span class="shortcut-scope">Popup</span>
        </article>

        <article class="shortcut-row shortcut-row--browser">
          <div class="shortcut-row__keys">
            <kbd>Alt</kbd><span>+</span><kbd>Q</kbd>
          </div>
          <div class="shortcut-row__copy">
            <strong>Open / Close SesWi</strong>
            <span>Open SesWi from the browser; press again while the popup is focused to close it.</span>
          </div>
          <span class="shortcut-scope shortcut-scope--browser">Browser</span>
        </article>
      </div>
    </section>

    <section class="tips-section">
      <div class="tips-section__heading">
        <div>
          <span>Popup Menu</span>
          <small>Four places for everyday session work</small>
        </div>
      </div>

      <div class="menu-grid">
        <article class="menu-tip menu-tip--current">
          <i class="fa-solid fa-globe" />
          <div>
            <strong>Current</strong>
            <span>Active-domain sessions, cleanup, and tab export.</span>
          </div>
        </article>
        <article class="menu-tip menu-tip--groups">
          <i class="fa-solid fa-layer-group" />
          <div>
            <strong>Groups</strong>
            <span>Browse saved sessions grouped by domain.</span>
          </div>
        </article>
        <article class="menu-tip menu-tip--twofa">
          <i class="fa-solid fa-key" />
          <div>
            <strong>2FA</strong>
            <span>View live TOTP codes and manage vault entries.</span>
          </div>
        </article>
        <article class="menu-tip menu-tip--manage">
          <i class="fa-solid fa-sliders" />
          <div>
            <strong>Manage</strong>
            <span>Backups, bulk sessions, security, and extension tools.</span>
          </div>
        </article>
      </div>
    </section>
  </ModalBase>
</template>

<script setup lang="ts">
import ModalBase from './ModalBase.vue';

defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [] }>();
</script>

<style scoped>
:deep(.tips-modal-body) {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.tips-intro {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid rgba(245, 158, 11, 0.2);
  border-radius: var(--radius-md);
  background: linear-gradient(135deg, rgba(255, 251, 235, 0.95), rgba(254, 243, 199, 0.6));
  color: var(--clr-text-secondary);
}

.tips-intro i {
  color: #d97706;
  font-size: var(--fs-lg);
}

.tips-intro p {
  margin: 0;
  font-size: var(--fs-sm);
  line-height: 1.45;
}

.tips-section {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.tips-section__heading {
  display: flex;
  align-items: center;
  padding: 0 2px;
}

.tips-section__heading div {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  width: 100%;
  gap: 10px;
}

.tips-section__heading span {
  color: var(--clr-text-secondary);
  font-size: var(--fs-xs);
  font-weight: 800;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.tips-section__heading small {
  color: var(--clr-text-light);
  font-size: var(--fs-xs);
}

.shortcut-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.shortcut-row {
  display: grid;
  grid-template-columns: 105px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: 9px 10px;
  border: 1px solid rgba(15, 23, 42, 0.07);
  border-radius: var(--radius-md);
  background: rgba(248, 250, 252, 0.78);
}

.shortcut-row--browser {
  border-color: rgba(14, 165, 233, 0.18);
  background: rgba(240, 249, 255, 0.82);
}

.shortcut-row__keys {
  display: flex;
  align-items: center;
  gap: 3px;
  color: var(--clr-text-muted);
  font-size: var(--fs-xs);
  font-weight: 800;
  white-space: nowrap;
}

.shortcut-row kbd {
  min-width: 25px;
  padding: 3px 6px;
  border: 1px solid rgba(15, 23, 42, 0.14);
  border-bottom-width: 2px;
  border-radius: 6px;
  background: white;
  color: var(--clr-text);
  font-family: inherit;
  font-size: var(--fs-xs);
  text-align: center;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
}

.shortcut-row__copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.shortcut-row__copy strong,
.menu-tip strong {
  color: var(--clr-text);
  font-size: var(--fs-sm);
}

.shortcut-row__copy span,
.menu-tip span {
  color: var(--clr-text-light);
  font-size: var(--fs-xs);
  line-height: 1.35;
}

.shortcut-scope {
  padding: 3px 6px;
  border-radius: 6px;
  background: rgba(100, 116, 139, 0.1);
  color: var(--clr-text-muted);
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
}

.shortcut-scope--browser {
  background: rgba(14, 165, 233, 0.12);
  color: #0369a1;
}

.menu-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}

.menu-tip {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  min-width: 0;
  padding: 10px;
  border: 1px solid rgba(15, 23, 42, 0.07);
  border-radius: var(--radius-md);
  background: rgba(248, 250, 252, 0.78);
}

.menu-tip i {
  width: 18px;
  padding-top: 2px;
  color: var(--clr-teal);
  text-align: center;
}

.menu-tip div {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.menu-tip--groups i { color: #7c3aed; }
.menu-tip--twofa i { color: #d97706; }
.menu-tip--manage i { color: #2563eb; }
</style>
