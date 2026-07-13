<template>
  <nav
    class="sw-tabs tab-nav"
    role="tablist"
    aria-label="Main navigation"
  >
    <button
      v-for="tab in tabs"
      :id="`${tab.id}-tab`"
      :key="tab.id"
      type="button"
      class="sw-tab"
      :class="{ 'sw-tab--active': tab.id === active }"
      role="tab"
      :aria-selected="tab.id === active"
      :aria-controls="`${tab.id}-panel`"
      @click="$emit('change', tab.id)"
    >
      <i
        :class="tab.icon"
        aria-hidden="true"
      />
      <span>{{ tab.label }}</span>
    </button>
  </nav>
</template>

<script setup lang="ts">
export type TabId = 'current' | 'groups' | 'twofa' | 'manage';

defineProps<{ active: TabId }>();
defineEmits<{ change: [tab: TabId] }>();

const tabs: Array<{ id: TabId; label: string; icon: string }> = [
  { id: 'current', label: 'Current', icon: 'fa-solid fa-list-ul' },
  { id: 'groups', label: 'Groups', icon: 'fa-solid fa-layer-group' },
  { id: 'twofa', label: '2FA', icon: 'fa-solid fa-shield' },
  { id: 'manage', label: 'Manage', icon: 'fa-solid fa-gear' },
];
</script>

<style scoped>
.tab-nav {
  position: sticky;
  top: 0;
  z-index: 10;
  margin: 8px 10px 0;
}

.sw-tab {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
</style>
