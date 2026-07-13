<template>
  <Teleport to="body">
    <Transition
      name="sw-modal"
      appear
    >
      <div
        v-if="open"
        class="sw-modal-backdrop"
        @click.self="$emit('close')"
      >
        <section
          class="sw-modal-panel"
          :class="[panelClass, `sw-modal-panel--${size}`]"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="titleId"
        >
          <header class="sw-modal-header">
            <button
              class="sw-traffic-lights"
              type="button"
              :aria-label="closeLabel"
              @click="$emit('close')"
            >
              <span
                class="sw-tl sw-tl--close"
                aria-hidden="true"
              />
              <span
                class="sw-tl sw-tl--minimize"
                aria-hidden="true"
              />
              <span
                class="sw-tl sw-tl--maximize"
                aria-hidden="true"
              />
            </button>
            <h2
              :id="titleId"
              class="sw-modal-title"
            >
              <i
                v-if="icon"
                :class="icon"
                aria-hidden="true"
              />
              <span>{{ title }}</span>
            </h2>
            <slot name="header-extra" />
          </header>
          <div
            v-if="$slots['after-header']"
            class="sw-modal-after-header"
          >
            <slot name="after-header" />
          </div>
          <div
            class="sw-modal-body"
            :class="bodyClass"
          >
            <slot />
          </div>
          <footer
            v-if="$slots.footer"
            class="sw-modal-footer"
          >
            <slot name="footer" />
          </footer>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, watch } from 'vue';

const props = withDefaults(defineProps<{ open: boolean; title: string; icon?: string; size?: 'sm' | 'md' | 'lg'; panelClass?: string; bodyClass?: string; closeLabel?: string }>(), {
  icon: '',
  size: 'md',
  panelClass: '',
  bodyClass: '',
  closeLabel: 'Close modal',
});
const emit = defineEmits<{ close: [] }>();
const titleId = computed(() => `modal-${props.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`);

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') emit('close');
}

watch(() => props.open, (open) => {
  if (open) window.addEventListener('keydown', onKeydown);
  else window.removeEventListener('keydown', onKeydown);
}, { immediate: true });

onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown));
</script>

<style scoped>
.sw-traffic-lights {
  display: flex;
  gap: 6px;
  background: transparent;
  padding: 0;
}

.sw-modal-title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
</style>
