<template>
  <ModalBase
    :open="open"
    title="Session Manager"
    icon="fa-solid fa-sliders"
    size="lg"
    panel-class="sm-modal-panel"
    body-class="sm-modal-body"
    @close="emit('close')"
  >
    <div class="sm-toolbar">
      <button
        class="sm-select-all"
        type="button"
        :disabled="busy || filteredGroups.length === 0"
        @click="toggleAll"
      >
        {{ allSelected ? 'Clear All' : 'Select All' }}
      </button>
      <span class="sm-selected-count">{{ selectedCount }} selected</span>
    </div>

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

    <div class="groups-container sm-groups-container">
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
            <input
              :checked="isDomainSelected(group)"
              :indeterminate.prop="isDomainIndeterminate(group)"
              class="sm-domain-checkbox"
              type="checkbox"
              :title="`Select all in ${group.domain}`"
              @click.stop
              @change="toggleDomainSelection(group, ($event.target as HTMLInputElement).checked)"
            >
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
              v-if="domainSelectedCount(group) > 0"
              class="sm-selected-pill"
            >
              {{ domainSelectedCount(group) }} selected
            </span>
            <button
              class="sm-domain-delete"
              type="button"
              :disabled="busy"
              :aria-label="`Delete all sessions for ${group.domain}`"
              @click.stop="emit('confirm-delete-domain', group)"
            >
              <i class="fa-solid fa-trash" aria-hidden="true" /> Delete Domain
            </button>
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
            <button
              v-for="session in pagedSessions(group)"
              :key="session.id || session.timestamp"
              class="sm-session-row"
              :class="{ selected: isSelected(session.timestamp) }"
              type="button"
              @click="toggleSession(session.timestamp)"
            >
              <input
                :checked="isSelected(session.timestamp)"
                class="sm-session-checkbox"
                type="checkbox"
                @click.stop
                @change="toggleSession(session.timestamp)"
              >
              <span class="sm-session-main">
                <span class="sm-session-name">{{ session.name }}</span>
                <span class="sm-session-meta">#{{ session.index || 1 }} · {{ session.cookies?.length ?? 0 }} cookies</span>
              </span>
              <span class="sm-session-time">{{ savedAt(session) }}</span>
            </button>

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

      <div
        v-if="filteredGroups.length === 0"
        class="sm-empty"
      >
        <i class="fa-solid fa-layer-group" />
        <span>No sessions saved yet.</span>
      </div>
    </div>

    <p
      class="sw-modal-message"
      :class="messageType"
    >
      {{ message }}
    </p>

    <template #footer>
      <button
        class="sw-btn sw-btn--secondary"
        :class="{ 'sw-btn--success': actionFeedback.isSuccess('json') }"
        type="button"
        :disabled="busy || actionFeedback.isSuccess('json')"
        @click="exportJson"
      >
        <i class="fa-solid fa-file-code" />
        {{ actionFeedback.label('json', 'JSON', busy, 'Exporting…', 'Done!') }}
      </button>
      <button
        class="sw-btn sw-btn--secondary"
        :class="{ 'sw-btn--success': actionFeedback.isSuccess('owi') }"
        type="button"
        :disabled="busy || actionFeedback.isSuccess('owi')"
        @click="requestOwiExport"
      >
        <i class="fa-solid fa-lock" />
        {{ actionFeedback.label('owi', 'OWI', busy, 'Exporting…', 'Done!') }}
      </button>
      <button
        class="sw-btn sw-btn--danger"
        :class="{ 'sw-btn--success': actionFeedback.isSuccess('delete') }"
        type="button"
        :disabled="busy || actionFeedback.isSuccess('delete')"
        @click="deleteSelected"
      >
        <i class="fa-solid fa-trash" />
        {{ actionFeedback.label('delete', 'Delete', busy, 'Deleting…', 'Done!') }}
      </button>
    </template>
  </ModalBase>
  <OwiPasswordModal
    :open="owiPasswordOpen"
    @close="owiPasswordOpen = false"
    @submit="exportOwi"
  />
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Backup } from '@features/backup/backup';
import { Crypto } from '@features/security/crypto';
import type { Session } from '@features/sessions/session.types';
import { DOM } from '@shared/dom';
import { Format } from '@shared/format';
import { Time } from '@shared/time';
import { useActionFeedback } from '../composables/useActionFeedback';
import { domainTotalPages as getDomainTotalPages, pagedSessions as getPagedSessions, totalCookies, useGroupedSessionsData, type DomainGroup } from '../composables/useGroupedSessions';
import { useModalMessage } from '../composables/useModalMessage';
import ModalBase from './ModalBase.vue';
import OwiPasswordModal from './OwiPasswordModal.vue';

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: []; changed: [message?: string]; toast: [message: string]; 'confirm-delete': [sessions: Session[]]; 'confirm-delete-domain': [group: DomainGroup] }>();

