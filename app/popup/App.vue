<template>
  <main class="popup-shell">
    <section
      v-if="!masterLock.checked.value"
      class="popup-loading"
      aria-busy="true"
      aria-label="Opening SesWi"
    >
      <div class="popup-loading__brand">
        <i class="fa-solid fa-shield-halved" /> SesWi
      </div>
      <div class="popup-loading__line popup-loading__line--title" />
      <div class="popup-loading__tabs">
        <span /><span /><span /><span />
      </div>
      <div class="popup-loading__card">
        <span /><span /><span />
      </div>
    </section>
    <template v-else-if="!masterLock.required.value">
      <AppHeader
        :current-url="currentUrl"
        @add-session="openModal('addSession')"
      />
      <TabNav
        :active="activeTab"
        @change="activeTab = $event"
      />

      <section class="popup-content">
        <CurrentTab
          v-if="activeTab === 'current'"
          :key="`current-${refreshKey}`"
          @open-session="openSessionActions"
          @open-modal="openPopupModal"
        />
        <GroupsTab
          v-else-if="activeTab === 'groups'"
          :key="`groups-${refreshKey}`"
          @open-session="openSessionActions"
        />
        <TwoFATab
          v-else-if="activeTab === 'twofa'"
          :key="`twofa-${refreshKey}`"
          @open-modal="openPopupModal"
          @edit-entry="openTwoFactorEntry"
          @delete-entry="openTwoFactorDeleteConfirm"
          @toast="show"
          @changed="handleDataChanged"
        />
        <ManageTab
          v-else
          :update-badge="updateBadge"
          @open-modal="openPopupModal"
          @check-updates="handleCheckUpdates"
          @reset-data="openResetDataConfirm"
        />
      </section>

      <AppFooter
        version="v4.0.2"
        :has-update="updateStatus?.hasUpdate ?? false"
        :latest-version="updateStatus?.latestVersion ?? ''"
        :update-url="updateStatus?.releaseUrl ?? null"
      />
    </template>
    <ToastHost :toasts="toasts" />
    <LockScreen
      v-model:remember="masterLock.remember.value"
      :open="masterLock.required.value"
      :busy="masterLock.busy.value"
      :error="masterLock.error.value"
      @unlock="unlockMaster"
    />

    <AddSessionModal
      :open="activeModal === 'addSession'"
      @close="closeModal"
      @saved="handleDataChanged"
      @toast="show"
    />
    <BackupRestoreModal
      v-if="renderedModal === 'backupRestore'"
      :open="activeModal === 'backupRestore'"
      @close="closeModal"
      @changed="handleDataChanged"
      @toast="show"
    />
    <SessionManagerModal
      v-if="renderedModal === 'sessionManager'"
      :open="activeModal === 'sessionManager'"
      @close="closeModal"
      @changed="handleDataChanged"
      @toast="show"
      @confirm-delete="openSessionManagerDeleteConfirm"
      @confirm-delete-domain="openSessionDomainDeleteConfirm"
    />
    <TwoFactorManagerModal
      v-if="renderedModal === 'twoFactorManager'"
      :open="activeModal === 'twoFactorManager'"
      @close="closeModal"
      @changed="handleDataChanged"
      @confirm-delete="openTwoFactorManagerDeleteConfirm"
    />
    <SessionActionsModal
      v-if="renderedModal === 'sessionActions'"
      :open="activeModal === 'sessionActions'"
      :session="selectedSession"
      @close="closeModal"
      @changed="handleDataChanged"
      @session-updated="(s) => selectedSession = s"
      @toast="show"
      @confirm-delete="openSessionDeleteConfirm"
      @open-saved-data="openSavedData"
    />
    <SavedDataModal
      v-if="renderedModal === 'savedData'"
      :open="activeModal === 'savedData'"
      :session="selectedSession"
      @close="closeModal"
    />
    <CleanTabModal
      :open="activeModal === 'cleanTab'"
      @close="closeModal"
      @cleaned="handleDataChanged"
      @toast="show"
      @clear-other-tabs="openClearOtherTabsConfirm"
    />
    <ExportTabDataModal
      v-if="renderedModal === 'exportTabData'"
      :open="activeModal === 'exportTabData'"
      @close="closeModal"
      @toast="show"
    />
    <MasterPasswordModal
      v-if="renderedModal === 'masterPassword'"
      :open="activeModal === 'masterPassword'"
      @close="closeModal"
      @changed="handleDataChanged"
      @toast="show"
    />
    <TipsShortcutsModal
      v-if="renderedModal === 'tipsShortcuts'"
      :open="activeModal === 'tipsShortcuts'"
      @close="closeModal"
    />
    <TwoFactorAddModal
      v-if="renderedModal === 'twoFactorAdd'"
      :open="activeModal === 'twoFactorAdd'"
      @close="closeModal"
      @choose="openTwoFactorAddChoice"
    />
    <TwoFactorEntryModal
      v-if="renderedModal === 'twoFactorEntry'"
      :open="activeModal === 'twoFactorEntry'"
      :entry="selectedTwoFactorEntry"
      @close="closeTwoFactorEntry"
      @saved="handleDataChanged"
      @toast="show"
    />
    <TwoFactorScanModal
      v-if="renderedModal === 'twoFactorScan'"
      :open="activeModal === 'twoFactorScan'"
      @close="closeModal"
      @saved="handleDataChanged"
      @toast="show"
    />
    <TwoFactorImportModal
      v-if="renderedModal === 'twoFactorImport'"
      :open="activeModal === 'twoFactorImport'"
      @close="closeModal"
      @saved="handleDataChanged"
      @toast="show"
    />
    <ConfirmModal
      :open="activeModal === 'confirm'"
      :title="confirmState.title"
      :message="confirmState.message"
      :confirm-text="confirmState.confirmText"
      @close="closeModal"
      @confirm="confirmState.onConfirm"
    />
  </main>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { browser } from 'wxt/browser';
