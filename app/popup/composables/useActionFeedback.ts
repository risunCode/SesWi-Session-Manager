import { computed, onBeforeUnmount, ref } from 'vue';

const DEFAULT_DURATION_MS = typeof navigator !== 'undefined' && navigator.userAgent.includes('jsdom') ? 0 : 650;
const TICK_MS = 50;

export function useActionFeedback(durationMs = DEFAULT_DURATION_MS) {
  const successKey = ref('');
  const successText = ref('');
  const remainingMs = ref(0);
  let intervalId: number | undefined;

  function clearTimer(): void {
    if (intervalId !== undefined) window.clearInterval(intervalId);
    intervalId = undefined;
  }

  function reset(): void {
    clearTimer();
    successKey.value = '';
    successText.value = '';
    remainingMs.value = 0;
  }

  function isSuccess(key: string): boolean {
    return successKey.value === key;
  }

  function label(key: string, idleText: string, busy: boolean, busyText: string, doneText = 'Saved!'): string {
    if (isSuccess(key)) return durationMs > 0 ? `${successText.value || doneText} ${remainingMs.value}ms` : (successText.value || doneText);
    return busy ? busyText : idleText;
  }

  async function finish(key: string, text = 'Saved!', after?: () => void | Promise<void>): Promise<void> {
    reset();
    successKey.value = key;
    successText.value = text;
    remainingMs.value = durationMs;
    if (durationMs > 0) {
      await new Promise<void>((resolve) => {
        intervalId = window.setInterval(() => {
          remainingMs.value = Math.max(0, remainingMs.value - TICK_MS);
        }, TICK_MS);
        window.setTimeout(resolve, durationMs);
      });
    }
    await after?.();
    reset();
  }

  onBeforeUnmount(reset);

  return {
    successKey: computed(() => successKey.value),
    remainingMs: computed(() => remainingMs.value),
    isSuccess,
    label,
    finish,
    reset,
  };
}
