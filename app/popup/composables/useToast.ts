import { ref } from 'vue';

export interface ToastMessage { id: number; message: string }

export function useToast() {
  const toasts = ref<ToastMessage[]>([]);
  function show(message: string): void {
    const id = Date.now();
    toasts.value = [...toasts.value, { id, message }];
    window.setTimeout(() => { toasts.value = toasts.value.filter(toast => toast.id !== id); }, 1600);
  }
  return { toasts, show };
}
