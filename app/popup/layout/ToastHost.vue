<template>
  <div
    class="toast-host"
    aria-live="polite"
  >
    <div
      v-for="toast in toasts"
      :key="toast.id"
      class="toast-pill"
    >
      {{ toast.message }}
    </div>
  </div>
</template>

<script setup lang="ts">
defineOptions({ name: 'ToastHost' });
defineProps<{ toasts: Array<{ id: number; message: string }> }>();
</script>

<style scoped>
.toast-host {
  position: fixed;
  right: 10px;
  bottom: 12px;
  left: 10px;
  z-index: var(--z-toast);
  display: grid;
  gap: 6px;
  pointer-events: none;
}

.toast-pill {
  justify-self: center;
  max-width: 320px;
  padding: 8px 12px;
  border-radius: 999px;
  background: #0f172a;
  color: white;
  box-shadow: var(--shadow-modal);
  font-size: var(--fs-sm);
  font-weight: 700;
  pointer-events: auto;
}
</style>
