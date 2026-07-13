<template>
  <ModalBase
    :open="open"
    title="Add 2FA Entry"
    icon="fa-solid fa-shield-halved"
    @close="emit('close')"
  >
    <p class="twofa-add__intro">Choose how you want to add your authenticator entry.</p>
    <div class="twofa-add__options">
      <button class="sw-card sw-card--interactive twofa-add__option" type="button" @click="emit('choose', 'manual')">
        <i class="fa-solid fa-keyboard" aria-hidden="true" />
        <span><strong>Add Manually</strong><small>Enter a Base32 secret or OTPAuth URI.</small></span>
        <i class="fa-solid fa-chevron-right" aria-hidden="true" />
      </button>
      <button class="sw-card sw-card--interactive twofa-add__option" type="button" @click="emit('choose', 'scan')">
        <i class="fa-solid fa-qrcode" aria-hidden="true" />
        <span><strong>Scan QR Code</strong><small>Capture an OTP QR code from the current tab.</small></span>
        <i class="fa-solid fa-chevron-right" aria-hidden="true" />
      </button>
      <button class="sw-card sw-card--interactive twofa-add__option" type="button" @click="emit('choose', 'import')">
        <i class="fa-solid fa-file-import" aria-hidden="true" />
        <span><strong>Import Authenticator</strong><small>Aegis, Google migration, Bitwarden, Ente, or OTPAuth.</small></span>
        <i class="fa-solid fa-chevron-right" aria-hidden="true" />
      </button>
    </div>
  </ModalBase>
</template>

<script setup lang="ts">
import ModalBase from './ModalBase.vue';

defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: []; choose: [choice: 'manual' | 'scan' | 'import'] }>();
</script>

<style scoped>
.twofa-add__intro { margin: 0 0 12px; color: var(--clr-text-muted); font-size: var(--fs-sm); }
.twofa-add__options { display: grid; gap: 8px; }
.twofa-add__option { display: grid; grid-template-columns: 28px 1fr 16px; align-items: center; gap: 10px; width: 100%; padding: 11px; text-align: left; }
.twofa-add__option > i:first-child { color: var(--clr-primary); font-size: 17px; text-align: center; }
.twofa-add__option > i:last-child { color: var(--clr-text-light); font-size: 12px; }
.twofa-add__option span { display: grid; gap: 2px; }
.twofa-add__option small { color: var(--clr-text-muted); font-size: var(--fs-xs); }
</style>
