<template>
  <section
    class="manage-section"
    :aria-label="title"
  >
    <button
      v-if="collapsible"
      class="manage-section__toggle"
      type="button"
      :aria-expanded="open"
      :aria-controls="contentId"
      @click="open = !open"
    >
      <span class="manage-section__title">
        <i
          v-if="icon"
          :class="icon"
          aria-hidden="true"
        />
        <span>{{ title }}</span>
      </span>
      <i
        class="fa-solid fa-chevron-down manage-section__chevron"
        :class="{ 'is-open': open }"
        aria-hidden="true"
      />
    </button>
    <h2
      v-else
      class="manage-section__title"
    >
      <i
        v-if="icon"
        :class="icon"
        aria-hidden="true"
      />
      <span>{{ title }}</span>
    </h2>
    <div
      v-if="open"
      :id="contentId"
      class="manage-section__cards"
    >
      <slot />
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

const props = withDefaults(defineProps<{ title: string; icon?: string; collapsible?: boolean; defaultOpen?: boolean }>(), {
  icon: '',
  collapsible: false,
  defaultOpen: true,
});

const open = ref(props.defaultOpen);
const contentId = computed(() => `manage-section-${props.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`);
</script>

<style scoped>
.manage-section {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.manage-section + .manage-section {
  margin-top: 2px;
}

.manage-section__toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 2px 2px;
  color: var(--clr-text-light);
  transition: color 0.15s ease;
}

.manage-section__toggle:hover {
  color: var(--clr-text);
}

.manage-section__title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: inherit;
  font-size: var(--fs-xs);
  font-weight: 800;
  letter-spacing: 0.06em;
  text-align: left;
  text-transform: uppercase;
}

.manage-section__title i {
  width: 14px;
  color: var(--clr-teal);
  font-size: 11px;
  text-align: center;
}

.manage-section__chevron {
  font-size: 11px;
  transition: transform 0.18s ease;
}

.manage-section__chevron.is-open {
  transform: rotate(180deg);
}

.manage-section__cards {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
</style>