import { checkForUpdate, type UpdateStatus } from '@features/updates/updater';
import { runUserscriptBridgeAction } from '@features/userscript/bridge';
import { USERSCRIPT_BRIDGE_ACTIONS, USERSCRIPT_BRIDGE_REQUEST_TIMEOUT_MS, isUserscriptBridgePendingRequest, isUserscriptBridgeRuntimeMessage, userscriptBridgeConfirmMessage, userscriptBridgeConfirmTitle, type UserscriptBridgePendingRequest } from '@shared/userscriptBridge';
import { SessionStorage, TabInfo } from '@features/sessions/sessionStorage';
import type { Session } from '@features/sessions/session.types';
import type { TwoFactorEntry } from '@features/two-factor/twoFactor.types';
import type { DomainGroup } from './composables/useGroupedSessions';
import { TwoFactorStorage } from '@features/two-factor/twoFactorStorage';
import AppHeader from './layout/AppHeader.vue';
import TabNav, { type TabId } from './layout/TabNav.vue';
import AppFooter from './layout/AppFooter.vue';
import ToastHost from './layout/ToastHost.vue';
import LockScreen from './layout/LockScreen.vue';
import CurrentTab from './tabs/CurrentTab.vue';
import GroupsTab from './tabs/GroupsTab.vue';
import TwoFATab from './tabs/TwoFATab.vue';
import ManageTab from './tabs/ManageTab.vue';
import AddSessionModal from './modals/AddSessionModal.vue';
import CleanTabModal from './modals/CleanTabModal.vue';
import ConfirmModal from './modals/ConfirmModal.vue';
import { useModalStack, type ModalKey } from './composables/useModalStack';
import { useToast } from './composables/useToast';
import { useMasterLock } from './composables/useMasterLock';

