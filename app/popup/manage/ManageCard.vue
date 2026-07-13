<template>
  <button
    class="sw-card manage-card"
    type="button"
    @click="$emit('click')"
  >
    <div class="manage-card__left">
      <span
        class="sw-icon-chip"
        :class="`sw-icon-chip--${tone}`"
      >
        <i
          :class="icon"
          aria-hidden="true"
        />
      </span>
      <span class="manage-card__text">
        <strong class="manage-card__title">{{ title }}</strong>
        <span class="manage-card__desc">{{ description }}</span>
      </span>
    </div>
    <span class="manage-card__right">
      <span
        v-if="badge"
        class="sw-badge manage-card__badge"
      >{{ badge }}</span>
      <i
        class="fa-solid fa-chevron-right"
        aria-hidden="true"
      />
    </span>
  </button>
</template>

<script setup lang="ts">
export type ManageTone = 'blue' | 'green' | 'indigo' | 'red' | 'amber' | 'pink' | 'violet';

defineProps<{ title: string; description: string; icon: string; tone: ManageTone; badge?: string }>();
defineEmits<{ click: [] }>();
</script>

<style scoped>
.manage-card {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  color: inherit;
  text-align: left;
  transition: all 0.15s ease;
}

.manage-card:hover {
  background: #fafafa;
  border-color: var(--clr-teal-soft);
}

.manage-card__left,
.manage-card__right {
  display: flex;
  align-items: center;
}

.manage-card__left {
  min-width: 0;
  gap: 10px;
}

.manage-card__right {
  gap: 8px;
  color: var(--clr-text-light);
}

.manage-card__text {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 1px;
}

.manage-card__title {
  color: var(--clr-text);
  font-size: var(--fs-sm);
  font-weight: 800;
}

.manage-card__desc {
  overflow: hidden;
  color: #6b7280;
  font-size: var(--fs-sm);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.manage-card__badge {
  background: var(--clr-violet);
}
</style>
