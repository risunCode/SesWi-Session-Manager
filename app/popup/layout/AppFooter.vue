<template>
  <footer
    class="app-footer"
    role="contentinfo"
  >
    <div class="app-footer__identity">
      <i
        class="fa-solid fa-cookie-bite app-footer__icon"
        aria-hidden="true"
      />
      <span class="app-footer__brand">
        SesWi {{ version }} by risunCode
      </span>
      <a
        v-if="hasUpdate && updateUrl"
        :href="updateUrl"
        target="_blank"
        rel="noreferrer"
        class="app-footer__update"
        aria-label="New version available"
      >
        <i
          class="fa-solid fa-arrow-up"
          aria-hidden="true"
        />
        <span>New {{ latestVersion ? `v${latestVersion}` : 'version' }}</span>
      </a>
    </div>
    <div class="app-footer__actions">
      <a
        href="https://github.com/risunCode/SesWi-Session-Manager"
        target="_blank"
        rel="noreferrer"
        class="app-footer__project"
        aria-label="Open project page on GitHub"
      >
        <i
          class="fa-brands fa-github"
          aria-hidden="true"
        />
        <span>Open Project Page</span>
      </a>
    </div>
  </footer>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ version: string; hasUpdate?: boolean; latestVersion?: string; updateUrl?: string | null }>(), {
  hasUpdate: false,
  latestVersion: '',
  updateUrl: null,
});
</script>

<style scoped>
.app-footer {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 12px;
  border-top: 1px solid var(--clr-border);
  background: var(--gradient-shell);
  color: var(--clr-text-muted);
  font-size: var(--fs-sm);
  font-weight: 800;
}

.app-footer__identity,
.app-footer__actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.app-footer__identity {
  min-width: 0;
}

.app-footer__icon {
  color: var(--clr-teal);
  font-size: var(--fs-base);
}

.app-footer__brand {
  white-space: nowrap;
}

.app-footer__update,
.app-footer__project {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  text-decoration: none;
}

.app-footer__project {
  padding: 3px 8px;
  border-radius: var(--radius-md);
  background: var(--clr-background-alt);
  color: var(--clr-text-secondary);
  font-size: var(--fs-xs);
  font-weight: 700;
  transition: background 0.15s ease, color 0.15s ease;
}

.app-footer__project:hover {
  background: var(--clr-border);
  color: var(--clr-text);
}

.app-footer__update {
  padding: 2px 8px;
  border-radius: var(--radius-lg);
  background: linear-gradient(135deg, #10b981, #059669);
  color: white;
  font-size: var(--fs-xs);
  animation: pulse-badge 2s ease-in-out infinite;
}
</style>
