<template>
  <header
    class="app-header"
    role="banner"
  >
    <div class="app-header__current">
      <i
        class="fa-solid fa-cookie-bite app-header__icon"
        aria-hidden="true"
      />
      <div class="app-header__url-wrap">
        <span class="app-header__label">Current URL</span>
        <h1
          class="app-header__url"
          :title="currentUrl"
        >
          {{ displayUrl }}
        </h1>
      </div>
    </div>
    <button
      class="sw-btn sw-btn--amber app-header__add"
      type="button"
      aria-label="Add new session"
      @click="$emit('add-session')"
    >
      <i
        class="fa-solid fa-plus"
        aria-hidden="true"
      />
      <span>Add Session</span>
    </button>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ currentUrl: string }>();
defineEmits<{ 'add-session': [] }>();

const displayUrl = computed(() => {
  try {
    return new URL(props.currentUrl).hostname.replace(/^www\./, '') || props.currentUrl;
  } catch {
    return props.currentUrl;
  }
});
</script>

<style scoped>
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 14px;
  background: var(--gradient-header);
  color: white;
  border-radius: 0 0 12px 12px;
  box-shadow: var(--shadow-header);
}

.app-header__current {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  gap: 8px;
}

.app-header__icon {
  flex: 0 0 auto;
  font-size: 18px;
}

.app-header__url-wrap {
  min-width: 0;
}

.app-header__label {
  display: block;
  margin-bottom: 1px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.app-header__url {
  max-width: 190px;
  overflow: hidden;
  color: white;
  font-size: var(--fs-md);
  font-weight: 800;
  line-height: 1.1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-header__add {
  flex: 0 0 auto;
  padding: 6px 12px;
  font-size: var(--fs-xs);
}
</style>
