<template>
  <ModalBase
    :open="open"
    :title="title"
    icon="fa-solid fa-lock"
    @close="emit('close')"
  >
    <label class="owi-password__label" for="owi-export-password">Password</label>
    <input
      id="owi-export-password"
      v-model="password"
      class="sw-input"
      type="password"
      autocomplete="new-password"
      placeholder="Enter an OWI export password"
      @keyup.enter="submit"
    >
    <p v-if="error" class="sw-modal-message error">{{ error }}</p>
    <template #footer>
      <button class="sw-btn sw-btn--secondary" type="button" @click="emit('close')">Cancel</button>
      <button class="sw-btn sw-btn--primary" type="button" @click="submit">Export OWI</button>
    </template>
  </ModalBase>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import ModalBase from './ModalBase.vue';

const props = withDefaults(defineProps<{ open: boolean; title?: string }>(), {
  title: 'Set OWI Export Password',
});
const emit = defineEmits<{ close: []; submit: [password: string] }>();
const password = ref('');
const error = ref('');

watch(() => props.open, (open) => {
  if (!open) return;
  password.value = '';
  error.value = '';
});

function submit(): void {
  if (!password.value) {
    error.value = 'Password required.';
    return;
  }
  emit('submit', password.value);
}
</script>

<style scoped>
.owi-password__label {
  display: block;
  margin-bottom: 6px;
  color: var(--clr-text-secondary);
  font-size: var(--fs-sm);
  font-weight: 800;
}
</style>
