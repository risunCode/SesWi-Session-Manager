<template>
  <article class="sw-card twofa-card">
    <div class="twofa-card__avatar" :style="{ backgroundColor: avatarColor }" aria-hidden="true">{{ initial }}</div>
    <div class="twofa-card__identity">
      <strong>{{ entry.accountName }}</strong>
      <button class="twofa-card__code" type="button" @click="emit('copy', entry)">{{ code }}</button>
    </div>
    <div class="twofa-card__actions">
      <button class="sw-btn sw-btn--secondary sw-btn--sm" type="button" @click="emit('edit', entry)">
        <i class="fa-solid fa-pen" aria-hidden="true" /> Edit
      </button>
      <button class="sw-btn sw-btn--danger sw-btn--sm" type="button" @click="emit('delete', entry)">
        <i class="fa-solid fa-trash" aria-hidden="true" /> Delete
      </button>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { TwoFactorEntry } from '@features/two-factor/twoFactor.types';

const props = defineProps<{ entry: TwoFactorEntry; code: string }>();
const emit = defineEmits<{ copy: [entry: TwoFactorEntry]; edit: [entry: TwoFactorEntry]; delete: [entry: TwoFactorEntry] }>();

const initial = computed(() => props.entry.accountName.trim().charAt(0).toUpperCase() || '?');
const avatarColor = computed(() => {
  const palette = ['#5b5bd6', '#0f9f8f', '#c75d24', '#ad3d84', '#2d78bd', '#8d6a15'];
  let hash = 0;
  for (const char of props.entry.accountName) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return palette[Math.abs(hash) % palette.length];
});
</script>

<style scoped>
.twofa-card {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: 10px;
}

.twofa-card__avatar {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border-radius: var(--radius-md);
  color: white;
  font-size: var(--fs-sm);
  font-weight: 900;
}

.twofa-card__identity {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.twofa-card__identity strong {
  overflow: hidden;
  color: var(--clr-text);
  font-size: var(--fs-sm);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.twofa-card__code {
  justify-self: start;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--clr-teal);
  font-family: 'Cause', monospace;
  font-size: 20px;
  font-weight: 900;
  letter-spacing: 0.08em;
}

.twofa-card__code:hover { color: var(--clr-primary); }

.twofa-card__actions {
  display: flex;
  gap: 5px;
}

.twofa-card__actions .sw-btn { min-width: 0; }
</style>
