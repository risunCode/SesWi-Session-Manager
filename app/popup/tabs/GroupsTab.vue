<template>
  <section
    id="groups-panel"
    class="tab-panel"
    role="tabpanel"
    aria-labelledby="groups-tab"
  >
    <SearchBar
      v-model="query"
      placeholder="Search sessions..."
      label="Search all sessions"
    />

    <div class="group-overview-card">
      <span class="overview-label">Overview:</span>
      <div class="overview-stats">
        <div class="overview-stat">
          <i
            class="fa-solid fa-globe"
            aria-hidden="true"
          />
          <span>{{ totalDomains }}</span>
          <label>Domains</label>
        </div>
        <div class="overview-stat">
          <i
            class="fa-solid fa-layer-group"
            aria-hidden="true"
          />
          <span>{{ totalSessions }}</span>
          <label>Sessions</label>
        </div>
      </div>
    </div>

    <div class="groups-container">
      <section
        v-for="group in filteredGroups"
        :key="group.domain"
        class="domain-card"
        :class="{ expanded: isExpanded(group.domain) }"
      >
        <button
          class="domain-card-header"
          type="button"
          @click="toggleDomain(group.domain)"
        >
          <span class="domain-card-left">
            <img
              v-if="iconFor(group.domain)"
              class="domain-favicon"
              :src="iconFor(group.domain)"
              alt=""
              @error="markIconFailed(group.domain)"
            >
            <span
              v-else
              class="domain-favicon-fallback visible"
              aria-hidden="true"
            >
              <i class="fa-solid fa-globe" />
            </span>
            <span class="domain-info">
              <span class="domain-name">{{ group.domain }}</span>
              <span class="domain-meta">{{ group.sessions.length }} sessions · {{ totalCookies(group.sessions) }} cookies</span>
            </span>
          </span>
          <span class="domain-card-right">
            <span
              v-if="isExpanded(group.domain) && authBadge(group)"
              class="exp-badge"
              :class="authBadge(group)?.status"
            >
              <i :class="authBadge(group)?.icon" />
              {{ authBadge(group)?.label }}
            </span>
            <i
              class="fa-solid text-slate-400 text-xs"
              :class="isExpanded(group.domain) ? 'fa-chevron-down' : 'fa-chevron-right'"
              aria-hidden="true"
            />
          </span>
        </button>

        <div
          class="domain-card-content"
          :class="{ show: isExpanded(group.domain) }"
        >
          <template v-if="isExpanded(group.domain)">
            <SessionCard
              v-for="(session, index) in pagedSessions(group)"
              :key="session.id || session.timestamp"
              :session="session"
              :index="(domainPage(group.domain) - 1) * perDomainPage + index + 1"
              @open="$emit('open-session', session)"
            />

            <div
              v-if="domainTotalPages(group) > 1"
              class="pagination"
            >
              <button
                class="dpage-btn"
                type="button"
                :disabled="domainPage(group.domain) <= 1"
                @click.stop="setDomainPage(group.domain, domainPage(group.domain) - 1)"
              >
                ‹
              </button>
              <span>{{ domainPage(group.domain) }}/{{ domainTotalPages(group) }}</span>
              <button
                class="dpage-btn"
                type="button"
                :disabled="domainPage(group.domain) >= domainTotalPages(group)"
                @click.stop="setDomainPage(group.domain, domainPage(group.domain) + 1)"
              >
                ›
              </button>
            </div>
          </template>
        </div>
      </section>

      <EmptyState
        v-if="filteredGroups.length === 0"
        :message="emptyMessage"
        icon="fa-solid fa-layer-group"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import type { Session } from '@features/sessions/session.types';
import SearchBar from '../controls/SearchBar.vue';
import EmptyState from '../session/EmptyState.vue';
import SessionCard from '../session/SessionCard.vue';
import { authBadgeForGroup, domainTotalPages as getDomainTotalPages, pagedSessions as getPagedSessions, totalCookies, useGroupedSessionsData, type DomainGroup } from '../composables/useGroupedSessions';

defineEmits<{ 'open-session': [session: Session] }>();

const { groups, loadGroups, iconFor, markIconFailed } = useGroupedSessionsData();
const expandedDomains = ref<Record<string, boolean>>({});
const domainPages = ref<Record<string, number>>({});
const query = ref('');
const perDomainPage = 4;

const totalDomains = computed(() => groups.value.length);
const totalSessions = computed(() => groups.value.reduce((sum, group) => sum + group.sessions.length, 0));
const filteredGroups = computed(() => {
  const needle = query.value.trim().toLowerCase();
  if (!needle) return groups.value;
  return groups.value
    .map(group => ({
      ...group,
      sessions: group.sessions.filter(session => session.name.toLowerCase().includes(needle) || session.domain.toLowerCase().includes(needle)),
    }))
    .filter(group => group.sessions.length > 0);
});
const emptyMessage = computed(() => query.value.trim() ? `No sessions matching "${query.value.trim()}"` : 'No sessions saved yet');

watch(query, () => {
  domainPages.value = {};
});

onMounted(async () => {
  await loadGroups();
});

function isExpanded(domain: string): boolean {
  return expandedDomains.value[domain] === true;
}

