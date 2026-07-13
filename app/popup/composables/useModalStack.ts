import { onBeforeUnmount, ref, type Ref } from 'vue';

export type ModalKey =
  | 'addSession'
  | 'backupRestore'
  | 'sessionManager'
  | 'twoFactorManager'
  | 'sessionActions'
  | 'savedData'
  | 'cleanTab'
  | 'masterPassword'
  | 'tipsShortcuts'
  | 'exportTabData'
  | 'twoFactorAdd'
  | 'twoFactorEntry'
  | 'twoFactorScan'
  | 'twoFactorImport'
  | 'confirm'
  | null;

export interface ModalStack {
  activeModal: Ref<ModalKey>;
  renderedModal: Ref<ModalKey>;
  openModal: (modal: Exclude<ModalKey, null>) => void;
  closeModal: () => void;
}

const MODAL_LEAVE_DURATION_MS = 220;

export function useModalStack(): ModalStack {
  const activeModal = ref<ModalKey>(null);
  const renderedModal = ref<ModalKey>(null);
  let unmountTimer: number | undefined;

  function clearUnmountTimer(): void {
    if (unmountTimer !== undefined) window.clearTimeout(unmountTimer);
    unmountTimer = undefined;
  }

  function openModal(modal: Exclude<ModalKey, null>): void {
    clearUnmountTimer();
    renderedModal.value = modal;
    activeModal.value = modal;
  }

  function closeModal(): void {
    clearUnmountTimer();
    activeModal.value = null;
    unmountTimer = window.setTimeout(() => {
      renderedModal.value = null;
      unmountTimer = undefined;
    }, MODAL_LEAVE_DURATION_MS);
  }

  onBeforeUnmount(clearUnmountTimer);

  return { activeModal, renderedModal, openModal, closeModal };
}
