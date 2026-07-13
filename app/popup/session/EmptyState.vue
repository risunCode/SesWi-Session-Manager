<template>
  <div
    class="empty-state"
    role="status"
  >
    <i
      :class="icon"
      aria-hidden="true"
    />
    <p>{{ message }}</p>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ message: string; icon?: string }>(), {
  icon: 'fa-solid fa-folder-open',
});
</script>

<style scoped>
.empty-state {
  display: flex;
  min-height: 180px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 42px 20px;
  border: 1px solid var(--clr-border);
  border-radius: 12px;
  background: var(--clr-background);
  color: var(--clr-text-muted);
  text-align: center;
}

.empty-state i {
  color: var(--clr-text-light);
  font-size: 26px;
}

.empty-state p {
  font-size: var(--fs-lg);
}
</style>
