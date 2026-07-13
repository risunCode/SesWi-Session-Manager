<template>
  <section class="twofa-group">
    <h2 class="twofa-group__title">
      {{ issuer }}
    </h2>
    <div class="twofa-group__list">
      <slot />
    </div>
  </section>
</template>

<script setup lang="ts">
defineProps<{ issuer: string }>();
</script>

<style scoped>
.twofa-group {
  display: flex;
  min-width: 0;
  flex: 0 0 auto;
  flex-direction: column;
  gap: 5px;
}

.twofa-group__title {
  padding: 2px 2px 0;
  color: var(--clr-text-light);
  font-size: var(--fs-xs);
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.twofa-group__list {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
</style>
