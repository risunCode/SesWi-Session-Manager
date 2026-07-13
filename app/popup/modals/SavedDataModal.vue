<template>
  <ModalBase
    :open="open"
    title="Saved Data"
    icon="fa-solid fa-database text-emerald-600"
    panel-class="saved-data-panel"
    @close="emit('close')"
  >
    <template v-if="session">
      <div
        class="saved-data-tabs"
        role="tablist"
        aria-label="Saved session data"
      >
        <button
          v-for="tab in tabs"
          :key="tab.key"
          class="saved-data-tab"
          :class="{ active: activeTab === tab.key }"
          type="button"
          role="tab"
          :aria-selected="activeTab === tab.key"
          @click="activeTab = tab.key"
        >
          <i :class="tab.icon" />
          <span>{{ tab.label }}</span>
          <b>{{ tab.count }}</b>
        </button>
      </div>

      <div
        v-if="copiedMessage"
        class="saved-data-feedback"
        aria-live="polite"
      >
        {{ copiedMessage }}
      </div>

      <div class="saved-data-list">
        <template v-if="activeTab === 'cookies'">
          <p
            v-if="cookies.length === 0"
            class="saved-data-empty"
          >
            No cookies saved
          </p>
          <article
            v-for="cookie in cookies"
            v-else
            :key="cookie.name + cookie.domain + cookie.path"
            class="saved-data-row"
          >
            <div class="saved-data-row__header">
              <strong>{{ cookie.name }}</strong>
              <div>
                <span
                  class="saved-data-expiration"
                  :class="Time.getCookieExpiration(cookie).status"
                >{{ Time.getCookieExpiration(cookie).label }}</span>
                <button
                  class="saved-data-copy"
                  type="button"
                  :aria-label="`Copy ${cookie.name} value`"
                  @click="copyValue(cookie.value, `cookie:${cookie.name}`)"
                >
                  <i :class="copiedKey === `cookie:${cookie.name}` ? 'fa-solid fa-check' : 'fa-solid fa-copy'" />
                </button>
              </div>
            </div>
            <span class="saved-data-flags">{{ Format.cookieFlags(cookie) }}</span>
            <code>{{ Format.short(cookie.value, 80) }}</code>
          </article>
        </template>

        <template v-else>
          <p
            v-if="activeEntries.length === 0"
            class="saved-data-empty"
          >
            No {{ activeTab }} saved
          </p>
          <article
            v-for="entry in activeEntries"
            v-else
            :key="entry.key"
            class="saved-data-row"
          >
            <div class="saved-data-row__header">
              <strong>{{ entry.key }}</strong>
              <button
                class="saved-data-copy"
                type="button"
                :aria-label="`Copy ${entry.key} value`"
                @click="copyValue(entry.value, `${activeTab}:${entry.key}`)"
              >
                <i :class="copiedKey === `${activeTab}:${entry.key}` ? 'fa-solid fa-check' : 'fa-solid fa-copy'" />
              </button>
            </div>
            <code>{{ Format.short(entry.value, 100) }}</code>
          </article>
        </template>
      </div>
    </template>
    <p
      v-else
      class="saved-data-empty"
    >
      Pick a session first.
    </p>
  </ModalBase>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { Session } from '@features/sessions/session.types';
import { Format } from '@shared/format';
import { Time } from '@shared/time';
import { useCopiedFeedback } from '../composables/useCopiedFeedback';
import ModalBase from './ModalBase.vue';

type SavedDataTab = 'cookies' | 'localStorage' | 'sessionStorage';

const props = defineProps<{ open: boolean; session: Session | null }>();
const emit = defineEmits<{ close: [] }>();

