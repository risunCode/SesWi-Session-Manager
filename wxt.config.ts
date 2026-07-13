import { fileURLToPath } from 'node:url';
import { defineConfig } from 'wxt';

const alias = {
  '@': fileURLToPath(new URL('./app', import.meta.url)),
  '@app': fileURLToPath(new URL('./app', import.meta.url)),
  '@features': fileURLToPath(new URL('./app/features', import.meta.url)),
  '@platform': fileURLToPath(new URL('./app/platform', import.meta.url)),
  '@shared': fileURLToPath(new URL('./app/shared', import.meta.url)),
  '@styles': fileURLToPath(new URL('./app/styles', import.meta.url)),
};

export default defineConfig({
  manifestVersion: 3,
  entrypointsDir: 'app/entrypoints',
  publicDir: 'app/public',
  modules: ['@wxt-dev/module-vue'],
  vite: () => ({
    resolve: { alias },
    build: {
      modulePreload: false,
    },
  }),
  manifest: ({ browser }) => ({
    name: 'SesWi - Session Manager',
    description: 'Advanced Session Manager - Save & restore login sessions easily',
    permissions: ['activeTab', 'tabs', 'cookies', 'storage', 'scripting', 'history', 'browsingData', ...(browser === 'chrome' ? ['offscreen'] : [])],
    commands: {
      open_seswi: {
        suggested_key: {
          default: 'Alt+Q',
        },
        description: 'Open the SesWi popup',
      },

    },
    host_permissions: ['<all_urls>', 'https://api.github.com/*'],
    ...(browser === 'chrome' ? { minimum_chrome_version: '127' } : {}),
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'self'; style-src 'self'; connect-src 'self' https://api.github.com",
    },
    ...(browser === 'firefox'
      ? {
          browser_specific_settings: {
            gecko: {
              id: 'seswi-session-manager@risuncode.com',
              strict_min_version: '109.0',
              data_collection_permissions: {
                required: ['none'],
              },
            },
          },
        }
      : {}),
  }),
});
