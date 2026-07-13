import { onBeforeUnmount, ref } from 'vue';

export function useTwoFactorTicker() {
  const now = ref(Date.now());
  const timer = window.setInterval(() => {
    now.value = Date.now();
  }, 1000);

  onBeforeUnmount(() => window.clearInterval(timer));

  return { now };
}
