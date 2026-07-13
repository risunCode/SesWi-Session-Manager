<template>
  <ModalBase
    :open="open"
    :title="title"
    icon="fa-solid fa-triangle-exclamation"
    @close="$emit('close')"
  >
    <p class="confirm-message">
      {{ message }}
    </p>
    <template #footer>
      <button
        class="sw-btn sw-btn--secondary"
        type="button"
        @click="$emit('close')"
      >
        Cancel
      </button>
      <button
        class="sw-btn sw-btn--danger"
        type="button"
        @click="$emit('confirm')"
      >
        {{ confirmText }}
      </button>
    </template>
  </ModalBase>
</template>

<script setup lang="ts">
import ModalBase from './ModalBase.vue';

withDefaults(defineProps<{ open: boolean; title?: string; message?: string; confirmText?: string }>(), {
  title: 'Confirm Action',
  message: 'Are you sure?',
  confirmText: 'Confirm',
});
defineEmits<{ close: []; confirm: [] }>();
</script>

<style scoped>
.confirm-message {
  color: var(--clr-text-secondary);
  font-size: var(--fs-md);
  line-height: 1.5;
  text-align: center;
}
</style>