const activeTab = ref<SavedDataTab>('cookies');
const { copiedKey, copiedMessage, copyValue, clearCopied } = useCopiedFeedback();
const cookies = computed(() => props.session?.cookies ?? []);
const localEntries = computed(() => Format.entries(props.session?.localStorage ?? {}));
const sessionEntries = computed(() => Format.entries(props.session?.sessionStorage ?? {}));
const activeEntries = computed(() => activeTab.value === 'localStorage' ? localEntries.value : sessionEntries.value);
const tabs = computed(() => [
  { key: 'cookies' as const, label: 'Cookies', icon: 'fa-solid fa-cookie text-amber-600', count: cookies.value.length },
  { key: 'localStorage' as const, label: 'Local', icon: 'fa-solid fa-database text-emerald-600', count: localEntries.value.length },
  { key: 'sessionStorage' as const, label: 'Session', icon: 'fa-solid fa-hard-drive text-blue-600', count: sessionEntries.value.length },
]);

watch(() => props.open, (open) => {
  if (!open) return;
  activeTab.value = 'cookies';
  clearCopied();
});
</script>

<style scoped>
.saved-data-tabs { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; margin-bottom: 12px; }
.saved-data-tab { display: flex; min-width: 0; align-items: center; justify-content: center; gap: 5px; padding: 8px 5px; border: 1px solid var(--clr-border); border-radius: 7px; background: var(--clr-background); color: var(--clr-text-muted); cursor: pointer; font-size: var(--fs-xs); font-weight: 700; }
.saved-data-tab.active { border-color: #93c5fd; background: #eff6ff; color: #1d4ed8; }
.saved-data-tab b { padding: 1px 5px; border-radius: 8px; background: var(--clr-border); font-size: var(--fs-xs); }
.saved-data-feedback { margin-bottom: 10px; padding: 7px 10px; border: 1px solid var(--clr-success); border-radius: 6px; background: #ecfdf5; color: #065f46; font-size: var(--fs-sm); font-weight: 700; text-align: center; }
.saved-data-list { display: grid; max-height: min(52vh, 420px); gap: 7px; overflow-y: auto; overscroll-behavior: contain; scrollbar-color: #94a3b8 transparent; scrollbar-gutter: stable; scrollbar-width: thin; }
.saved-data-list::-webkit-scrollbar { width: 7px; }
.saved-data-list::-webkit-scrollbar-thumb { border: 2px solid transparent; border-radius: 8px; background: #94a3b8; background-clip: content-box; }
.saved-data-list::-webkit-scrollbar-track { background: transparent; }
.saved-data-row { min-width: 0; padding: 9px; border: 1px solid var(--clr-border); border-radius: 7px; background: var(--clr-background); }
.saved-data-row__header { display: flex; min-width: 0; align-items: center; gap: 8px; }
.saved-data-row__header strong { min-width: 0; flex: 1; overflow: hidden; color: var(--clr-text); font-size: var(--fs-sm); text-overflow: ellipsis; white-space: nowrap; }
.saved-data-row__header > div { display: flex; flex: 0 0 auto; align-items: center; gap: 6px; }
.saved-data-row code { display: block; max-width: 100%; overflow: hidden; margin-top: 6px; color: var(--clr-text-muted); font-family: var(--font-mono, ui-monospace, monospace); font-size: var(--fs-xs); text-overflow: ellipsis; white-space: nowrap; }
.saved-data-flags { display: block; margin-top: 4px; color: var(--clr-text-light); font-size: var(--fs-xs); }
.saved-data-copy { display: inline-flex; width: 26px; height: 26px; align-items: center; justify-content: center; border: 1px solid var(--clr-border); border-radius: 5px; background: white; color: var(--clr-text-muted); cursor: pointer; }
.saved-data-copy:hover { border-color: var(--clr-primary); color: var(--clr-primary); }
.saved-data-expiration { padding: 2px 5px; border-radius: 4px; font-size: var(--fs-xs); font-weight: 700; }
.saved-data-expiration.valid { background: #dcfce7; color: #15803d; }.saved-data-expiration.warning { background: #fef9c3; color: #a16207; }.saved-data-expiration.notice { background: #e0f2fe; color: #0369a1; }.saved-data-expiration.expired { background: #fee2e2; color: #b91c1c; }
.saved-data-empty { margin: 0; padding: 26px 14px; color: var(--clr-text-light); font-size: var(--fs-sm); text-align: center; }
</style>