const busy = ref(false);
const { groups, loadGroups, iconFor, markIconFailed } = useGroupedSessionsData();
const expandedDomain = ref<string | null>(null);
const domainPages = ref<Record<string, number>>({});
const selected = ref<Record<number, true>>({});
const { message, messageType, setMessage, clearMessage } = useModalMessage();
const actionFeedback = useActionFeedback();
const owiPasswordOpen = ref(false);
const perDomainPage = 4;

const filteredGroups = computed(() => groups.value.filter((group) => group.sessions.length > 0));
const totalDomains = computed(() => filteredGroups.value.length);
const totalSessions = computed(() => filteredGroups.value.reduce((sum, group) => sum + group.sessions.length, 0));
const selectedCount = computed(() => Object.keys(selected.value).length);
const allSelected = computed(() => {
  const sessions = groups.value.flatMap((group) => group.sessions);
  return sessions.length > 0 && sessions.every((session) => isSelected(session.timestamp));
});

watch(() => props.open, async (open) => {
  if (!open) return;
  selected.value = {};
  expandedDomain.value = null;
  domainPages.value = {};
  clearMessage();
  await loadSessionGroups();
}, { immediate: true });

function isExpanded(domain: string): boolean {
  return expandedDomain.value === domain;
}

function toggleDomain(domain: string): void {
  expandedDomain.value = expandedDomain.value === domain ? null : domain;
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

function isSelected(timestamp: number): boolean {
  return selected.value[timestamp] === true;
}

function toggleSession(timestamp: number): void {
  const next = { ...selected.value };
  if (next[timestamp]) delete next[timestamp];
  else next[timestamp] = true;
  selected.value = next;
}

function domainSelectedCount(group: DomainGroup): number {
  return group.sessions.filter((session) => isSelected(session.timestamp)).length;
}

function isDomainSelected(group: DomainGroup): boolean {
  return group.sessions.length > 0 && group.sessions.every((session) => isSelected(session.timestamp));
}

function isDomainIndeterminate(group: DomainGroup): boolean {
  return !isDomainSelected(group) && group.sessions.some((session) => isSelected(session.timestamp));
}

function toggleDomainSelection(group: DomainGroup, checked: boolean): void {
  const next = { ...selected.value };
  for (const session of group.sessions) {
    if (checked) next[session.timestamp] = true;
    else delete next[session.timestamp];
  }
  if (checked) expandedDomain.value = group.domain;
  selected.value = next;
}

function toggleAll(): void {
  if (allSelected.value) {
    selected.value = {};
    return;
  }
  const next: Record<number, true> = {};
  for (const group of groups.value) {
    for (const session of group.sessions) next[session.timestamp] = true;
  }
  selected.value = next;
  expandedDomain.value = groups.value[0]?.domain ?? null;
}

function selectedSessions(): Session[] {
  const timestamps = new Set(Object.keys(selected.value).map(Number));
  return groups.value.flatMap((group) => group.sessions).filter((session) => timestamps.has(session.timestamp));
}

async function loadSessionGroups(): Promise<void> {
  const groupResult = await loadGroups();
  if (!groupResult.success) setMessage(groupResult.error, 'error');
}

function savedAt(session: Session): string {
  return Time.formatRelative(session.timestamp);
}

async function exportJson(): Promise<void> {
  const sessions = selectedSessions();
  if (!sessions.length) {
    setMessage('Select at least one session.', 'error');
    return;
  }
  const payload = Backup.normalizePayload({ sessions, twoFactorEntries: [] });
  DOM.downloadFile(Backup.exportJSON(payload), `backup-${sessions.length}-sessions.json`, 'application/json');
  setMessage(`Exported ${sessions.length} sessions.`, 'success');
  await actionFeedback.finish('json', 'Done!', () => emit('toast', `${sessions.length} sessions exported`));
}

function requestOwiExport(): void {
  if (!selectedSessions().length) {
    setMessage('Select at least one session.', 'error');
    return;
  }
  owiPasswordOpen.value = true;
}

async function exportOwi(password: string): Promise<void> {
  const sessions = selectedSessions();
  owiPasswordOpen.value = false;
  busy.value = true;
  clearMessage();
  const payload = Backup.normalizePayload({ sessions, twoFactorEntries: [] });
  const result = await Crypto.exportOWI(payload, password, `backup-${sessions.length}-${Format.fileName(sessions[0]?.domain || 'sessions', 'sessions')}`);
  busy.value = false;
  if (!result.success) {
    setMessage(result.error, 'error');
    return;
  }
  setMessage(`Exported ${sessions.length} sessions.`, 'success');
  await actionFeedback.finish('owi', 'Done!', () => emit('toast', `${sessions.length} sessions exported as OWI`));
}

async function deleteSelected(): Promise<void> {
  const sessions = selectedSessions();
  if (!sessions.length) {
    setMessage('Select at least one session.', 'error');
    return;
  }
  emit('confirm-delete', sessions);
}
</script>

<style scoped>
.sm-modal-panel {
  width: 388px;
  max-width: 94vw;
  max-height: calc(100vh - 32px);
}

.sm-modal-body {
  max-height: calc(100vh - 140px);
  padding: 10px 10px 12px;
}

.sm-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.sm-select-all {
  padding: 4px 10px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  background: none;
  color: var(--clr-text-muted);
  font-size: var(--fs-sm);
}

.sm-select-all:hover:not(:disabled) {
  background: var(--clr-background-alt);
}

.sm-select-all:disabled {
  opacity: 0.45;
}

.sm-selected-count {
  color: var(--clr-text-light);
  font-size: var(--fs-sm);
}

.sm-domain-delete {
  padding: 3px 6px;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--clr-danger-hover);
  font-size: var(--fs-xs);
  font-weight: 800;
}