const BackupRestoreModal = defineAsyncComponent(() => import('./modals/BackupRestoreModal.vue'));
const SessionManagerModal = defineAsyncComponent(() => import('./modals/SessionManagerModal.vue'));
const TwoFactorManagerModal = defineAsyncComponent(() => import('./modals/TwoFactorManagerModal.vue'));
const SessionActionsModal = defineAsyncComponent(() => import('./modals/SessionActionsModal.vue'));
const SavedDataModal = defineAsyncComponent(() => import('./modals/SavedDataModal.vue'));
const ExportTabDataModal = defineAsyncComponent(() => import('./modals/ExportTabDataModal.vue'));
const MasterPasswordModal = defineAsyncComponent(() => import('./modals/MasterPasswordModal.vue'));
const TipsShortcutsModal = defineAsyncComponent(() => import('./modals/TipsShortcutsModal.vue'));
const TwoFactorAddModal = defineAsyncComponent(() => import('./modals/TwoFactorAddModal.vue'));
const TwoFactorEntryModal = defineAsyncComponent(() => import('./modals/TwoFactorEntryModal.vue'));
const TwoFactorScanModal = defineAsyncComponent(() => import('./modals/TwoFactorScanModal.vue'));
const TwoFactorImportModal = defineAsyncComponent(() => import('./modals/TwoFactorImportModal.vue'));

const currentUrl = ref('Current tab');
const activeTab = ref<TabId>('current');
const selectedSession = ref<Session | null>(null);
const selectedTwoFactorEntry = ref<TwoFactorEntry | null>(null);
const refreshKey = ref(0);
const updateStatus = ref<UpdateStatus | null>(null);
const updateBadge = computed(() => updateStatus.value?.hasUpdate ? `v${updateStatus.value.latestVersion}` : 'v4.0.2');
const { toasts, show } = useToast();
const { activeModal, renderedModal, openModal, closeModal: dismissModal } = useModalStack();
const masterLock = useMasterLock();
const lastCtrlXAt = ref(0);
const pendingUserscriptRequest = ref<UserscriptBridgePendingRequest | null>(null);

const confirmState = reactive({
  title: 'Confirm Action',
  message: 'Are you sure?',
  confirmText: 'Confirm',
  onConfirm: () => closeModal(),
});

async function rejectPendingUserscriptRequest(message: string): Promise<void> {
  const activeRequest = pendingUserscriptRequest.value;
  clearPendingUserscriptPrompt();
  if (!activeRequest) return;
  await browser.runtime.sendMessage({
    action: USERSCRIPT_BRIDGE_ACTIONS.complete,
    requestId: activeRequest.requestId,
    success: false,
    message,
  });
}

function closeModal(): void {
  if (activeModal.value === 'confirm' && pendingUserscriptRequest.value) {
    void rejectPendingUserscriptRequest('Userscript request was cancelled in SesWi.');
  }
  dismissModal();
}

function openPopupModal(modal: Exclude<ModalKey, null>): void {
  if (modal === 'twoFactorEntry') selectedTwoFactorEntry.value = null;
  openModal(modal);
}

function openTwoFactorAddChoice(choice: 'manual' | 'scan' | 'import'): void {
  if (choice === 'manual') {
    selectedTwoFactorEntry.value = null;
    openModal('twoFactorEntry');
    return;
  }
  openModal(choice === 'scan' ? 'twoFactorScan' : 'twoFactorImport');
}

function handleDataChanged(message?: string): void {
  TabInfo.invalidate();
  refreshKey.value += 1;
  if (message === 'Master password enabled') masterLock.markEnabledUnlocked();
  if (message === 'Master password disabled') masterLock.markDisabled();
  if (message) show(message);
  closeModal();
}

function openSessionActions(session: Session): void {
  selectedSession.value = session;
  openModal('sessionActions');
}

function openSavedData(session: Session): void {
  selectedSession.value = session;
  openModal('savedData');
}

function openSessionDeleteConfirm(session: Session): void {
  confirmState.title = 'Delete Session';
  confirmState.message = `Delete “${session.name}” for ${session.domain}?`;
  confirmState.confirmText = 'Delete';
  confirmState.onConfirm = async () => {
    const result = await SessionStorage.delete(session.timestamp);
    if (result.success) handleDataChanged('Session deleted');
    else show(result.error);
  };
  openModal('confirm');
}

