<template>
  <nav
    v-if="totalPages > 1"
    class="sw-pagination"
    aria-label="Pagination"
  >
    <button
      class="sw-page-btn"
      type="button"
      :disabled="page <= 1"
      aria-label="Previous page"
      @click="$emit('change', page - 1)"
    >
      ‹
    </button>
    <div class="sw-pagination__track">
      <span class="sw-pagination__label">Page {{ page }} of {{ totalPages }}</span>
      <span class="sw-pagination__hint">Scroll to switch</span>
      <span
        class="sw-pagination__bar"
        aria-hidden="true"
      >
        <span :style="{ width: `${progress}%` }" />
      </span>
    </div>
    <button
      class="sw-page-btn"
      type="button"
      :disabled="page >= totalPages"
      aria-label="Next page"
      @click="$emit('change', page + 1)"
    >
      ›
    </button>
  </nav>
</template>

<script setup lang="ts">
import { computed } from 'vue';

defineOptions({ name: 'SwPagination' });
const props = defineProps<{ page: number; totalPages: number }>();
defineEmits<{ change: [page: number] }>();
const progress = computed(() => Math.max(0, Math.min(100, props.totalPages <= 1 ? 100 : (props.page / props.totalPages) * 100)));
</script>
