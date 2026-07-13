<template>
  <ModalBase
    :open="open"
    title="2FA Manager"
    icon="fa-solid fa-shield-halved"
    size="lg"
    panel-class="tfm-modal-panel"
    body-class="tfm-modal-body"
    @close="emit('close')"
  >
    <div class="tfm-toolbar">
      <button class="tfm-select-all" type="button" :disabled="busy || !entries.length" @click="toggleAll">
        {{ allSelected ? 'Clear All' : 'Select All' }}
      </button>
      <span>{{ selectedEntries.length }} selected · {{ entries.length }} entries</span>
    </div>

    <div class="tfm-list">
      <article v-for="entry in entries" :key="entry.id" class="tfm-entry" :class="{ selected: selected[entry.id] }">
        <label class="tfm-entry__select">
          <input type="checkbox" :checked="selected[entry.id]" @change="toggleEntry(entry.id)">
        </label>
        <span class="tfm-entry__avatar" :style="{ backgroundColor: avatarColor(entry.accountName) }">{{ entry.accountName.charAt(0).toUpperCase() || '?' }}</span>
        <span class="tfm-entry__identity"><strong>{{ entry.accountName }}</strong><small>{{ entry.issuer || 'Unknown issuer' }}</small></span>
      </article>
      <div v-if="!entries.length" class="tfm-empty">No 2FA entries saved yet.</div>
    </div>

    <p class="sw-modal-message" :class="messageType">{{ message }}</p>
    <template #footer>
      <button class="sw-btn sw-btn--ghost" type="button" :disabled="busy" @click="emit('close')">
        Cancel
      </button>
      <button class="sw-btn sw-btn--danger" type="button" :disabled="busy || !selectedEntries.length" @click="emit('confirm-delete', selectedEntries)">
        <i class="fa-solid fa-trash" aria-hidden="true" /> Delete Selected
      </button>
    </template>
  </ModalBase>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { TwoFactorEntry } from '@features/two-factor/twoFactor.types';
import { TwoFactorStorage } from '@features/two-factor/twoFactorStorage';
import { useModalMessage } from '../composables/useModalMessage';
import ModalBase from './ModalBase.vue';

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: []; changed: [message?: string]; 'confirm-delete': [entries: TwoFactorEntry[]] }>();
const entries = ref<TwoFactorEntry[]>([]);
const selected = ref<Record<string, true>>({});
const busy = ref(false);
const { message, messageType, setMessage, clearMessage } = useModalMessage();
const selectedEntries = computed(() => entries.value.filter((entry) => selected.value[entry.id]));
const allSelected = computed(() => entries.value.length > 0 && entries.value.every((entry) => selected.value[entry.id]));

watch(() => props.open, async (open) => {
  if (!open) return;
  selected.value = {};
  clearMessage();
  busy.value = true;
  const result = await TwoFactorStorage.getAll();
  busy.value = false;
  if (result.success) entries.value = result.data;
  else setMessage(result.error, 'error');
}, { immediate: true });

function toggleEntry(id: string): void {
  const next = { ...selected.value };
  if (next[id]) delete next[id];
  else next[id] = true;
  selected.value = next;
}

function toggleAll(): void {
  if (allSelected.value) {
    selected.value = {};
    return;
  }
  selected.value = Object.fromEntries(entries.value.map((entry) => [entry.id, true]));
}

function avatarColor(name: string): string {
  const palette = ['#5b5bd6', '#0f9f8f', '#c75d24', '#ad3d84', '#2d78bd', '#8d6a15'];
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return palette[Math.abs(hash) % palette.length];
}
</script>

<style scoped>
.tfm-modal-panel { width: 388px; max-width: 94vw; }
.tfm-modal-body { display: flex; max-height: calc(100vh - 140px); flex-direction: column; gap: 10px; padding: 10px; }
.tfm-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 10px; color: var(--clr-text-light); font-size: var(--fs-sm); }
.tfm-select-all { padding: 4px 10px; border: 1px solid var(--clr-border); border-radius: 4px; background: none; color: var(--clr-text-muted); }
.tfm-list { display: grid; min-height: 0; gap: 5px; overflow-y: auto; }
.tfm-entry { display: grid; grid-template-columns: 20px 30px 1fr; align-items: center; gap: 9px; padding: 8px; border: 1px solid var(--clr-border); border-radius: var(--radius-md); background: var(--clr-background); }
.tfm-entry.selected { border-color: var(--clr-primary); background: color-mix(in srgb, var(--clr-primary) 8%, var(--clr-background)); }
.tfm-entry__select input { accent-color: var(--clr-primary); }
.tfm-entry__avatar { display: grid; width: 30px; height: 30px; place-items: center; border-radius: var(--radius-sm); color: white; font-size: var(--fs-xs); font-weight: 900; }
.tfm-entry__identity { display: grid; min-width: 0; gap: 2px; }
.tfm-entry__identity strong, .tfm-entry__identity small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tfm-entry__identity small { color: var(--clr-text-muted); }
.tfm-empty { padding: 18px; color: var(--clr-text-muted); text-align: center; }
</style>
