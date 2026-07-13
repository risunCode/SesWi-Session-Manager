<template>
  <label
    class="sw-search"
    role="search"
  >
    <span class="sr-only">{{ label }}</span>
    <i
      class="fa-solid fa-magnifying-glass sw-search__icon"
      aria-hidden="true"
    />
    <input
      class="sw-search__input"
      type="text"
      :value="modelValue"
      :placeholder="placeholder"
      :aria-label="label"
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    >
  </label>
</template>

<script setup lang="ts">
defineProps<{ modelValue: string; placeholder: string; label: string }>();
defineEmits<{ 'update:modelValue': [value: string] }>();
</script>
