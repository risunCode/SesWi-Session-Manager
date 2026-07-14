<template>
  <section
    id="manage-panel"
    class="tab-panel"
    role="tabpanel"
    aria-labelledby="manage-tab"
  >
    <ManageSection
      title="Sessions"
      icon="fa-solid fa-box-archive"
      collapsible
      :default-open="true"
    >
      <ManageCard
        title="Backup & Restore"
        description="Export or import sessions and 2FA"
        icon="fa-solid fa-arrow-right-arrow-left"
        tone="blue"
        @click="$emit('open-modal', 'backupRestore')"
      />
      <ManageCard
        title="Session Manager"
        description="Manage saved sessions and delete domains"
        icon="fa-solid fa-sliders"
        tone="indigo"
        @click="$emit('open-modal', 'sessionManager')"
      />
      <ManageCard
        title="2FA Manager"
        description="Review and delete saved authenticator entries"
        icon="fa-solid fa-shield-halved"
        tone="violet"
        @click="$emit('open-modal', 'twoFactorManager')"
      />
    </ManageSection>

    <ManageSection
      title="Security"
      icon="fa-solid fa-shield-halved"
    >
      <ManageCard
        title="Master Password"
        description="Encrypt saved sessions and 2FA entries"
        icon="fa-solid fa-lock"
        tone="green"
        @click="$emit('open-modal', 'masterPassword')"
      />
    </ManageSection>

    <ManageSection
      title="Miscellaneous"
      icon="fa-solid fa-shapes"
      collapsible
      :default-open="true"
    >
      <ManageCard
        title="Tips & Shortcuts"
        description="Learn popup menus and keyboard commands"
        icon="fa-solid fa-lightbulb"
        tone="violet"
        @click="$emit('open-modal', 'tipsShortcuts')"
      />
      <ManageCard
        title="Check for Updates"
        description="View the latest GitHub release"
        icon="fa-solid fa-rotate"
        tone="amber"
        :badge="updateBadge"
        @click="$emit('check-updates')"
      />
      <div class="manage-danger-zone">
        <div class="manage-danger-zone__heading">
          <span>Danger Zone</span>
          <small>This action cannot be undone</small>
        </div>
        <ManageCard
          title="Reset All Data"
          description="Permanently remove sessions, 2FA, and settings"
          icon="fa-solid fa-trash-can"
          tone="red"
          @click="$emit('reset-data')"
        />
      </div>
    </ManageSection>
  </section>
</template>

<script setup lang="ts">
import type { ModalKey } from '../composables/useModalStack';
import ManageCard from '../manage/ManageCard.vue';
import ManageSection from '../manage/ManageSection.vue';

withDefaults(defineProps<{ updateBadge?: string }>(), {
  updateBadge: 'v4.0.2',
});
defineEmits<{ 'open-modal': [modal: Exclude<ModalKey, null>]; 'check-updates': []; 'reset-data': [] }>();
</script>

<style scoped>
.tab-panel {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  gap: 8px;
  overflow-y: auto;
  padding-right: 2px;
}

.manage-danger-zone {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 2px;
  padding: 9px;
  border: 1px solid rgba(220, 38, 38, 0.2);
  border-radius: var(--radius-md);
  background: rgba(254, 242, 242, 0.68);
}

.manage-danger-zone__heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  padding: 0 2px;
}

.manage-danger-zone__heading span {
  color: var(--clr-danger-hover);
  font-size: var(--fs-xs);
  font-weight: 800;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.manage-danger-zone__heading small {
  overflow: hidden;
  color: var(--clr-text-light);
  font-size: var(--fs-xs);
  text-align: right;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
