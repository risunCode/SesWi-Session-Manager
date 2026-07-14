<template>
  <section
    id="current-panel"
    class="tab-panel"
    role="tabpanel"
    aria-labelledby="current-tab"
  >
    <SearchBar
      v-model="query"
      placeholder="Search sessions..."
      label="Search current domain sessions"
    />
    <div class="current-actions">
      <button
        class="sw-btn sw-btn--secondary sw-btn--sm"
        type="button"
        @click="$emit('open-modal', 'cleanTab')"
      >
        <i class="fa-solid fa-broom" /> Clean Current Tab
      </button>
      <button
        class="sw-btn sw-btn--secondary sw-btn--sm"
        type="button"
        @click="$emit('open-modal', 'exportTabData')"
      >
        <i class="fa-solid fa-bolt" /> Export This Tab
      </button>
    </div>
    <div
      class="session-list"
      role="list"
      aria-label="Sessions list"
      @wheel.prevent="handleWheel"
    >
      <SessionCard
        v-for="(session, index) in pageSessions"
        :key="session.timestamp"
        :session="session"
        :index="(page - 1) * perPage + index + 1"
        :active="session.id === activeSessionId"
        @open="$emit('open-session', session)"
      />
      <EmptyState
        v-if="filteredSessions.length === 0"
        message="No sessions for this domain yet"
      />
    </div>
    <Pagination
      :page="page"
      :total-pages="totalPages"
      @change="setPage"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import type { Session } from '@features/sessions/session.types';
import { SessionStorage, TabInfo } from '@features/sessions/sessionStorage';
import type { ModalKey } from '../composables/useModalStack';
import SearchBar from '../controls/SearchBar.vue';
import Pagination from '../controls/Pagination.vue';
import EmptyState from '../session/EmptyState.vue';
import SessionCard from '../session/SessionCard.vue';

defineEmits<{ 'open-session': [session: Session]; 'open-modal': [modal: Exclude<ModalKey, null>] }>();

const sessions = ref<Session[]>([]);
const activeSessionId = ref<string | null>(null);
const query = ref('');
const page = ref(1);
const perPage = 5;

const filteredSessions = computed(() => {
  const needle = query.value.trim().toLowerCase();
  if (!needle) return sessions.value;
  return sessions.value.filter(session => `${session.name} ${session.domain}`.toLowerCase().includes(needle));
});
const totalPages = computed(() => Math.max(1, Math.ceil(filteredSessions.value.length / perPage)));
const pageSessions = computed(() => filteredSessions.value.slice((page.value - 1) * perPage, page.value * perPage));

watch(query, () => { page.value = 1; });

function setPage(nextPage: number): void {
  page.value = Math.max(1, Math.min(totalPages.value, nextPage));
}

function handleWheel(event: WheelEvent): void {
  if (totalPages.value <= 1 || Math.abs(event.deltaY) < 4) return;
  setPage(page.value + (event.deltaY > 0 ? 1 : -1));
}

onMounted(async () => {
  const tabInfo = await TabInfo.getCurrent();
  if (!tabInfo.success) {
    sessions.value = [];
    return;
  }
  activeSessionId.value = null;
  const result = await SessionStorage.getByDomain(tabInfo.data.domain);
  sessions.value = result.success ? result.data : [];
  const currentOrigin = new URL(tabInfo.data.url).origin;
  const matching = sessions.value.filter((session) => {
    if (!session.originalUrl) return false;
    try {
      return new URL(session.originalUrl).origin === currentOrigin;
    } catch {
      return false;
    }
  });
  activeSessionId.value = matching.sort((left, right) => (right.lastRestoredAt ?? right.timestamp) - (left.lastRestoredAt ?? left.timestamp))[0]?.id ?? null;
});
</script>

<style scoped>
.tab-panel {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
}

.current-actions {
  display: flex;
  gap: 6px;
  margin-bottom: 8px;
}

.current-actions > .sw-btn {
  flex: 1;
}

.session-list {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  gap: 4px;
  overflow: hidden;
  padding: 2px 0;
}
</style>