function openSessionManagerDeleteConfirm(sessions: Session[]): void {
  confirmState.title = 'Delete Selected Sessions';
  confirmState.message = `Delete ${sessions.length} selected session${sessions.length === 1 ? '' : 's'}? This cannot be undone.`;
  confirmState.confirmText = 'Delete';
  confirmState.onConfirm = async () => {
    const result = await SessionStorage.deleteMany(sessions.map((session) => session.timestamp));
    if (result.success) handleDataChanged(`Deleted ${result.data.deleted} session${result.data.deleted === 1 ? '' : 's'}`);
    else show(result.error);
  };
  openModal('confirm');
}

function openSessionDomainDeleteConfirm(group: DomainGroup): void {
  confirmState.title = 'Delete Domain Sessions';
  confirmState.message = `Delete all ${group.sessions.length} saved session${group.sessions.length === 1 ? '' : 's'} for ${group.domain}? This cannot be undone.`;
  confirmState.confirmText = 'Delete Domain';
  confirmState.onConfirm = async () => {
    const result = await SessionStorage.deleteMany(group.sessions.map((session) => session.timestamp));
    if (result.success) handleDataChanged(`Deleted ${result.data.deleted} session${result.data.deleted === 1 ? '' : 's'} for ${group.domain}`);
    else show(result.error);
  };
  openModal('confirm');
}

function openTwoFactorManagerDeleteConfirm(entries: TwoFactorEntry[]): void {
  confirmState.title = 'Delete Selected 2FA Entries';
  confirmState.message = `Delete ${entries.length} selected 2FA entr${entries.length === 1 ? 'y' : 'ies'}? This cannot be undone.`;
  confirmState.confirmText = 'Delete';
  confirmState.onConfirm = async () => {
    const result = await TwoFactorStorage.deleteMany(entries.map((entry) => entry.id));
    if (!result.success) {
      show(result.error);
      return;
    }
    handleDataChanged(`Deleted ${result.data.deleted} 2FA entr${result.data.deleted === 1 ? 'y' : 'ies'}`);
  };
  openModal('confirm');
}

function openClearOtherTabsConfirm(count: number): void {
  confirmState.title = 'Clear Other Tabs?';
  confirmState.message = `Close ${count} other tab${count === 1 ? '' : 's'} in this window? The active tab stays open.`;
  confirmState.confirmText = 'Clear Other Tabs';
  confirmState.onConfirm = async () => {
    try {
      const tabs = await browser.tabs.query({ currentWindow: true });
      const tabIdsToClose = tabs.flatMap((tab) => (
        !tab.active && typeof tab.id === 'number' ? [tab.id] : []
      ));
      if (tabIdsToClose.length === 0) {
        show('There are no other tabs to clear');
        closeModal();
        return;
      }
      await browser.tabs.remove(tabIdsToClose);
      handleDataChanged(`Closed ${tabIdsToClose.length} other tab${tabIdsToClose.length === 1 ? '' : 's'}`);
    } catch (error) {
      show(error instanceof Error ? error.message : String(error));
    }
  };
  openModal('confirm');
}

function openResetDataConfirm(): void {
  confirmState.title = 'Reset All Data?';
  confirmState.message = 'This will permanently delete all saved sessions, 2FA entries, master password, and configuration. This cannot be undone.';
  confirmState.confirmText = 'Reset Everything';
  confirmState.onConfirm = async () => {
    await browser.storage.local.clear();
    try { localStorage.clear(); } catch { /* ignore */ }
    show('All data has been reset');
    closeModal();
    window.setTimeout(() => window.location.reload(), 1200);
  };
  openModal('confirm');
}

function clearPendingUserscriptPrompt(): void {
  pendingUserscriptRequest.value = null;
}

