<template>
  <article
    class="session-card"
    :class="{ 'just-saved': justSaved || justRestored }"
    role="button"
    tabindex="0"
    @click="$emit('open', session)"
    @keydown.enter.prevent="$emit('open', session)"
    @keydown.space.prevent="$emit('open', session)"
  >
    <div class="session-header">
      <span class="session-index">{{ index }}</span>
      <span class="session-name">{{ session.name }}</span>
      <span
        v-if="expirationBadge"
        class="exp-badge"
        :class="expirationBadge.status"
        :title="expirationBadge.title"
      >
        <i :class="expirationBadge.icon" />
        {{ expirationBadge.label }}
      </span>
    </div>
    <div class="session-meta">
      <span class="session-time">{{ relativeTime }}</span>
      <span class="session-cookie-count">
        <span
          v-if="active || justRestored"
          class="session-active-badge"
        >active</span>
        <i
          class="fa-solid fa-cookie-bite"
          aria-hidden="true"
        />
        {{ session.cookies.length }}
      </span>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { Session } from '@features/sessions/session.types';
import { Time } from '@shared/time';

const props = withDefaults(defineProps<{ session: Session; index: number; active?: boolean; justSaved?: boolean; justRestored?: boolean }>(), {
  active: false,
  justSaved: false,
  justRestored: false,
});

defineEmits<{ open: [session: Session] }>();

const relativeTime = computed(() => Time.formatRelative(props.session.timestamp));
const expirationBadge = computed(() => Time.getSessionExpiration(props.session.cookies));
</script>

<style scoped>
.session-card {
  position: relative;
  overflow: hidden;
  padding: 11px 10px;
  border: 1px solid var(--clr-border);
  border-radius: 6px;
  background: var(--clr-surface);
  cursor: pointer;
  transition: all 0.15s ease;
}

.session-card::before {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 2px;
  background: #14b8a6;
  content: '';
  opacity: 0;
  transition: opacity 0.15s ease;
}

.session-card:hover {
  border-color: #14b8a6;
  background: #fafafa;
}

.session-card:hover::before {
  opacity: 1;
}

.session-card.just-saved {
  border-color: var(--clr-success) !important;
  background: #f0fdf4 !important;
}

.session-card.just-saved::before {
  background: var(--clr-success);
  opacity: 1;
}

.session-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 3px;
}

.session-index {
  min-width: 18px;
  padding: 2px 5px;
  border-radius: 4px;
  background: linear-gradient(135deg, #0d9488, #14b8a6);
  color: white;
  font-size: var(--fs-xs);
  font-weight: 700;
  text-align: center;
}

.session-name {
  flex: 1 1 auto;
  min-width: 60px;
  overflow: hidden;
  color: var(--clr-text);
  font-size: var(--fs-sm);
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.session-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
  margin-left: 23px;
  color: var(--clr-text-light);
  font-size: var(--fs-xs);
  font-weight: 500;
}

.session-time {
  flex-shrink: 0;
}

.session-cookie-count {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 3px;
  color: var(--clr-text-light);
}

.session-active-badge {
  padding: 1px 4px;
  border-radius: 4px;
  background: var(--clr-success);
  color: white;
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
}

.exp-badge {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 3px;
  padding: 2px 5px;
  border-radius: 4px;
  font-size: var(--fs-xs);
  font-weight: 600;
}

.exp-badge i {
  font-size: var(--fs-xs);
}

.exp-badge.expired,
.exp-badge.critical {
  background: #fef2f2;
  color: var(--clr-danger-hover);
}

.exp-badge.critical {
  animation: pulse-critical 1.5s infinite;
}

.exp-badge.warning {
  background: #fffbeb;
  color: #d97706;
}

.exp-badge.notice {
  background: #f0f9ff;
  color: #0284c7;
}

.exp-badge.valid {
  background: #f0fdf4;
  color: #16a34a;
}

.exp-badge.session {
  background: var(--clr-background-alt);
  color: var(--clr-text-muted);
}

@keyframes pulse-critical {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}
</style>