function toggleDomain(domain: string): void {
  expandedDomains.value = { ...expandedDomains.value, [domain]: !isExpanded(domain) };
}

function domainPage(domain: string): number {
  return domainPages.value[domain] ?? 1;
}

function domainTotalPages(group: DomainGroup): number {
  return getDomainTotalPages(group, perDomainPage);
}

function setDomainPage(domain: string, page: number): void {
  domainPages.value = { ...domainPages.value, [domain]: Math.max(1, page) };
}

function pagedSessions(group: DomainGroup): Session[] {
  return getPagedSessions(group, domainPage(group.domain), perDomainPage);
}

function authBadge(group: DomainGroup) {
  return authBadgeForGroup(group);
}
</script>

<style scoped>
.tab-panel {
  display: flex;
  min-height: 0;
  flex: 1 1 0;
  flex-direction: column;
  overflow: hidden;
}

.group-overview-card {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0 12px 8px;
  padding: 8px 12px;
  border: 1px solid var(--clr-border);
  border-radius: 8px;
  background: var(--clr-background);
}

.overview-label {
  color: var(--clr-text-muted);
  font-size: var(--fs-sm);
  font-weight: 600;
  letter-spacing: 0.3px;
  text-transform: uppercase;
}

.overview-stats {
  display: flex;
  align-items: center;
  gap: 16px;
}

.overview-stat {
  display: flex;
  align-items: center;
  gap: 4px;
}

.overview-stat i {
  color: var(--clr-text-muted);
  font-size: var(--fs-base);
}

.overview-stat span {
  color: var(--clr-text);
  font-size: var(--fs-md);
  font-weight: 700;
}

.overview-stat label {
  color: var(--clr-text-light);
  font-size: var(--fs-sm);
}

.groups-container {
  display: flex;
  min-height: 0;
  flex: 1 1 0;
  flex-direction: column;
  gap: 0;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 4px 0;
}

.domain-card {
  min-width: 0;
  flex: 0 0 auto;
  overflow: hidden;
  margin: 6px 10px;
  border: 1px solid var(--clr-border);
  border-radius: 10px;
  background: white;
  transition: all 0.2s ease;
}

.domain-card:hover {
  border-color: #cbd5e1;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.domain-card.expanded {
  border-color: #14b8a6;
}

.domain-card-header {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border: none;
  background: linear-gradient(135deg, var(--clr-background), var(--clr-background-alt));
  cursor: pointer;
  transition: background 0.2s;
}

.domain-card-header:hover {
  background: linear-gradient(135deg, var(--clr-background-alt), var(--clr-border));
}

.domain-card-left {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  gap: 10px;
}

.domain-favicon,
.domain-favicon-fallback {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  border-radius: 6px;
}

.domain-favicon {
  padding: 2px;
  border: 1px solid var(--clr-border);
  background: var(--clr-background-alt);
  object-fit: contain;
}

.domain-favicon-fallback {
  display: none;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--clr-border), #cbd5e1);
  color: var(--clr-text-muted);
  font-size: var(--fs-base);
}

.domain-favicon-fallback.visible { display: flex; }

.domain-info {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
  text-align: left;
}

.domain-name {
  overflow: hidden;
  color: var(--clr-text);
  font-size: var(--fs-md);
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.domain-meta {
  color: var(--clr-text-muted);
  font-size: var(--fs-xs);
  font-weight: 500;
}

.domain-card-right {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 8px;
}

.exp-badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 5px;
  border-radius: 4px;
  font-size: var(--fs-xs);
  font-weight: 600;
}

.exp-badge i { font-size: var(--fs-xs); }
.exp-badge.expired { background: #fef2f2; color: var(--clr-danger-hover); }
.exp-badge.critical { background: #fef2f2; color: var(--clr-danger-hover); animation: pulse-critical 1.5s infinite; }
.exp-badge.warning { background: #fffbeb; color: #d97706; }
.exp-badge.notice { background: #f0f9ff; color: #0284c7; }
.exp-badge.valid { background: #f0fdf4; color: #16a34a; }
.exp-badge.session { background: var(--clr-background-alt); color: var(--clr-text-muted); }

@keyframes pulse-critical {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

.domain-card-content {
  display: none;
  flex-direction: column;
  gap: 5px;
  padding: 6px 8px;
  border-top: 1px solid var(--clr-background-alt);
  background: #fafafa;
}

.domain-card-content.show {
  display: flex;
  flex: 0 0 auto;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  margin-top: 0;
  padding: 6px 0;
}

.pagination > span {
  flex: 1;
  color: var(--clr-text-muted);
  font-size: var(--fs-sm);
  text-align: center;
}

.dpage-btn {
  display: flex;
  min-width: 32px;
  align-items: center;
  justify-content: center;
  padding: 5px 14px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  background: var(--clr-surface);
  color: var(--clr-text-secondary);
  cursor: pointer;
  font-size: var(--fs-lg);
  font-weight: 700;
  transition: all 0.12s ease;
}

.dpage-btn:hover:not(:disabled) {
  border-color: var(--clr-text-light);
  background: var(--clr-background-alt);
  color: var(--clr-text);
}

.dpage-btn:disabled {
  cursor: not-allowed;
  opacity: 0.3;
}
</style>