function openUserscriptBridgeConfirm(request: UserscriptBridgePendingRequest): void {
  pendingUserscriptRequest.value = request;
  confirmState.title = userscriptBridgeConfirmTitle(request.kind);
  confirmState.message = userscriptBridgeConfirmMessage(request);
  confirmState.confirmText = 'Allow';
  confirmState.onConfirm = async () => {
    if (!pendingUserscriptRequest.value) {
      closeModal();
      return;
    }
    if (masterLock.required.value) {
      await browser.runtime.sendMessage({
        action: USERSCRIPT_BRIDGE_ACTIONS.complete,
        requestId: pendingUserscriptRequest.value.requestId,
        success: false,
        message: 'Unlock SesWi before approving userscript actions.',
      });
      clearPendingUserscriptPrompt();
      dismissModal();
      show('Unlock SesWi first');
      return;
    }
    const activeRequest = pendingUserscriptRequest.value;
    const result = await runUserscriptBridgeAction(activeRequest);
    await browser.runtime.sendMessage({
      action: USERSCRIPT_BRIDGE_ACTIONS.complete,
      requestId: activeRequest.requestId,
      success: result.success,
      message: result.success ? result.data.message : result.error,
      data: result.success ? result.data.data ?? null : null,
    });
    if (result.success) {
      refreshKey.value += 1;
      show(result.data.message);
    } else {
      show(result.error);
    }
    clearPendingUserscriptPrompt();
    dismissModal();
  };
  openModal('confirm');
}

function openTwoFactorEntry(entry: TwoFactorEntry): void {
  selectedTwoFactorEntry.value = entry;
  openModal('twoFactorEntry');
}

function openTwoFactorDeleteConfirm(entry: TwoFactorEntry): void {
  confirmState.title = 'Delete 2FA Entry';
  confirmState.message = `Delete “${entry.accountName}” from ${entry.issuer || 'Unknown'}?`;
  confirmState.confirmText = 'Delete';
  confirmState.onConfirm = async () => {
    const result = await TwoFactorStorage.delete(entry.id);
    if (result.success) handleDataChanged('2FA entry deleted');
    else show(result.error);
  };
  openModal('confirm');
}

function closeTwoFactorEntry(): void {
  closeModal();
}

async function handleCheckUpdates(): Promise<void> {
  const status = await checkForUpdate(true);
  if (!status) {
    show('Could not check for updates');
    return;
  }
  updateStatus.value = status;
  show(status.hasUpdate ? `New version v${status.latestVersion} available` : `You are on the latest version (${status.currentVersion})`);
}

async function unlockMaster(password: string): Promise<void> {
  const unlocked = await masterLock.unlock(password, masterLock.remember.value);
  if (unlocked) {
    refreshKey.value += 1;
    show('SesWi unlocked');
  }
}

async function fastCleanCurrentTab(): Promise<void> {
  const result = await TabInfo.cleanCurrentTab();
  if (result.success) handleDataChanged('Current tab cleaned');
  else show(result.error);
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

function handleShortcut(event: KeyboardEvent): void {
  const key = event.key.toLowerCase();
  if (event.altKey && !event.ctrlKey && !event.metaKey && !event.repeat && key === 'q') {
    event.preventDefault();
    window.close();
    return;
  }
  if (event.altKey && !event.ctrlKey && !event.metaKey && !event.repeat && key === 'n') {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!isEditableTarget(event.target)) openModal('addSession');
    return;
  }
  if (!event.ctrlKey || event.metaKey || event.altKey || event.repeat || isEditableTarget(event.target)) return;
  if (key === 'd') {
    event.preventDefault();
    closeModal();
    if (masterLock.enabled.value) void masterLock.lock().then(() => show('SesWi locked'));
    return;
  }
  if (key === 'x') {
    event.preventDefault();
    const now = Date.now();
    if (lastCtrlXAt.value && now - lastCtrlXAt.value < 2_000) {
      lastCtrlXAt.value = 0;
      void fastCleanCurrentTab();
      return;
    }
    lastCtrlXAt.value = now;
    openModal('cleanTab');
  }
}

async function syncPendingUserscriptPrompt(): Promise<void> {
  const request = await browser.runtime.sendMessage({ action: USERSCRIPT_BRIDGE_ACTIONS.getPending }) as UserscriptBridgePendingRequest | null;
  if (!request || !isUserscriptBridgePendingRequest(request)) return;
  if (Date.now() - request.createdAt > USERSCRIPT_BRIDGE_REQUEST_TIMEOUT_MS) return;
  openUserscriptBridgeConfirm(request);
}

