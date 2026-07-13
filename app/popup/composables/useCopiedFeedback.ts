import { onBeforeUnmount, ref } from 'vue';

export function useCopiedFeedback(durationMs = 1200) {
  const copiedKey = ref('');
  const copiedMessage = ref('');
  let timerId: number | undefined;

  function clearTimer(): void {
    if (timerId !== undefined) window.clearTimeout(timerId);
    timerId = undefined;
  }

  function clearCopied(): void {
    clearTimer();
    copiedKey.value = '';
    copiedMessage.value = '';
  }

  async function copyValue(value = '', key = 'value', message = 'Copied!'): Promise<void> {
    await navigator.clipboard?.writeText(value);
    clearTimer();
    copiedKey.value = key;
    copiedMessage.value = message;
    timerId = window.setTimeout(() => {
      if (copiedKey.value === key) clearCopied();
    }, durationMs);
  }

  onBeforeUnmount(clearCopied);

  return { copiedKey, copiedMessage, copyValue, clearCopied };
}
