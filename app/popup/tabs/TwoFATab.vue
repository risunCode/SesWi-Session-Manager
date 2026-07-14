<template>
  <section
    id="twofa-panel"
    class="tab-panel"
    role="tabpanel"
    aria-labelledby="twofa-tab"
  >
    <div class="twofa-toolbar">
      <SearchBar
        v-model="query"
        placeholder="Search 2FA..."
        label="Search two factor entries"
      />
      <div class="twofa-toolbar__actions">
        <button
          class="sw-btn sw-btn--secondary sw-btn--sm"
          type="button"
          :aria-pressed="areCodesVisible"
          @click="areCodesVisible = !areCodesVisible"
        >
          <i
            :class="areCodesVisible ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye'"
            aria-hidden="true"
          /> {{ areCodesVisible ? 'Hide OTP' : 'Show OTP' }}
        </button>
        <button
          class="sw-btn sw-btn--primary sw-btn--sm"
          type="button"
          @click="$emit('open-modal', 'twoFactorAdd')"
        >
          <i
            class="fa-solid fa-plus"
            aria-hidden="true"
          /> Add New
        </button>
      </div>
    </div>
    <div v-if="entries.length" class="twofa-refresh" aria-live="polite">
      <span>Automatically refreshes at {{ nextRefresh.timeRemaining }}s</span>
      <div class="twofa-refresh__track" aria-hidden="true">
        <span :style="{ transform: `scaleX(${nextRefresh.progress})` }" />
      </div>
    </div>
    <div class="twofa-list">
      <TwoFactorGroup
        v-for="group in filteredGroups"
        :key="group.issuer"
        :issuer="group.issuer"
      >
        <TwoFactorCard
          v-for="entry in group.entries"
          :key="entry.id"
          :entry="entry"
          :code="codes[entry.id]?.code ?? '------'"
          :is-code-visible="areCodesVisible"
          @copy="copyCode"
          @edit="$emit('edit-entry', entry)"
          @delete="$emit('delete-entry', entry)"
        />
      </TwoFactorGroup>
      <EmptyState
        v-if="filteredGroups.length === 0"
        message="No 2FA entries saved"
        icon="fa-solid fa-shield"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import type { TwoFactorEntry, TOTPCode } from '@features/two-factor/twoFactor.types';
import { TOTP, TwoFactorStorage } from '@features/two-factor/twoFactorStorage';
import type { ModalKey } from '../composables/useModalStack';
import { useTwoFactorTicker } from '../composables/useTwoFactorTicker';
import SearchBar from '../controls/SearchBar.vue';
import EmptyState from '../session/EmptyState.vue';
import TwoFactorCard from '../two-factor/TwoFactorCard.vue';
import TwoFactorGroup from '../two-factor/TwoFactorGroup.vue';

const emit = defineEmits<{
  'open-modal': [modal: Exclude<ModalKey, null>];
  'edit-entry': [entry: TwoFactorEntry];
  'delete-entry': [entry: TwoFactorEntry];
  changed: [message?: string];
  toast: [message: string];
}>();

const entries = ref<TwoFactorEntry[]>([]);
const query = ref('');
const areCodesVisible = ref(false);
const codes = reactive<Record<string, TOTPCode>>({});
const counters = reactive<Record<string, number>>({});
const { now } = useTwoFactorTicker();

const grouped = computed(() => {
  const groups = new Map<string, TwoFactorEntry[]>();
  for (const entry of entries.value) {
    const issuer = entry.issuer || 'Unknown';
    groups.set(issuer, [...(groups.get(issuer) ?? []), entry]);
  }
  return [...groups.entries()].map(([issuer, groupEntries]) => ({ issuer, entries: groupEntries }));
});
const nextRefresh = computed(() => {
  const visibleEntries = filteredGroups.value.flatMap((group) => group.entries);
  const candidates = visibleEntries.map((entry) => {
    const period = entry.period ?? 30;
    const timeRemaining = codes[entry.id]?.timeRemaining ?? period;
    return { timeRemaining, progress: Math.max(0, Math.min(1, timeRemaining / period)) };
  });
  return candidates.reduce((nearest, candidate) => candidate.timeRemaining < nearest.timeRemaining ? candidate : nearest, { timeRemaining: 30, progress: 1 });
});

const filteredGroups = computed(() => {
  const needle = query.value.trim().toLowerCase();
  if (!needle) return grouped.value;
  return grouped.value
    .map(group => ({ ...group, entries: group.entries.filter(entry => `${entry.issuer} ${entry.accountName}`.toLowerCase().includes(needle)) }))
    .filter(group => group.entries.length > 0);
});

async function refreshCodes(): Promise<void> {
  await Promise.all(entries.value.map(async (entry) => {
    const period = entry.period ?? 30;
    const counter = Math.floor(now.value / 1000 / period);
    const timeRemaining = period - (Math.floor(now.value / 1000) % period);
    if (codes[entry.id] && counters[entry.id] === counter) {
      codes[entry.id] = { ...codes[entry.id], timeRemaining };
      return;
    }
    counters[entry.id] = counter;
    codes[entry.id] = await TOTP.generate(entry, now.value);
  }));
}

async function copyCode(entry: TwoFactorEntry): Promise<void> {
  const code = codes[entry.id]?.code;
  if (!code) return;
  await navigator.clipboard.writeText(code);
  emit('toast', '2FA code copied');
}

watch(now, refreshCodes);

onMounted(async () => {
  const result = await TwoFactorStorage.getAll();
  entries.value = result.success ? result.data : [];
  await refreshCodes();
});
</script>

<style scoped>
.tab-panel,
.twofa-list {
  display: flex;
  min-height: 0;
  flex: 1 1 0;
  flex-direction: column;
}

.twofa-toolbar {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 6px;
  align-items: start;
}

.twofa-toolbar__actions {
  display: flex;
  gap: 6px;
}

.twofa-refresh {
  display: grid;
  gap: 5px;
  padding: 7px 0 8px;
  color: var(--clr-text-muted);
  font-size: var(--fs-xs);
  font-weight: 800;
}

.twofa-refresh__track {
  height: 3px;
  overflow: hidden;
  border-radius: 99px;
  background: var(--clr-border);
}

.twofa-refresh__track span {
  display: block;
  width: 100%;
  height: 100%;
  transform-origin: right;
  background: linear-gradient(90deg, var(--clr-teal), var(--clr-primary));
  transition: transform 0.85s linear;
}

.twofa-list {
  gap: 8px;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 2px 0;
}
</style>