function handleRuntimeMessage(message: unknown): { handled: true } | void {
  if (message && typeof message === 'object' && 'action' in message && message.action === 'seswi:toggle-popup') {
    window.setTimeout(() => window.close(), 0);
    return { handled: true };
  }
  if (isUserscriptBridgeRuntimeMessage(message) && message.action === USERSCRIPT_BRIDGE_ACTIONS.prompt && isUserscriptBridgePendingRequest(message.request)) {
    openUserscriptBridgeConfirm(message.request);
  }
}

async function loadCurrentTab(): Promise<void> {
  const result = await TabInfo.getCurrent();
  currentUrl.value = result.success ? result.data.url : 'Current tab';
}

async function loadUpdateStatus(): Promise<void> {
  try {
    updateStatus.value = await checkForUpdate(false);
  } catch (error) {
    console.warn('[SesWi] Background update check unavailable:', error);
  }
}

async function restoreFirefoxIntent(): Promise<void> {
  const raw = await browser.storage.session.get('seswi:intent');
  const intent: string | undefined = raw?.['seswi:intent'] as string | undefined;
  if (!intent) return;
  await browser.storage.session.remove('seswi:intent');
  // Map intent strings to modal keys
  const map: Record<string, ModalKey> = {
    addSession: 'addSession',
    backupRestore: 'backupRestore',
    twoFactorImport: 'twoFactorImport',
  };
  const key = map[intent];
  if (key) openModal(key);
}

function scheduleUpdateStatus(): void {
  void nextTick().then(() => {
    window.requestAnimationFrame(() => {
      void loadUpdateStatus();
    });
  });
}

onMounted(async () => {
  window.addEventListener('keydown', handleShortcut, { capture: true });
  browser.runtime.onMessage.addListener(handleRuntimeMessage);

  const currentTab = loadCurrentTab();
  await masterLock.init();
  await Promise.allSettled([currentTab, syncPendingUserscriptPrompt(), restoreFirefoxIntent()]);
  scheduleUpdateStatus();
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleShortcut, { capture: true });
  browser.runtime.onMessage.removeListener(handleRuntimeMessage);
});
</script>

<style scoped>
.popup-loading {
  display: grid;
  min-height: 520px;
  grid-template-rows: auto auto auto 1fr;
  gap: 18px;
  padding: 22px;
  background: var(--clr-bg, #f8f8fc);
}

.popup-loading__brand {
  color: var(--clr-violet, #6366f1);
  font-size: 17px;
  font-weight: 800;
}

.popup-loading__line,
.popup-loading__tabs span,
.popup-loading__card span {
  display: block;
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(99, 102, 241, 0.08), rgba(99, 102, 241, 0.2), rgba(99, 102, 241, 0.08));
  background-size: 200% 100%;
  animation: popup-loading-shimmer 1.25s ease-in-out infinite;
}

.popup-loading__line--title {
  width: 58%;
  height: 22px;
}

.popup-loading__tabs {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.popup-loading__tabs span {
  height: 32px;
}

.popup-loading__card {
  display: grid;
  align-content: start;
  gap: 14px;
  padding: 18px;
  border: 1px solid rgba(99, 102, 241, 0.12);
  border-radius: 14px;
  background: rgba(99, 102, 241, 0.03);
}

.popup-loading__card span {
  height: 14px;
}

.popup-loading__card span:nth-child(2) {
  width: 78%;
}

.popup-loading__card span:nth-child(3) {
  width: 46%;
}

@keyframes popup-loading-shimmer {
  to { background-position: -200% 0; }
}

@media (prefers-reduced-motion: reduce) {
  .popup-loading__line,
  .popup-loading__tabs span,
  .popup-loading__card span {
    animation: none;
  }
}

.popup-shell {
  position: relative;
  display: flex;
  width: 380px;
  height: var(--popup-max-height);
  flex-direction: column;
  overflow: hidden;
  background: var(--gradient-shell);
}

.popup-content {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  padding: 10px;
}
</style>
