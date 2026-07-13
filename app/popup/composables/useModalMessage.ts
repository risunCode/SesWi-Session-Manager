import { computed, ref } from 'vue';

export type ModalMessageType = 'success' | 'error' | '';

export function useModalMessage() {
  const message = ref('');
  const messageType = ref<ModalMessageType>('');
  const messageClass = computed(() => ({ 'sw-message--success': messageType.value === 'success', 'sw-message--error': messageType.value === 'error' }));

  function setMessage(text: string, type: ModalMessageType = ''): void {
    message.value = text;
    messageType.value = type;
  }

  function clearMessage(): void {
    message.value = '';
    messageType.value = '';
  }

  return { message, messageType, messageClass, setMessage, clearMessage };
}