.sm-domain-delete:hover:not(:disabled) {
  background: color-mix(in srgb, var(--clr-danger-hover) 10%, transparent);
}

.group-overview-card {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0;
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
  gap: 6px;
  color: var(--clr-text-muted);
  font-size: var(--fs-sm);
}

.overview-stat i {
  color: var(--clr-primary);
}

.overview-stat span {
  color: var(--clr-text);
  font-size: var(--fs-md);
  font-weight: 700;
}

.overview-stat label {
  color: var(--clr-text-light);
  font-size: var(--fs-xs);
}

.sm-groups-container {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.domain-card {
  overflow: hidden;
  margin: 6px 0 0;
  border: 1px solid var(--clr-border);
  border-radius: 10px;
  background: white;
  transition: border-color 0.16s ease, box-shadow 0.16s ease;
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
  gap: 12px;
  padding: 10px 12px;
  background: white;
  text-align: left;
}

.domain-card-header:hover {
  background: linear-gradient(135deg, var(--clr-background-alt), var(--clr-border));
}

.domain-card-left {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  gap: 9px;
}

.domain-favicon,
.domain-favicon-fallback {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  border-radius: 4px;
}

.domain-favicon-fallback {
  display: none;
  align-items: center;
  justify-content: center;
  background: #e2e8f0;
  color: #475569;
  font-size: 10px;
}

.domain-favicon-fallback.visible {
  display: inline-flex;
}

.domain-info {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 1px;
}

.domain-name {
  overflow: hidden;
  color: var(--clr-text);
  font-size: var(--fs-sm);
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.domain-meta {
  overflow: hidden;
  color: var(--clr-text-light);
  font-size: var(--fs-xs);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.domain-card-right {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 7px;
}

.exp-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 7px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.exp-badge.session { background: #eef2ff; color: #4338ca; }
.exp-badge.notice { background: #ecfeff; color: #0f766e; }
.exp-badge.warning { background: #fef3c7; color: #b45309; }
.exp-badge.critical { background: #fee2e2; color: #b91c1c; }
.exp-badge.expired { background: #f3f4f6; color: #4b5563; }

.sm-selected-pill {
  padding: 2px 7px;
  border-radius: 999px;
  background: #dcfce7;
  color: #166534;
  font-size: 10px;
  font-weight: 700;
}

.domain-card-content {
  display: none;
  flex-direction: column;
  gap: 5px;
  padding: 0 8px 8px;
  background: linear-gradient(180deg, #f8fafc 0%, #fff 100%);
}

.domain-card-content.show {
  display: flex;
}

.sm-session-row {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid transparent;
  border-radius: 9px;
  background: white;
  text-align: left;
}

.sm-session-row:hover {
  border-color: #cbd5e1;
  background: #f8fafc;
}

.sm-session-row.selected {
  border-color: #86efac;
  background: #f0fdf4;
}

.sm-session-main {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 2px;
}

.sm-session-name {
  overflow: hidden;
  color: var(--clr-text);
  font-size: var(--fs-sm);
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sm-session-meta,
.sm-session-time {
  color: var(--clr-text-light);
  font-size: var(--fs-xs);
}

.sm-session-time {
  flex-shrink: 0;
}

.sm-domain-checkbox,
.sm-session-checkbox {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  accent-color: var(--clr-success);
  cursor: pointer;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 4px;
  color: var(--clr-text-muted);
  font-size: var(--fs-xs);
}

.dpage-btn {
  width: 24px;
  height: 24px;
  border: 1px solid var(--clr-border);
  border-radius: 7px;
  background: white;
  color: var(--clr-text-muted);
}

.dpage-btn:disabled {
  opacity: 0.45;
}

.sm-empty {
  display: grid;
  place-items: center;
  gap: 8px;
  min-height: 180px;
  color: var(--clr-text-light);
  text-align: center;
}
</style>
