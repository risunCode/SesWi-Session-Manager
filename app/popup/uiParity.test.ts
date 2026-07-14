// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SearchBar from './controls/SearchBar.vue';
import Pagination from './controls/Pagination.vue';
import SessionCard from './session/SessionCard.vue';
import ManageCard from './manage/ManageCard.vue';
import TwoFactorCard from './two-factor/TwoFactorCard.vue';
import ModalBase from './modals/ModalBase.vue';
import AddSessionModal from './modals/AddSessionModal.vue';
import BackupRestoreModal from './modals/BackupRestoreModal.vue';
import SessionActionsModal from './modals/SessionActionsModal.vue';
import SavedDataModal from './modals/SavedDataModal.vue';
import CleanTabModal from './modals/CleanTabModal.vue';
import ExportTabDataModal from './modals/ExportTabDataModal.vue';
import SessionManagerModal from './modals/SessionManagerModal.vue';
import TwoFactorManagerModal from './modals/TwoFactorManagerModal.vue';
import TwoFactorAddModal from './modals/TwoFactorAddModal.vue';
import TwoFactorEntryModal from './modals/TwoFactorEntryModal.vue';
import TwoFactorImportModal from './modals/TwoFactorImportModal.vue';
import { inspectTwoFactorImport } from '@features/two-factor/importFormats';
import { cleanForRestore } from '@features/sessions/cookies';
import { Crypto } from '@features/security/crypto';
import { SessionStorage } from '@features/sessions/sessionStorage';
import { TwoFactorStorage } from '@features/two-factor/twoFactorStorage';
import { DOM } from '@shared/dom';
import { Normalize } from '@shared/normalize';
import { Time } from '@shared/time';
import { parseImportSources } from '@features/backup/import';
import type { ImportSourceItem } from '@features/import/import.types';
import AppHeader from './layout/AppHeader.vue';
import AppFooter from './layout/AppFooter.vue';
import ManageTab from './tabs/ManageTab.vue';
import CurrentTab from './tabs/CurrentTab.vue';
import GroupsTab from './tabs/GroupsTab.vue';
import App from './App.vue';
import LockScreen from './layout/LockScreen.vue';
import MasterPasswordModal from './modals/MasterPasswordModal.vue';
import TipsShortcutsModal from './modals/TipsShortcutsModal.vue';
import { useModalStack, type ModalStack } from './composables/useModalStack';
import { browser } from 'wxt/browser';

vi.mock('@features/updates/updater', () => ({
  checkForUpdate: vi.fn().mockResolvedValue({ hasUpdate: false, latestVersion: '3.5.0', releaseUrl: 'https://github.com/risunCode/SesWi-Session-Manager/releases/latest', currentVersion: '3.5.0' }),
}));

vi.mock('@platform/icons/tabIcons', () => ({
  tabIcons: {
    refresh: vi.fn().mockResolvedValue({ 'example.com': { domain: 'example.com', iconUrl: 'https://example.com/favicon.ico', updatedAt: 1 } }),
    getDomainIcon: vi.fn().mockResolvedValue('https://example.com/favicon.ico'),
    getFaviconUrl: vi.fn(() => 'https://example.com/favicon.ico'),
  },
}));

vi.mock('@features/sessions/sessionStorage', () => ({
  BrowserStorage: {
    getLocal: vi.fn().mockResolvedValue({ success: true, data: { token: 'local-value' } }),
    getSession: vi.fn().mockResolvedValue({ success: true, data: { nonce: 'session-value' } }),
    restore: vi.fn().mockResolvedValue({ success: true, data: { localStorage: 0, sessionStorage: 0 } }),
  },
  CurrentTabExport: { collect: vi.fn().mockResolvedValue({ success: true, data: { domain: 'example.com', url: 'https://example.com', cookies: [undefined, { name: 'sid', value: 'abc', domain: '.example.com', path: '/', expirationDate: 2_000_000_000 }], localStorage: { token: 'local' }, sessionStorage: { nonce: 'session' }, tabId: 1 } }) },
  SessionStorage: {
    delete: vi.fn().mockResolvedValue({ success: true, data: null }),
    deleteMany: vi.fn().mockResolvedValue({ success: true, data: { deleted: 2, remaining: 3 } }),
    getAll: vi.fn().mockResolvedValue({ success: true, data: [
      { id: 'session-1', name: 'Main Login', domain: 'example.com', cookies: [{ name: 'sid', value: 'abc', expirationDate: 2_000_000_000 }], localStorage: { token: 'local' }, sessionStorage: { nonce: 'session' }, timestamp: 1_700_000_000_000, index: 1 },
      { id: 'session-2', name: 'Second Login', domain: 'example.com', cookies: [{ name: 'sid2', value: 'def', expirationDate: 2_000_000_000 }], timestamp: 1_700_000_000_001, index: 2 },
      { id: 'session-3', name: 'Third Login', domain: 'example.com', cookies: [{ name: 'sid3', value: 'ghi', expirationDate: 2_000_000_000 }], timestamp: 1_700_000_000_002, index: 3 },
      { id: 'session-4', name: 'Fourth Login', domain: 'example.com', cookies: [{ name: 'sid4', value: 'jkl', expirationDate: 2_000_000_000 }], timestamp: 1_700_000_000_003, index: 4 },
      { id: 'session-5', name: 'Fifth Login', domain: 'example.com', cookies: [{ name: 'sid5', value: 'mno', expirationDate: 2_000_000_000 }], timestamp: 1_700_000_000_004, index: 5 },
      { id: 'session-6', name: 'Sixth Login', domain: 'example.com', cookies: [{ name: 'sid6', value: 'pqr', expirationDate: 2_000_000_000 }], timestamp: 1_700_000_000_005, index: 6 },
      { id: 'session-7', name: 'Seventh Login', domain: 'example.com', cookies: [{ name: 'sid7', value: 'stu', expirationDate: 2_000_000_000 }], timestamp: 1_700_000_000_006, index: 7 },
      { id: 'session-8', name: 'Foreign Login', domain: 'other.com', cookies: [{ name: 'sid8', value: 'xyz', expirationDate: 2_000_000_000 }], timestamp: 1_700_000_000_007, index: 1 },
    ] }),
    getByDomain: vi.fn().mockResolvedValue({ success: true, data: [
      { id: 'session-1', name: 'Main Login', domain: 'example.com', originalUrl: 'https://example.com', cookies: [{ name: 'sid', value: 'abc', expirationDate: 2_000_000_000 }], localStorage: { token: 'local' }, sessionStorage: { nonce: 'session' }, timestamp: 1_700_000_000_000, index: 1 },
      { id: 'session-2', name: 'Second Login', domain: 'example.com', cookies: [{ name: 'sid2', value: 'def', expirationDate: 2_000_000_000 }], timestamp: 1_700_000_000_001, index: 2 },
      { id: 'session-3', name: 'Third Login', domain: 'example.com', cookies: [{ name: 'sid3', value: 'ghi', expirationDate: 2_000_000_000 }], timestamp: 1_700_000_000_002, index: 3 },
      { id: 'session-4', name: 'Fourth Login', domain: 'example.com', cookies: [{ name: 'sid4', value: 'jkl', expirationDate: 2_000_000_000 }], timestamp: 1_700_000_000_003, index: 4 },
      { id: 'session-5', name: 'Fifth Login', domain: 'example.com', cookies: [{ name: 'sid5', value: 'mno', expirationDate: 2_000_000_000 }], timestamp: 1_700_000_000_004, index: 5 },
      { id: 'session-6', name: 'Sixth Login', domain: 'example.com', cookies: [{ name: 'sid6', value: 'pqr', expirationDate: 2_000_000_000 }], timestamp: 1_700_000_000_005, index: 6 },
      { id: 'session-7', name: 'Seventh Login', domain: 'example.com', cookies: [{ name: 'sid7', value: 'stu', expirationDate: 2_000_000_000 }], timestamp: 1_700_000_000_006, index: 7 },
    ] }),
    getGroupedByDomain: vi.fn().mockResolvedValue({ success: true, data: [{ domain: 'example.com', sessions: [
      { id: 'session-1', name: 'Main Login', domain: 'example.com', cookies: [{ name: 'sid', value: 'abc', expirationDate: 2_000_000_000 }], localStorage: { token: 'local' }, sessionStorage: { nonce: 'session' }, timestamp: 1_700_000_000_000, index: 1 },
      { id: 'session-2', name: 'Second Login', domain: 'example.com', cookies: [{ name: 'sid2', value: 'def', expirationDate: 2_000_000_000 }], timestamp: 1_700_000_000_001, index: 2 },
      { id: 'session-3', name: 'Third Login', domain: 'example.com', cookies: [{ name: 'sid3', value: 'ghi', expirationDate: 2_000_000_000 }], timestamp: 1_700_000_000_002, index: 3 },
      { id: 'session-4', name: 'Fourth Login', domain: 'example.com', cookies: [{ name: 'sid4', value: 'jkl', expirationDate: 2_000_000_000 }], timestamp: 1_700_000_000_003, index: 4 },
      { id: 'session-5', name: 'Fifth Login', domain: 'example.com', cookies: [{ name: 'sid5', value: 'mno', expirationDate: 2_000_000_000 }], timestamp: 1_700_000_000_004, index: 5 },
    ] }] }),
    save: vi.fn().mockResolvedValue({ success: true, data: { id: 'session-1', name: 'Main Login', domain: 'example.com', cookies: [], timestamp: 1 } }),
    update: vi.fn().mockResolvedValue({ success: true, data: { id: 'session-1', name: 'Main Login', domain: 'example.com', cookies: [], timestamp: 1 } }),
  },
  TabInfo: {
    cleanCurrentTab: vi.fn().mockResolvedValue({ success: true, data: null }),
    getCurrent: vi.fn().mockResolvedValue({ success: true, data: { domain: 'example.com', url: 'https://example.com', tabId: 1 } }),
  },
  setMPState: vi.fn(),
  uniqueTimestamp: vi.fn(() => 1_700_000_000_001),
}));

vi.mock('@features/sessions/cookies', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@features/sessions/cookies')>();
  return {
    ...actual,
    Cookies: {
      getCurrentTab: vi.fn().mockResolvedValue({ success: true, data: { cookies: [{ name: 'sid', value: 'abc', domain: '.example.com', path: '/', expirationDate: 2_000_000_000, secure: true }], domain: 'example.com', url: 'https://example.com' } }),
      restore: vi.fn().mockResolvedValue({ success: true, data: { restored: 0, total: 0 } }),
    },
  };
});

vi.mock('@features/backup/backup', () => ({
  buildCanonicalPayload: vi.fn(({ sessions = [], twoFactorEntries = [] } = {}) => ({ version: '2.0', kind: 'seswi-backup', data: { sessions, twoFactorEntries } })),
  Backup: {
    createPayload: vi.fn().mockResolvedValue({ success: true, data: { version: '2.0', kind: 'seswi-backup', data: { sessions: [], twoFactorEntries: [] } } }),
    normalizePayload: vi.fn((input) => ({ version: '2.0', kind: 'seswi-backup', data: { sessions: input.sessions ?? [], twoFactorEntries: input.twoFactorEntries ?? [] } })),
    exportJSON: vi.fn(() => '{}'),
    parseJSON: vi.fn(() => ({ version: '2.0', kind: 'seswi-backup', data: { sessions: [], twoFactorEntries: [] } })),
    parseOWI: vi.fn().mockResolvedValue({ success: true, data: { version: '2.0', kind: 'seswi-backup', data: { sessions: [], twoFactorEntries: [] } } }),
    restorePayload: vi.fn().mockResolvedValue({ success: true, data: { restoredSessions: 0, skippedSessions: 0, restoredTwoFactorEntries: 0, skippedTwoFactorEntries: 0, invalidTwoFactorEntries: 0 } }),
  },
}));

vi.mock('@features/security/crypto', () => ({
  Crypto: { exportOWI: vi.fn().mockResolvedValue({ success: true, data: null }) },
  MasterPassword: {
    decryptProtectedData: vi.fn().mockResolvedValue({ success: true, data: { sessions: [], twoFactorEntries: [] } }),
    getStrength: vi.fn(() => ({ level: '', text: '' })),
    isEnabled: vi.fn().mockResolvedValue(false),
    remove: vi.fn().mockResolvedValue({ success: true, data: null }),
    setup: vi.fn().mockResolvedValue({ success: true, data: null }),
    setupRecovery: vi.fn().mockResolvedValue({ success: true, data: null }),
    hasRecovery: vi.fn().mockResolvedValue(true),
    getRecoveryQuestion: vi.fn().mockResolvedValue('What was your first pet\'s name?'),
    verifyRecoveryAnswer: vi.fn().mockResolvedValue({ success: true, data: true }),
    resetByRecovery: vi.fn().mockResolvedValue({ success: true, data: null }),
    verify: vi.fn().mockResolvedValue({ success: true, data: true }),
  },
}));

vi.mock('@shared/dom', () => ({
  DOM: {
    downloadFile: vi.fn(),
    escapeHtml: vi.fn((value: unknown) => String(value ?? '')),
  },
}));

vi.mock('@features/two-factor/twoFactorStorage', () => ({
  OTPAuth: { parseURI: vi.fn(() => ({ success: true, data: { issuer: 'GitHub', accountName: 'octo@example.com', secret: 'JBSWY3DPEHPK3PXP' } })) },
  TOTP: { generate: vi.fn().mockResolvedValue({ code: '123456', timeRemaining: 20 }) },
  TwoFactorStorage: {
    add: vi.fn().mockResolvedValue({ success: true, data: { id: 'otp-1', issuer: 'GitHub', accountName: 'octo@example.com', secret: 'JBSWY3DPEHPK3PXP' } }),
    delete: vi.fn().mockResolvedValue({ success: true, data: null }),
    getAll: vi.fn().mockResolvedValue({ success: true, data: [] }),
    update: vi.fn().mockResolvedValue({ success: true, data: { id: 'otp-1', issuer: 'GitHub', accountName: 'octo@example.com', secret: 'JBSWY3DPEHPK3PXP' } }),
  },
}));

vi.mock('wxt/browser', () => ({
  browser: {
    history: { search: vi.fn().mockResolvedValue([{ title: 'Example Dashboard', url: 'https://example.com/app', lastVisitTime: Date.now() - 60_000 }]) },
    storage: {
      local: {
        clear: vi.fn().mockResolvedValue(undefined),
        get: vi.fn().mockResolvedValue({}),
        set: vi.fn().mockResolvedValue(undefined),
        remove: vi.fn().mockResolvedValue(undefined),
      },
      session: {
        get: vi.fn().mockResolvedValue({}),
        set: vi.fn().mockResolvedValue(undefined),
        remove: vi.fn().mockResolvedValue(undefined),
      },
    },
    runtime: {
      getURL: vi.fn((path: string) => `chrome-extension://seswi/${path}`),
      sendMessage: vi.fn().mockResolvedValue({ password: null, expiresAt: null }),
      onMessage: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
    },
    tabs: {
      captureVisibleTab: vi.fn().mockResolvedValue('data:image/png;base64,'),
      create: vi.fn().mockResolvedValue({ id: 1 }),
      query: vi.fn().mockResolvedValue([{ id: 1, active: true }, { id: 2, active: false }, { id: 3, active: false }]),
      reload: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
      update: vi.fn().mockResolvedValue({ id: 1 }),
      onUpdated: { addListener: vi.fn(), removeListener: vi.fn() },
    },
  },
}));

const session = {
  id: 'session-1',
  name: 'Main Login',
  domain: 'example.com',
  originalUrl: 'https://example.com/app',
  cookies: [{ name: 'sid', value: 'abc', expirationDate: 2_000_000_000, secure: true }],
  localStorage: { token: 'local' },
  sessionStorage: { nonce: 'session' },
  timestamp: 1_700_000_000_000,
  index: 1,
};

const twoFactorEntry = {
  id: 'otp-1',
  issuer: 'GitHub',
  accountName: 'octo@example.com',
  secret: 'JBSWY3DPEHPK3PXP',
};

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  document.body.innerHTML = '';
});

describe('popup header', () => {
  it('shows only the hostname and keeps the SesWi icon', () => {
    const wrapper = mount(AppHeader, { props: { currentUrl: 'https://www.youtube.com/?themeRefresh=1' } });

    expect(wrapper.text()).toContain('youtube.com');
    expect(wrapper.text()).not.toContain('themeRefresh');
    expect(wrapper.find('.fa-cookie-bite').exists()).toBe(true);
  });
});

describe('shared popup controls', () => {
  it('emits v-model updates from the search bar', async () => {
    const wrapper = mount(SearchBar, { props: { modelValue: '', placeholder: 'Search...', label: 'Search sessions' } });

    await wrapper.get('input').setValue('github');

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['github']);
  });

  it('emits compact pagination changes and disables edges', async () => {
    const wrapper = mount(Pagination, { props: { page: 2, totalPages: 3 } });
    const buttons = wrapper.findAll('button');

    await buttons[0].trigger('click');
    await buttons[1].trigger('click');

    expect(wrapper.emitted('change')).toEqual([[1], [3]]);
    expect(wrapper.text()).toContain('Page 2 of 3');
    expect(wrapper.text()).toContain('Scroll to switch');
    const source = readFileSync('app/styles/components.css', 'utf8');
    expect(source).toContain('border-radius: 10px;');
    expect(source).not.toContain('border-radius: 999px;');
  });
});

describe('expiration display', () => {
  it('shows exact relative time and days-left expiration labels', () => {
    const createdAt = new Date(2026, 6, 7, 10, 19).getTime();
    const future = Math.floor((Date.now() + 356 * 86_400_000) / 1000);
    const exp = Time.getSessionExpiration([{ name: 'sid', expirationDate: future }]);

    expect(Time.formatRelative(createdAt)).toMatch(/07\/07\/26 10:19 ·/);
    expect(exp?.label).toBe('Valid 356d');
    expect(exp?.exact).toMatch(/\d{2}\/\d{2}\/\d{2} \d{2}:\d{2}/);
  });
});

describe('session save normalization', () => {
  it('does not use unbound Validate.isSession callbacks in storage', () => {
    const source = readFileSync('app/features/sessions/sessionStorage.ts', 'utf8');

    expect(source).not.toContain('filter(Validate.isSession)');
  });

  it('sets missing cookie session flags before restore serialization', () => {
    const normalized = Normalize.cookies([undefined, { name: 'sid', value: 'abc', domain: '.example.com', path: '/' }]);
    const details = cleanForRestore(normalized[0]);

    expect(normalized).toHaveLength(1);
    expect(details.expirationDate).toBeUndefined();
    expect(details.name).toBe('sid');
    expect(cleanForRestore({ name: 'sid', value: 'abc', domain: '.example.com', storeId: 'chrome-store' }, 'firefox-default').storeId).toBe('firefox-default');
    expect(cleanForRestore({ name: 'sid', value: 'abc', domain: '.example.com', storeId: 'chrome-store' }).storeId).toBeUndefined();
  });
});

describe('session import normalization', () => {
  it('normalizes raw cookies with session flags for safe restore', () => {
    const sessions = Normalize.importSessions([{ name: 'sid', value: 'abc', domain: '.example.com', path: '/' }], { name: 'Imported', domain: 'example.com' });

    expect(sessions[0].cookies[0]).toMatchObject({ name: 'sid', session: true, path: '/' });
    expect(sessions[0].localStorage).toEqual({});
    expect(sessions[0].sessionStorage).toEqual({});
  });

  it('parses Cookie header text like the old modal', () => {
    const result = Normalize.parseCookieString('Cookie: sid=abc; theme=dark', { name: 'Header Import', domain: 'example.com' });

    expect(result.format).toBe('header');
    expect(result.sessions[0].cookies).toHaveLength(2);
  });
});

describe('manage tab', () => {
  it('groups Sessions, always-open Security, and Miscellaneous tools with section icons', async () => {
    const wrapper = mount(ManageTab);
    const sectionTitles = wrapper.findAll('.manage-section__title').map((node) => node.text());
    const sections = wrapper.findAll('.manage-section');
    const toggles = wrapper.findAll('.manage-section__toggle');
    const cardTitles = wrapper.findAll('.manage-card__title').map((node) => node.text());

    expect(sectionTitles).toEqual(['Sessions', 'Security', 'Miscellaneous']);
    expect(sections).toHaveLength(3);
    expect(sections.every((section) => section.find('.manage-section__title i').exists())).toBe(true);
    expect(toggles).toHaveLength(2);
    expect(toggles.map((toggle) => toggle.text())).toEqual(['Sessions', 'Miscellaneous']);
    expect(sections[1].find('.manage-section__toggle').exists()).toBe(false);
    expect(cardTitles).toEqual([
      'Backup & Restore',
      'Session Manager',
      '2FA Manager',
      'Master Password',
      'Tips & Shortcuts',
      'Check for Updates',
      'Reset All Data',
    ]);
    expect(wrapper.find('.manage-danger-zone').text()).toContain('Danger Zone');
    expect(wrapper.find('.manage-danger-zone').text()).toContain('Permanently remove sessions, 2FA, and settings');
    expect(wrapper.text()).not.toContain('Security & Extension');
    expect(wrapper.text()).not.toContain('Export Tab Data');
    expect(wrapper.text()).not.toContain('Userscript Bridge');
    expect(wrapper.text()).not.toContain('Project Page');

    await wrapper.findAll('button').find((button) => button.text().includes('Session Manager'))?.trigger('click');
    await wrapper.findAll('button').find((button) => button.text().includes('Tips & Shortcuts'))?.trigger('click');
    await wrapper.findAll('button').find((button) => button.text().includes('Check for Updates'))?.trigger('click');
    await wrapper.findAll('button').find((button) => button.text().includes('Reset All Data'))?.trigger('click');

    expect(wrapper.emitted('open-modal')?.[0]).toEqual(['sessionManager']);
    expect(wrapper.emitted('open-modal')?.[1]).toEqual(['tipsShortcuts']);
    expect(wrapper.emitted('check-updates')).toBeTruthy();
    expect(wrapper.emitted('reset-data')).toBeTruthy();
  });
});

describe('tips and shortcuts', () => {
  it('shows popup commands, browser-level Alt+Q, and the main menu map', async () => {
    const wrapper = mount(TipsShortcutsModal, { global: { stubs: { Teleport: true } }, props: { open: true } });

    expect(wrapper.text()).toContain('Tips & Shortcuts');
    expect(wrapper.text()).toContain('Popup shortcuts work while SesWi is open');
    expect(wrapper.text()).toContain('Add Session');
    expect(wrapper.text()).toContain('Fast Clean');
    expect(wrapper.text()).toContain('Fast Lock');
    expect(wrapper.text()).toContain('Open / Close SesWi');
    expect(wrapper.text()).not.toContain('Clear Window');
    expect(wrapper.findAll('kbd').map((key) => key.text())).toEqual(['Ctrl', 'N', 'Ctrl', 'X', 'Ctrl', 'D', 'Alt', 'Q']);
    expect(wrapper.findAll('.shortcut-scope').map((scope) => scope.text())).toEqual(['Popup', 'Popup', 'Popup', 'Browser']);
    expect(wrapper.findAll('.menu-tip strong').map((label) => label.text())).toEqual(['Current', 'Groups', '2FA', 'Manage']);
  });
});

describe('current tab pagination shortcuts', () => {
  it('shows only active-domain sessions, exposes current-tab tools, and switches pages with wheel gestures', async () => {
    expect(readFileSync('app/popup/tabs/CurrentTab.vue', 'utf8')).toContain('const perPage = 5;');
    const wrapper = mount(CurrentTab);
    await flushPromises();

    expect(wrapper.text()).toContain('Main Login');
    expect(wrapper.text()).not.toContain('Foreign Login');
    expect(wrapper.text()).toContain('Clean Current Tab');
    expect(wrapper.text()).toContain('Export This Tab');
    expect(wrapper.find('.session-active-badge').text()).toBe('active');
    expect(wrapper.find('.session-cookie-count').text()).toMatch(/active\s*1/);

    await wrapper.findAll('button').find((button) => button.text().includes('Clean Current Tab'))?.trigger('click');
    await wrapper.findAll('button').find((button) => button.text().includes('Export This Tab'))?.trigger('click');
    expect(wrapper.emitted('open-modal')?.[0]).toEqual(['cleanTab']);
    expect(wrapper.emitted('open-modal')?.[1]).toEqual(['exportTabData']);

    await wrapper.get('.session-list').trigger('wheel', { deltaY: 120 });
    await flushPromises();

    expect(wrapper.find('.sw-pagination__label').text()).toContain('Page 2 of 2');
  });

  it('keeps old Ctrl+N and Ctrl+X shortcut contracts in App', () => {
    const source = readFileSync('app/popup/App.vue', 'utf8');

    expect(source).toContain("key === 'n'");
    expect(source).toContain("openModal('addSession')");
    expect(source).toContain("key === 'x'");
    expect(source).toContain('now - lastCtrlXAt.value < 2_000');
    expect(source).toContain('fastCleanCurrentTab');
    expect(source).toContain("key === 'd'");
    expect(source).toContain('masterLock.lock()');
  });
});

describe('popup startup performance', () => {
  it('renders a safe loading shell, defers update checks, and lazy-loads heavyweight modals', () => {
    const source = readFileSync('app/popup/App.vue', 'utf8');

    expect(source).toContain('v-if="!masterLock.checked.value"');
    expect(source).toContain('class="popup-loading"');
    expect(source).toContain('aria-label="Opening SesWi"');
    expect(source).toContain('const currentTab = loadCurrentTab()');
    expect(source).toContain('await masterLock.init()');
    expect(source).toContain('await Promise.allSettled([currentTab, syncPendingUserscriptPrompt(), restoreFirefoxIntent()])');
    expect(source).toContain('void loadUpdateStatus()');
    expect(source).toContain("defineAsyncComponent(() => import('./modals/BackupRestoreModal.vue'))");
    expect(source).toContain("defineAsyncComponent(() => import('./modals/TwoFactorScanModal.vue'))");
  });
});

describe('lock screen', () => {
  it('renders lock icon, heading, description, input, and action elements', () => {
    const wrapper = mount(LockScreen, {
      props: { open: true, remember: false, busy: false, error: '' },
    });

    expect(wrapper.find('.lock-icon .fa-lock').exists()).toBe(true);
    expect(wrapper.text()).toContain('SesWi is Locked');
    expect(wrapper.text()).toContain('Enter your master password to unlock');
    expect(wrapper.get('input').attributes('placeholder')).toBe('Master password');
    expect(wrapper.get('input').attributes('autofocus')).toBeDefined();
    expect(wrapper.get('.btn-primary').text()).toContain('Unlock');
    expect(wrapper.text()).toContain('Remember for 5 minutes');
    expect(wrapper.find('.lock-forgot-link').exists()).toBe(true);
  });

  it('toggles password visibility via the eye button', async () => {
    const wrapper = mount(LockScreen, {
      props: { open: true, remember: false, busy: false, error: '' },
    });

    const input = wrapper.get('input');
    const eye = wrapper.get('.lock-eye');

    expect(input.attributes('type')).toBe('password');
    expect(eye.get('i').classes()).toContain('fa-eye');
    expect(eye.attributes('aria-label')).toBe('Show password');

    await eye.trigger('click');

    expect(input.attributes('type')).toBe('text');
    expect(eye.get('i').classes()).toContain('fa-eye-slash');
    expect(eye.attributes('aria-label')).toBe('Hide password');

    await eye.trigger('click');

    expect(input.attributes('type')).toBe('password');
    expect(eye.get('i').classes()).toContain('fa-eye');
    expect(eye.attributes('aria-label')).toBe('Show password');
  });

  it('emits unlock with password on submit', async () => {
    const wrapper = mount(LockScreen, {
      props: { open: true, remember: false, busy: false, error: '' },
    });

    await wrapper.get('input').setValue('mysecret');
    await wrapper.get('.btn-primary').trigger('click');

    expect(wrapper.emitted('unlock')?.[0]).toEqual(['mysecret']);
  });

  it('does not emit unlock when password is empty', async () => {
    const wrapper = mount(LockScreen, {
      props: { open: true, remember: false, busy: false, error: '' },
    });

    await wrapper.get('.btn-primary').trigger('click');

    expect(wrapper.emitted('unlock')).toBeUndefined();
  });

  it('blocks unlock when busy', async () => {
    const wrapper = mount(LockScreen, {
      props: { open: true, remember: false, busy: true, error: '' },
    });

    await wrapper.get('input').setValue('secret');
    await wrapper.get('.btn-primary').trigger('click');

    expect(wrapper.emitted('unlock')).toBeUndefined();
  });

  it('shows busy text and disables button when busy', () => {
    const wrapper = mount(LockScreen, {
      props: { open: true, remember: false, busy: true, error: '' },
    });

    expect(wrapper.get('.btn-primary').text()).toContain('Unlocking...');
    expect(wrapper.get('.btn-primary').attributes('disabled')).toBeDefined();
  });

  it('shows error message when provided', () => {
    const wrapper = mount(LockScreen, {
      props: { open: true, remember: false, busy: false, error: 'Wrong password' },
    });

    expect(wrapper.find('.lock-error').exists()).toBe(true);
    expect(wrapper.find('.lock-error').text()).toBe('Wrong password');
  });

  it('does not render error element without error', () => {
    const wrapper = mount(LockScreen, {
      props: { open: true, remember: false, busy: false, error: '' },
    });

    expect(wrapper.find('.lock-error').exists()).toBe(false);
  });

  it('emits update:remember when checkbox changes', async () => {
    const wrapper = mount(LockScreen, {
      props: { open: true, remember: false, busy: false, error: '' },
    });

    await wrapper.get('.lock-remember input').setValue(true);

    expect(wrapper.emitted('update:remember')?.[0]).toEqual([true]);
  });

  it('resets password and eye state when re-opened', async () => {
    const wrapper = mount(LockScreen, {
      props: { open: true, remember: false, busy: false, error: '' },
    });

    await wrapper.get('input').setValue('secret');
    await wrapper.get('.lock-eye').trigger('click');
    expect(wrapper.get('input').attributes('type')).toBe('text');

    await wrapper.setProps({ open: false });
    await wrapper.setProps({ open: true });

    const freshInput = wrapper.get('input');
    expect((freshInput.element as HTMLInputElement).value).toBe('');
    expect(freshInput.attributes('type')).toBe('password');
  });
});

describe('two factor overflow', () => {
  it('keeps 2FA cards visible in a scrollable list instead of clipping them', () => {
    const tabSource = readFileSync('app/popup/tabs/TwoFATab.vue', 'utf8');
    const groupSource = readFileSync('app/popup/two-factor/TwoFactorGroup.vue', 'utf8');

    expect(tabSource).toContain('flex: 1 1 0');
    expect(tabSource).toContain('overflow-y: auto');
    expect(tabSource).toContain('overscroll-behavior: contain');
    expect(groupSource).toContain('flex: 0 0 auto');
  });
});

describe('groups tab old parity', () => {
  it('keeps domain cards sized normally and scrolls the group list when content overflows', () => {
    const source = readFileSync('app/popup/tabs/GroupsTab.vue', 'utf8');

    expect(source).toContain('flex: 1 1 0');
    expect(source).toContain('overflow-y: auto');
    expect(source).toContain('overscroll-behavior: contain');
    expect(source).toContain('flex: 0 0 auto');
  });

  it('shows overview, expandable domain cards, and per-domain pagination', async () => {
    const wrapper = mount(GroupsTab);
    await flushPromises();

    expect(wrapper.find('.group-overview-card').text()).toContain('Domains');
    expect(wrapper.find('.domain-card').exists()).toBe(true);
    expect(wrapper.find('.domain-card-content').classes()).not.toContain('show');
    expect(wrapper.find('.exp-badge').exists()).toBe(false);

    await wrapper.get('.domain-card-header').trigger('click');

    expect(wrapper.find('.domain-card.expanded').exists()).toBe(true);
    expect(wrapper.find('.domain-card-content.show').exists()).toBe(true);
    expect(wrapper.find('.pagination').text()).toContain('1/2');
    expect(wrapper.findAll('.dpage-btn')).toHaveLength(2);
  });
});

describe('export tab data modal', () => {
  it('offers only compatible JSON copy and Netscape file export', () => {
    const wrapper = mount(ExportTabDataModal, { attachTo: document.body, global: { stubs: { Teleport: true } }, props: { open: true } });

    expect(wrapper.find('.qa-modal').exists()).toBe(true);
    expect(wrapper.text()).toContain('Export This Tab');
    expect(wrapper.text()).toContain('Export current-tab cookies without saving a session.');
    expect(wrapper.text()).toContain('Copy JSON Compatible');
    expect(wrapper.text()).toContain('Raw Cookie Editor-compatible JSON');
    expect(wrapper.text()).toContain('Export Netscape File');
    expect(wrapper.findAll('.qa-export-btn')).toHaveLength(2);
    expect(wrapper.text()).not.toContain('Export JSON File');
    expect(wrapper.text()).not.toContain('Cookie Editor ext');
  });
});

describe('session manager modal', () => {
  it('matches grouped-tab cards, stays collapsed by default, and exposes bulk actions', async () => {
    const wrapper = mount(SessionManagerModal, { attachTo: document.body, global: { stubs: { Teleport: true } }, props: { open: true } });
    await flushPromises();

    expect(wrapper.find('.group-overview-card').exists()).toBe(true);
    expect(wrapper.find('.domain-card').exists()).toBe(true);
    expect(wrapper.find('.domain-card-content.show').exists()).toBe(false);
    expect(wrapper.text()).toContain('Session Manager');
    expect(wrapper.text()).toContain('example.com');
    expect(wrapper.text()).toContain('0 selected');
    expect(wrapper.text()).toContain('JSON');
    expect(wrapper.text()).toContain('OWI');
    expect(wrapper.text()).toContain('Delete');
    expect(readFileSync('app/popup/modals/SessionManagerModal.vue', 'utf8')).toContain('expandedDomain');
  });

  it('exports selected sessions and requests modal confirmation before bulk deletion', async () => {
    vi.useFakeTimers();
    const wrapper = mount(SessionManagerModal, { attachTo: document.body, global: { stubs: { Teleport: true } }, props: { open: true } });
    await flushPromises();

    await wrapper.get('.domain-card-header').trigger('click');
    await wrapper.get('.sm-session-row').trigger('click');
    await wrapper.findAll('.sw-btn').find((button) => button.text().includes('JSON'))?.trigger('click');
    await flushPromises();
    await vi.runAllTimersAsync();
    await wrapper.findAll('.sw-btn').find((button) => button.text().includes('OWI'))?.trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('Set OWI Export Password');
    await wrapper.get('#owi-export-password').setValue('secret-pass');
    await wrapper.findAll('.sw-btn').find((button) => button.text().includes('Export OWI'))?.trigger('click');
    await flushPromises();
    await vi.runAllTimersAsync();
    await wrapper.findAll('.sw-btn').find((button) => button.text().includes('Delete'))?.trigger('click');

    expect(DOM.downloadFile).toHaveBeenCalled();
    expect(Crypto.exportOWI).toHaveBeenCalled();
    expect(SessionStorage.deleteMany).not.toHaveBeenCalled();
    expect(wrapper.emitted('confirm-delete')?.[0]?.[0]).toMatchObject([{ timestamp: 1_700_000_000_000 }]);
  });
});

describe('card primitives', () => {
  it('renders session details, highlight classes, and open event', async () => {
    const wrapper = mount(SessionCard, { props: { session, index: 7, justSaved: true } });

    expect(wrapper.text()).toContain('7');
    expect(wrapper.text()).toContain('Main Login');
    expect(wrapper.text()).toContain('Valid');
    expect(wrapper.find('.session-cookie-count').text()).toContain('1');
    expect(wrapper.classes()).toContain('just-saved');

    await wrapper.trigger('click');

    expect(wrapper.emitted('open')?.[0]).toEqual([session]);
  });

  it('renders manage tones, badges, and click emit', async () => {
    const wrapper = mount(ManageCard, {
      props: { title: 'Master Password', description: 'Protect data', icon: 'fa-solid fa-shield', tone: 'green', badge: 'OFF' },
    });

    expect(wrapper.find('.sw-icon-chip--green').exists()).toBe(true);
    expect(wrapper.text()).toContain('OFF');

    await wrapper.trigger('click');

    expect(wrapper.emitted('click')).toHaveLength(1);
  });

  it('renders a deterministic 2FA avatar and explicit entry actions', async () => {
    const wrapper = mount(TwoFactorCard, { props: { entry: twoFactorEntry, code: '123456', isCodeVisible: false } });

    expect(wrapper.get('.twofa-card__avatar').text()).toBe(twoFactorEntry.accountName.charAt(0).toUpperCase());
    expect(wrapper.get('.twofa-card__code').text()).toBe('••••••');
    await wrapper.setProps({ isCodeVisible: true });
    expect(wrapper.get('.twofa-card__code').text()).toBe('123456');
    expect(wrapper.text()).toContain('Edit');
    expect(wrapper.text()).toContain('Delete');
    await wrapper.get('.twofa-card__code').trigger('click');
    await wrapper.findAll('.twofa-card__actions button')[0].trigger('click');
    await wrapper.findAll('.twofa-card__actions button')[1].trigger('click');

    expect(wrapper.emitted('copy')).toHaveLength(1);
    expect(wrapper.emitted('edit')?.[0]).toEqual([twoFactorEntry]);
    expect(wrapper.emitted('delete')?.[0]).toEqual([twoFactorEntry]);
  });
});

describe('modal close animation lifecycle', () => {
  it('retains a lazy modal until its leave transition finishes', async () => {
    vi.useFakeTimers();
    let modalStack: ModalStack | undefined;
    const wrapper = mount({
      setup() {
        modalStack = useModalStack();
        return modalStack;
      },
      template: '<div>{{ activeModal }}|{{ renderedModal }}</div>',
    });
    if (!modalStack) throw new Error('Modal stack was not initialized');

    modalStack.openModal('sessionActions');
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toBe('sessionActions|sessionActions');

    modalStack.closeModal();
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toBe('|sessionActions');

    await vi.advanceTimersByTimeAsync(220);
    expect(wrapper.text()).toBe('|');
  });
});

describe('modal interaction feedback', () => {
  it('keeps action-button success feedback English-only before closing', () => {
    const helper = readFileSync('app/popup/composables/useActionFeedback.ts', 'utf8');
    const addModal = readFileSync('app/popup/modals/AddSessionModal.vue', 'utf8');
    const sessionActions = readFileSync('app/popup/modals/SessionActionsModal.vue', 'utf8');

    expect(helper).toContain("doneText = 'Saved!'");
    expect(helper).toContain('remainingMs.value');
    expect(addModal).toContain("actionFeedback.label('submit', 'Save Session'");
    expect(sessionActions).toContain("actionFeedback.label('save-name', 'Save'");
    const picker = readFileSync('app/popup/composables/useFirefoxFilePicker.ts', 'utf8');
    const background = readFileSync('app/background/index.ts', 'utf8');
    expect(picker).toContain('await browser.storage.session.set({ [INTENT_KEY]: intent });');
    expect(background).toContain("input.style.position = 'fixed';");
    expect(background).toContain('input.focus();\n  input.click();');
    expect(`${helper}${addModal}${sessionActions}`).not.toMatch(/Tersimpan|Selesai|Tersalin/);
  });

  it('blurs modal backdrops globally on the shared SesWi shell', () => {
    const components = readFileSync('app/styles/components.css', 'utf8');
    const animations = readFileSync('app/styles/animations.css', 'utf8');
    const addModal = readFileSync('app/popup/modals/AddSessionModal.vue', 'utf8');
    const sessionActions = readFileSync('app/popup/modals/SessionActionsModal.vue', 'utf8');
    const exportModal = readFileSync('app/popup/modals/ExportTabDataModal.vue', 'utf8');

    expect(components).toContain('backdrop-filter: blur(6px)');
    expect(components).toContain('.sw-modal-enter-active');
    expect(components).toContain('.sw-modal-leave-active');
    expect(components).toContain('.sw-modal-leave-to .sw-modal-panel');
    expect(components).toContain('cubic-bezier(0.22, 1, 0.36, 1)');
    expect(animations).toContain('scale(1.012)');
    expect(addModal).toContain('panel-class="add-session-modal__panel"');
    expect(sessionActions).toContain('panel-class="sa-modal"');
    expect(exportModal).toContain('panel-class="qa-modal"');
  });
});

describe('approved cleanup architecture', () => {
  it('centralizes shared formatting, modal message, copied feedback, and snapshot collection', () => {
    expect(readFileSync('app/shared/format.ts', 'utf8')).toContain('export const Format');
    expect(readFileSync('app/popup/composables/useModalMessage.ts', 'utf8')).toContain('useModalMessage');
    expect(readFileSync('app/popup/composables/useCopiedFeedback.ts', 'utf8')).toContain('useCopiedFeedback');
    const snapshot = readFileSync('app/features/sessions/currentTabSnapshot.ts', 'utf8');
    expect(snapshot).toContain('CACHE_TTL_MS');
    expect(snapshot).toContain('invalidate()');
    const cleanTabModal = readFileSync('app/popup/modals/CleanTabModal.vue', 'utf8');
    expect(cleanTabModal).toContain('CurrentTabSnapshot.collect({ includeHistory: true })');
    expect(cleanTabModal).toContain('void loadPreview();\n  void loadWindowTabs();');
    expect(cleanTabModal).toContain("setMessage('No data available for the current tab.', 'error')");
    expect(readFileSync('app/popup/modals/AddSessionModal.vue', 'utf8')).toContain('CurrentTabSnapshot.collect({ force })');
    const sessionStorage = readFileSync('app/features/sessions/sessionStorage.ts', 'utf8');
    const cookies = readFileSync('app/features/sessions/cookies.ts', 'utf8');
    expect(cookies).toContain('browser.cookies.getAll({ domain, ...(targetStoreId ? { storeId: targetStoreId } : {}) })');
    expect(cookies).toContain('browser.cookies.getAll({ url: tab.url, ...(targetStoreId ? { storeId: targetStoreId } : {}) })');
    expect(sessionStorage).toContain("const localData = ls && typeof ls === 'object' ? ls : {};");
    expect(sessionStorage).toContain("const sessionData = ss && typeof ss === 'object' ? ss : {};");
    expect(sessionStorage).toContain("if (!result.localKeys || !result.sessionKeys) return Response.error('Page storage verification failed after restore'");
    expect(sessionStorage).toContain("localStorage.setItem(key, value)");
    expect(sessionStorage).toContain("sessionStorage.setItem(key, value)");
    const addSession = readFileSync('app/popup/modals/AddSessionModal.vue', 'utf8');
    const backup = readFileSync('app/features/backup/backup.ts', 'utf8');
    expect(addSession).toContain('const timestamp = session.timestamp || uniqueTimestamp();');
    expect(addSession).toContain('lastRestoredAt: Date.now(),');
    expect(backup).toContain('normalized.data.sessions.map((session) => ({ ...session, lastRestoredAt: Date.now() }))');
    expect(sessionStorage).toContain("return Response.error('Unlock the master password before changing protected data')");
    expect(sessionStorage).toContain('if (!persisted.success) return persisted;');
    expect(sessionStorage).toContain("throw new Error('Could not clear page storage')");
  });

  it('keeps forgot password page and uninstall wiring while removing control page', () => {
    expect(readFileSync('wxt.config.ts', 'utf8')).not.toContain('options_ui');
    expect(readFileSync('app/entrypoints/forgot-password/main.ts', 'utf8')).toContain("../../forgot-password/main");
    const forgotSource = readFileSync('app/forgot-password/ForgotPasswordApp.vue', 'utf8');
    expect(forgotSource).toContain('Recover your SesWi vault.');
    expect(forgotSource).toContain('Reset Master Password');
    expect(forgotSource).toContain('MasterPassword.resetByRecovery');
    expect(forgotSource).toContain('Forgot your password?');
    expect(forgotSource).toContain('Reset app data');
    expect(forgotSource).toContain('browser.storage.local.clear');
    expect(forgotSource).toContain('grid-template-columns: minmax(0, 0.92fr) minmax(360px, 440px)');
    expect(forgotSource).toContain('@media (max-width: 820px)');
    expect(readFileSync('app/popup/layout/LockScreen.vue', 'utf8')).toContain("browser.runtime.getURL('forgot-password.html')");
    const unlockCacheSource = readFileSync('app/features/security/masterUnlockCache.ts', 'utf8');
    expect(unlockCacheSource).toContain('MASTER_UNLOCK_CACHE_TTL_MS = 5 * 60 * 1000');
    expect(unlockCacheSource).toContain('browser.runtime.sendMessage');
    expect(readFileSync('app/entrypoints/offscreen/main.ts', 'utf8')).toContain('../../background/masterUnlockOffscreen');
    expect(readFileSync('app/background/index.ts', 'utf8')).toContain('offscreen.html');
    const lockSource = readFileSync('app/popup/composables/useMasterLock.ts', 'utf8');
    expect(lockSource).toContain('setCachedMasterPassword');
    expect(lockSource).not.toContain('SessionToken');
    expect(lockSource).not.toContain('storage.session');
    expect(readFileSync('app/features/security/crypto.ts', 'utf8')).not.toContain('export const SessionToken');
    expect(readFileSync('app/popup/tabs/ManageTab.vue', 'utf8')).not.toContain('Control Page');
    expect(readFileSync('app/popup/App.vue', 'utf8')).not.toContain('openControlPage');
    expect(readFileSync('app/background/index.ts', 'utf8')).toContain('setUninstallURL');
    const uninstall = readFileSync('uninstall.html', 'utf8');
    expect(uninstall).toContain('Sorry to See You Go.');
    expect(uninstall).toContain('id="releaseStatus"');
    expect(uninstall).toContain('api.github.com/repos/risunCode/SesWi-Session-Manager/releases/latest');
    expect(readFileSync('app/background/index.ts', 'utf8')).toContain("https://risuncode.github.io/SesWi-Session-Manager/uninstall.html");
  });
});

describe('toast consistency', () => {
  it('routes completion toasts through parent refresh handlers only once', () => {
    const appSource = readFileSync('app/popup/App.vue', 'utf8');

    expect(appSource).toContain('@saved="handleDataChanged"');
    expect(appSource).toContain('@cleaned="handleDataChanged"');
    expect(readFileSync('app/popup/modals/AddSessionModal.vue', 'utf8')).not.toContain("emit('toast', 'Session saved')");
    expect(readFileSync('app/popup/modals/CleanTabModal.vue', 'utf8')).not.toContain("emit('toast', 'Current tab cleaned')");
    expect(readFileSync('app/popup/modals/MasterPasswordModal.vue', 'utf8')).not.toContain("emit('toast', 'Master password enabled')");
    expect(readFileSync('app/popup/modals/TwoFactorEntryModal.vue', 'utf8')).not.toContain("emit('toast', props.entry ? '2FA entry updated' : '2FA entry added')");
  });
});

describe('clean tab old-modal parity', () => {
  it('shows old expandable counts and previews', async () => {
    const wrapper = mount(CleanTabModal, { attachTo: document.body, global: { stubs: { Teleport: true } }, props: { open: true } });
    await flushPromises();

    expect(wrapper.text()).toContain('Data for');
    expect(wrapper.text()).toContain('Cookies');
    expect(wrapper.text()).toContain('localStorage');
    expect(wrapper.text()).toContain('Site Data');
    expect(wrapper.text()).toContain('Window');
    expect(wrapper.text()).not.toContain('History & Cache');
    expect(wrapper.text()).toContain('Clear Other Tabs');
    expect(wrapper.text()).toContain('3 tabs open · 2 other tabs can be closed');
    expect(wrapper.text()).toContain('Uncheck All');
    expect(wrapper.findAll('.clean-count')[0].text()).toBe('1');

    await wrapper.get('.ct-expand-btn').trigger('click');
    expect(wrapper.find('.ct-data-preview.show').exists()).toBe(true);
    expect(wrapper.find('.ct-data-row').text()).toContain('sid');

    await wrapper.findAll('.ct-mode-tab').find((button) => button.text().includes('Window'))?.trigger('click');
    expect(wrapper.find('.ct-window-action').isVisible()).toBe(true);
    expect(wrapper.find('.sw-modal-footer .sw-btn--danger').exists()).toBe(false);
  });
});

describe('modal style consistency', () => {
  it('keeps modal components on shared modal primitives', () => {
    const files = [
      'app/popup/modals/CleanTabModal.vue',
      'app/popup/modals/MasterPasswordModal.vue',
      'app/popup/modals/TwoFactorScanModal.vue',
    ];

    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      expect(source).not.toContain('class="modal-check');
      expect(source).not.toContain('class="dropzone');
    }
  });

  it('declares Firefox no-data-collection consent', () => {
    const source = readFileSync('wxt.config.ts', 'utf8');

    expect(source).toContain('data_collection_permissions');
    expect(source).toContain("required: ['none']");
  });
});

describe('modal primitives', () => {
  it('renders traffic lights and emits close', async () => {
    const wrapper = mount(ModalBase, {
      attachTo: document.body,
      props: { open: true, title: 'Test Modal' },
      slots: { default: '<p>Modal body</p>' },
    });

    expect(document.body.textContent).toContain('Test Modal');
    expect(document.body.querySelectorAll('.sw-tl')).toHaveLength(3);

    (document.body.querySelector('.sw-traffic-lights') as HTMLButtonElement).click();
    await wrapper.vm.$nextTick();

    expect(wrapper.emitted('close')).toHaveLength(1);
  });
});

describe('Session Actions old-modal layout', () => {
  it('matches old split restore/action/export/delete structure', async () => {
    const wrapper = mount(SessionActionsModal, { attachTo: document.body, global: { stubs: { Teleport: true } }, props: { open: true, session } });
    await flushPromises();

    expect(wrapper.find('.sa-modal').exists()).toBe(true);
    expect(wrapper.find('.sw-traffic-lights').exists()).toBe(true);
    expect(wrapper.find('.sa-header-card').text()).toContain('example.com');
    expect(wrapper.find('.sa-info-card').text()).toContain('Cookies');
    expect(wrapper.find('.sa-split-btn').text()).toContain('Restore Session');
    expect(wrapper.text()).toContain('Restore & Go to Original');
    expect(wrapper.text()).toContain('Edit');
    expect(wrapper.text()).toContain('Replace');
    expect(wrapper.text()).toContain('Export JSON');
    expect(wrapper.text()).toContain('Export OWI');
    expect(wrapper.text()).toContain('Delete Session');
    const sessionActions = readFileSync('app/popup/modals/SessionActionsModal.vue', 'utf8');
    expect(sessionActions).toContain('await browser.tabs.reload(tab.data.tabId);\n      await waitForTabComplete(tab.data.tabId);');
    expect(sessionActions).toContain("const refreshedSession: Session = { ...props.session, lastRestoredAt: Date.now() }");
  });

  it('routes Saved Data to its dedicated modal with copy feedback', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn().mockResolvedValue(undefined) }, configurable: true });
    const actions = mount(SessionActionsModal, { attachTo: document.body, global: { stubs: { Teleport: true } }, props: { open: true, session } });
    await flushPromises();

    await actions.get('.sa-info-card-top').trigger('click');
    expect(actions.emitted('open-saved-data')).toEqual([[session]]);
    expect(actions.find('.saved-data-list').exists()).toBe(false);

    const viewer = mount(SavedDataModal, { attachTo: document.body, global: { stubs: { Teleport: true } }, props: { open: true, session } });
    await viewer.get('.saved-data-copy').trigger('click');
    await flushPromises();

    expect(viewer.find('.saved-data-tabs').text()).toContain('Cookies');
    expect(viewer.find('.saved-data-list').text()).toContain('sid');
    expect(viewer.find('.saved-data-feedback').text()).toContain('Copied!');
    expect(viewer.find('.saved-data-copy .fa-check').exists()).toBe(true);
  });
});

describe('Backup Restore old-modal layout', () => {
  it('loads session and 2FA counts on its first mount', async () => {
    vi.mocked(SessionStorage.getAll).mockResolvedValueOnce({ success: true, data: [session] });
    vi.mocked(TwoFactorStorage.getAll).mockResolvedValueOnce({ success: true, data: [twoFactorEntry] });
    const wrapper = mount(BackupRestoreModal, { attachTo: document.body, global: { stubs: { Teleport: true } }, props: { open: true } });
    await flushPromises();

    expect(wrapper.find('.include-card').text()).toContain('1 sessions · 1 2FA');
  });

  it('defaults to OWI and shows available data counts', async () => {
    const wrapper = mount(BackupRestoreModal, { attachTo: document.body, global: { stubs: { Teleport: true } }, props: { open: true } });
    await flushPromises();

    expect(wrapper.find('.br-tabs').exists()).toBe(true);
    expect(wrapper.find('.option-card.selected').text()).toContain('OWI');
    expect(wrapper.find('.include-card').text()).toContain('sessions');
    expect(wrapper.find('.include-card').text()).toContain('2FA');
    expect(wrapper.text()).toContain('OWI encrypts the backup');
    expect(wrapper.text()).toContain('sessions');
    expect(wrapper.text()).toContain('2FA entries');
    expect(wrapper.find('.export-action-row').exists()).toBe(true);
    expect(wrapper.find('.password-eye').exists()).toBe(true);
    expect(wrapper.find('.export-buttons').text()).toContain('Cancel');
    const source = readFileSync('app/popup/modals/BackupRestoreModal.vue', 'utf8');
    expect(source).toContain('width: 360px;');
    expect(source).toContain('min-height: 82px;');
    expect(source).toContain('sw-block-loader');
    expect(readFileSync('app/features/backup/backup.ts', 'utf8')).toContain('SessionStorage.saveMany');
  });

  it('keeps import pane dropzone and restore options', async () => {
    const wrapper = mount(BackupRestoreModal, { attachTo: document.body, global: { stubs: { Teleport: true } }, props: { open: true } });
    await flushPromises();

    await wrapper.findAll('.br-tab')[1].trigger('click');

    expect(wrapper.find('.dropzone').isVisible()).toBe(true);
    expect(wrapper.find('input[accept=".json,.txt,.owi"]').attributes('multiple')).toBeDefined();
    expect(wrapper.text()).toContain('Restore');
  });
});

describe('Add Session old-modal layout', () => {
  it('uses centered shared-shell animation and repaired file pane layout', () => {
    const source = readFileSync('app/popup/modals/AddSessionModal.vue', 'utf8');

    expect(source).toContain('<ModalBase');
    expect(source).toContain('panel-class="add-session-modal__panel"');
    expect(readFileSync('app/styles/components.css', 'utf8')).toContain('transform: translate(-50%, -50%);');
    expect(readFileSync('app/styles/components.css', 'utf8')).not.toContain('animation: modal-pop-in 0.24s');
    expect(source).toContain('grid-template-columns: minmax(0, 1fr) auto;');
  });
});

describe('functional modals', () => {
  it('saves a captured session from Add Session', async () => {
    const wrapper = mount(AddSessionModal, { attachTo: document.body, global: { stubs: { Teleport: true } }, props: { open: true } });
    await flushPromises();

    expect((wrapper.get('input[placeholder="Session name..."]').element as HTMLInputElement).value).toBe('');
    expect(wrapper.find('.modal-info-enhanced').exists()).toBe(true);
    expect(wrapper.find('.modal-favicon-wrap').exists()).toBe(true);
    expect(readFileSync('app/popup/modals/AddSessionModal.vue', 'utf8')).toContain('captureIconUrl');
    expect(wrapper.findAll('.add-options-card .modal-checkbox-row')).toHaveLength(3);
    expect(wrapper.find('.import-cookie-textarea').isVisible()).toBe(false);

    await wrapper.get('input[placeholder="Session name..."]').setValue('Fresh Login');
    await wrapper.get('.sw-modal-footer .btn-primary').trigger('click');
    await flushPromises();

    expect(wrapper.emitted('saved')).toHaveLength(1);
  });

  it('saves captured session with Enter from the name input', async () => {
    const wrapper = mount(AddSessionModal, { attachTo: document.body, global: { stubs: { Teleport: true } }, props: { open: true } });
    await flushPromises();

    const input = wrapper.get('input[placeholder="Session name..."]');
    expect(input.attributes('autofocus')).toBeDefined();

    await input.setValue('Enter Login');
    await input.trigger('keydown.enter');
    await flushPromises();

    expect(wrapper.emitted('saved')).toHaveLength(1);
  });

  it('keeps import file pane structured', async () => {
    const wrapper = mount(AddSessionModal, { attachTo: document.body, global: { stubs: { Teleport: true } }, props: { open: true } });
    await flushPromises();

    await wrapper.findAll('.add-mode-tab')[2].trigger('click');

    expect(wrapper.find('.dropzone').isVisible()).toBe(true);
    expect(wrapper.find('input[accept=".json,.txt,.owi"]').exists()).toBe(true);
    expect(wrapper.find('input[accept=".json,.txt,.owi"]').attributes('multiple')).toBeDefined();
  });

  it('shows paste-cookie actions in the import pane', async () => {
    const wrapper = mount(AddSessionModal, { attachTo: document.body, global: { stubs: { Teleport: true } }, props: { open: true } });
    await flushPromises();

    await wrapper.findAll('.add-mode-tab')[1].trigger('click');

    expect(wrapper.find('.import-cookie-textarea').exists()).toBe(true);
    expect(wrapper.text()).toContain('Supports: Cookie Editor JSON');
    expect(wrapper.text()).toContain('Import Cookies');
  });

  it('cleans selected current tab data', async () => {
    const wrapper = mount(CleanTabModal, { attachTo: document.body, global: { stubs: { Teleport: true } }, props: { open: true } });

    await wrapper.get('.sw-modal-footer .sw-btn--danger').trigger('click');
    await flushPromises();

    expect(wrapper.emitted('cleaned')).toHaveLength(1);
  });

  it('unchecks data cleanup and clears only other window tabs', async () => {
    const wrapper = mount(CleanTabModal, { attachTo: document.body, global: { stubs: { Teleport: true } }, props: { open: true } });
    await flushPromises();

    await wrapper.findAll('.ct-mini-btn').find((button) => button.text() === 'Uncheck All')?.trigger('click');
    expect(wrapper.findAll('input[type="checkbox"]').every((input) => !(input.element as HTMLInputElement).checked)).toBe(true);

    await wrapper.findAll('button').find((button) => button.text().includes('Clear Other Tabs'))?.trigger('click');
    await flushPromises();

    expect(wrapper.emitted('clearOtherTabs')?.[0]).toEqual([2]);
    expect(browser.tabs.remove).not.toHaveBeenCalled();

    const app = readFileSync('app/popup/App.vue', 'utf8');
    expect(app).toContain('@clear-other-tabs="openClearOtherTabsConfirm"');
    expect(app).toContain("confirmState.title = 'Clear Other Tabs?'");
    expect(app).toContain('await browser.tabs.remove(tabIdsToClose)');
  });

  it('splits session and 2FA management with domain and batch delete requests', async () => {
    const sessionManager = mount(SessionManagerModal, { attachTo: document.body, global: { stubs: { Teleport: true } }, props: { open: true } });
    await flushPromises();
    await sessionManager.get('.sm-domain-delete').trigger('click');
    const domainDelete = sessionManager.emitted('confirm-delete-domain')?.[0]?.[0] as { domain: string; sessions: unknown[] } | undefined;
    expect(domainDelete?.domain).toBe('example.com');
    expect(domainDelete?.sessions).toHaveLength(5);

    const twoFactorManager = mount(TwoFactorManagerModal, { attachTo: document.body, global: { stubs: { Teleport: true } }, props: { open: true } });
    await flushPromises();
    expect(twoFactorManager.text()).toContain('2FA Manager');
    expect(twoFactorManager.text()).toContain('No 2FA entries saved yet.');
    expect(readFileSync('app/popup/App.vue', 'utf8')).toContain('@confirm-delete="openTwoFactorManagerDeleteConfirm"');
  });

  it('offers manual, scan, and import from the unified 2FA add modal', async () => {
    const wrapper = mount(TwoFactorAddModal, { attachTo: document.body, global: { stubs: { Teleport: true } }, props: { open: true } });
    const options = wrapper.findAll('.twofa-add__option');

    expect(options).toHaveLength(3);
    await options[0].trigger('click');
    await options[1].trigger('click');
    await options[2].trigger('click');
    expect(wrapper.emitted('choose')).toEqual([['manual'], ['scan'], ['import']]);
  });

  it('detects encrypted Aegis exports before requesting a password', () => {
    const result = inspectTwoFactorImport(JSON.stringify({
      version: 1,
      header: {
        slots: [{ type: 1, key: '00', key_params: { nonce: '000000000000000000000000', tag: '00000000000000000000000000000000' }, n: 32768, r: 8, p: 1, salt: '00000000000000000000000000000000' }],
        params: { nonce: '000000000000000000000000', tag: '00000000000000000000000000000000' },
      },
      db: 'AA==',
    }));

    expect(result).toEqual({ success: true, data: { kind: 'aegis-encrypted', passwordRequired: true, entries: [] } });
  });

  it('classifies an OTPAuth text file as 2FA instead of sessions', async () => {
    const parsed = await parseImportSources([{ id: 'authenticator', name: 'authenticator.txt', sourceType: 'file', raw: 'otpauth://totp/test:user@example.com?secret=JBSWY3DPEHPK3PXP&issuer=test' }]);
    expect(parsed.summary.sessionCount).toBe(0);
    expect(parsed.summary.twoFactorCount).toBe(1);
    expect(parsed.items[0]?.detectedKind).toBe('otpauth-batch');
  });

  it('imports a batch OTPAuth text export', () => {
    const result = inspectTwoFactorImport([
      'otpauth://totp/prod-master-cast-ai:ak.unytpremm8j%40gmail.com?secret=IR6WSQR7J5UHOPZOOBBCUOSJPAVCCL3V&issuer=prod-master-cast-ai',
      'otpauth://totp/totp%40authenticationtest.com?secret=I65VU7K5ZQL7WB4E',
      'otpauth://totp/prod-master-cast-ai:akunytpr.emm8j%40gmail.com?secret=LMTCII2LGQ5EAILRMFWUEN2WINTE6LBG&issuer=prod-master-cast-ai',
    ].join('\n'));

    expect(result.success && result.data).toMatchObject({ kind: 'otpauth-uris', passwordRequired: false });
    expect(result.success && result.data.entries).toHaveLength(3);
  });

  it('imports plaintext Aegis entries only after validation', async () => {
    const wrapper = mount(TwoFactorImportModal, { attachTo: document.body, global: { stubs: { Teleport: true } }, props: { open: true } });
    await wrapper.get('#twofa-import-text').setValue(JSON.stringify({ version: 1, header: { slots: null, params: null }, db: { entries: [{ type: 'totp', uuid: 'aegis-entry', name: 'user@example.com', issuer: 'Example', info: { secret: 'JBSWY3DPEHPK3PXP', algo: 'SHA1', digits: 6, period: 30 } }] } }));
    await flushPromises();

    expect(wrapper.text()).toContain('Aegis export validated');
    expect(wrapper.text()).toContain('1 valid TOTP entry ready to import.');
  });

  it('keeps storage mutations guarded by validation and atomic batch deletion', () => {
    const source = readFileSync('app/features/two-factor/twoFactorStorage.ts', 'utf8');

    expect(source).toContain('base32Decode(updated.secret)');
    expect(source).toContain('async deleteMany(ids: string[])');
    expect(source).toContain('const next = entries.filter(entry => !uniqueIds.has(entry.id));');
  });

  it('hydrates the edit 2FA form on its first mount', () => {
    const wrapper = mount(TwoFactorEntryModal, { attachTo: document.body, global: { stubs: { Teleport: true } }, props: { open: true, entry: twoFactorEntry } });

    expect((wrapper.get('input[placeholder="Issuer"]').element as HTMLInputElement).value).toBe(twoFactorEntry.issuer);
    expect((wrapper.get('input[placeholder="Account name"]').element as HTMLInputElement).value).toBe(twoFactorEntry.accountName);
    expect((wrapper.get('input[placeholder="Secret or OTPAuth URI"]').element as HTMLInputElement).value).toBe(twoFactorEntry.secret);
  });

  it('saves a manual 2FA entry', async () => {
    const wrapper = mount(TwoFactorEntryModal, { attachTo: document.body, global: { stubs: { Teleport: true } }, props: { open: true } });
    const inputs = wrapper.findAll('input');

    await inputs[0].setValue('GitHub');
    await inputs[1].setValue('octo@example.com');
    await inputs[2].setValue('JBSWY3DPEHPK3PXP');
    await wrapper.get('.sw-modal-footer .sw-btn--primary').trigger('click');
    await flushPromises();

    expect(wrapper.emitted('saved')).toHaveLength(1);
  });
});

describe('master password modal', () => {
  it('renders old-style setup structure with notice, setup card, strength, and recovery block', async () => {
    const wrapper = mount(MasterPasswordModal, {
      attachTo: document.body,
      global: { stubs: { Teleport: true } },
      props: { open: true },
    });
    await flushPromises();

    expect(wrapper.find('.mp-notice').exists()).toBe(true);
    expect(wrapper.find('.mp-section').exists()).toBe(true);
    expect(wrapper.text()).toContain('Set up protection');
    expect(wrapper.text()).toContain('Encrypt sessions and 2FA secrets at rest.');
    expect(wrapper.findAll('.password-field')).toHaveLength(2);
    expect(wrapper.find('.mp-strength').exists()).toBe(true);
    expect(wrapper.find('.mp-recovery-section').exists()).toBe(true);
    expect(wrapper.find('.mp-recovery-header').text()).toContain('Recovery Question (optional)');
    expect(wrapper.find('.sw-modal-footer').text()).toContain('Enable');
  });

  it('toggles new password visibility with eye button', async () => {
    const wrapper = mount(MasterPasswordModal, {
      attachTo: document.body,
      global: { stubs: { Teleport: true } },
      props: { open: true },
    });
    await flushPromises();

    const eyes = wrapper.findAll('.password-eye');
    expect(eyes).toHaveLength(2);

    const newPwdInput = wrapper.findAll('.password-field')[0].find('input');
    const firstEye = eyes[0];

    expect(newPwdInput.attributes('type')).toBe('password');
    expect(firstEye.get('i').classes()).toContain('fa-eye');
    expect(firstEye.attributes('aria-label')).toBe('Show password');

    await firstEye.trigger('click');

    expect(newPwdInput.attributes('type')).toBe('text');
    expect(firstEye.get('i').classes()).toContain('fa-eye-slash');
    expect(firstEye.attributes('aria-label')).toBe('Hide password');
  });

  it('toggles confirm password visibility with eye button', async () => {
    const wrapper = mount(MasterPasswordModal, {
      attachTo: document.body,
      global: { stubs: { Teleport: true } },
      props: { open: true },
    });
    await flushPromises();

    const eyes = wrapper.findAll('.password-eye');
    expect(eyes).toHaveLength(2);

    const confirmPwdInput = wrapper.findAll('.password-field')[1].find('input');
    const secondEye = eyes[1];

    expect(confirmPwdInput.attributes('type')).toBe('password');
    expect(secondEye.get('i').classes()).toContain('fa-eye');
    expect(secondEye.attributes('aria-label')).toBe('Show password');

    await secondEye.trigger('click');

    expect(confirmPwdInput.attributes('type')).toBe('text');
    expect(secondEye.get('i').classes()).toContain('fa-eye-slash');
    expect(secondEye.attributes('aria-label')).toBe('Hide password');
  });
});

describe('popup shell', () => {
  it('renders the SesWi icon and update badge beside the branded footer identity', () => {
    const wrapper = mount(AppFooter, {
      props: { version: 'v4.0.0', hasUpdate: true, latestVersion: '4.1.0', updateUrl: 'https://github.com/risunCode/SesWi-Session-Manager/releases/tag/v4.1.0' },
    });

    const identity = wrapper.get('.app-footer__identity');
    expect(identity.text()).toContain('SesWi v4.0.0 by risunCode');
    expect(identity.get('.app-footer__icon').classes()).toContain('fa-cookie-bite');
    expect(identity.get('.app-footer__update').text()).toContain('New v4.1.0');
    expect(wrapper.text()).toContain('Open Project Page');
    expect(wrapper.get('.app-footer__project').attributes('href')).toBe('https://github.com/risunCode/SesWi-Session-Manager');
    expect(wrapper.get('.app-footer__project i').classes()).toContain('fa-github');
  });

  it('renders four tabs and opens the add session modal from the header', async () => {
    const wrapper = mount(App, { attachTo: document.body });
    await flushPromises();

    expect(wrapper.findAll('[role="tab"]')).toHaveLength(4);

    await wrapper.get('button[aria-label="Add new session"]').trigger('click');

    expect(document.body.textContent).toContain('Add Session');
  });
});

describe('userscript bridge', () => {
  it('keeps the workaround helper as a static README-documented userscript', () => {
    const helper = readFileSync('app/public/userscripts/seswi-bridge-helper.user.js', 'utf8');
    const readme = readFileSync('README.md', 'utf8');

    expect(helper).toContain('// ==UserScript==');
    expect(helper).toContain('window.SesWiBridge = bridge');
    expect(helper).toContain('const registerMenuCommand = globalThis.GM_registerMenuCommand');
    expect(helper).toContain("registerMenuCommand('SesWi: Save Current Domain'");
    expect(helper).toContain("registerMenuCommand('SesWi: Restore Latest Session'");
    expect(helper).toContain("registerMenuCommand('SesWi: Clean Current Tab'");
    expect(readme).toContain('app/public/userscripts/seswi-bridge-helper.user.js');
  });

  it('defines the userscript bridge action constants and confirm helpers in the shared contract', () => {
    const source = readFileSync('app/shared/userscriptBridge.ts', 'utf8');

    expect(source).toContain("request: 'userscriptBridge:request'");
    expect(source).toContain("getPending: 'userscriptBridge:getPending'");
    expect(source).toContain("complete: 'userscriptBridge:complete'");
    expect(source).toContain("prompt: 'userscriptBridge:prompt'");
    expect(source).toContain("result: 'userscriptBridge:result'");
    expect(source).toContain('export function userscriptBridgeConfirmTitle');
    expect(source).toContain('export function userscriptBridgeConfirmMessage');
  });

  it('wires the content script entrypoint to relay page requests and post results', () => {
    const source = readFileSync('app/entrypoints/userscript-bridge.content.ts', 'utf8');

    expect(source).toContain('defineContentScript');
    expect(source).toContain("matches: ['<all_urls>']");
    expect(source).toContain("runAt: 'document_start'");
    expect(source).toContain('browser.runtime.sendMessage');
    expect(source).toContain('USERSCRIPT_BRIDGE_ACTIONS.request');
    expect(source).toContain('USERSCRIPT_BRIDGE_ACTIONS.result');
    expect(source).toContain('window.postMessage');
    expect(source).toContain('USERSCRIPT_BRIDGE_EXTENSION_SOURCE');
  });

  it('keeps bridge action execution in the SesWi feature service', () => {
    const source = readFileSync('app/features/userscript/bridge.ts', 'utf8');

    expect(source).toContain('export async function runUserscriptBridgeAction');
    expect(source).toContain("kind === 'save-current-domain'");
    expect(source).toContain("kind === 'restore-latest-session'");
    expect(source).not.toContain('buildUserscriptBridgeHelper');
  });

  it('syncs pending userscript prompts and completes them through the popup confirm flow', () => {
    const source = readFileSync('app/popup/App.vue', 'utf8');

    expect(source).toContain('USERSCRIPT_BRIDGE_ACTIONS.getPending');
    expect(source).toContain('USERSCRIPT_BRIDGE_ACTIONS.prompt');
    expect(source).toContain('USERSCRIPT_BRIDGE_ACTIONS.complete');
    expect(source).toContain('runUserscriptBridgeAction');
    expect(source).toContain('userscriptBridgeConfirmTitle');
    expect(source).toContain('userscriptBridgeConfirmMessage');
    expect(source).toContain('openUserscriptBridgeConfirm');
    expect(source).toContain('syncPendingUserscriptPrompt');
  });
});

describe('batch import queues', () => {
  it('keeps OWI files locked until their password is entered and explicitly reviewed', async () => {
    const parsed = await parseImportSources([{
      id: 'encrypted-backup',
      name: 'sessions-backup.owi',
      sourceType: 'file',
      raw: '{"format":"OWI"}',
      fileName: 'sessions-backup.owi',
    }]);

    expect(parsed.summary).toMatchObject({ total: 1, ready: 0, passwordRequired: 1, sessionCount: 0, twoFactorCount: 0 });
    expect(parsed.items[0]).toMatchObject({ status: 'needs-password', requiresPassword: true, error: 'Password required' });

    const modal = readFileSync('app/popup/modals/AddSessionModal.vue', 'utf8');
    const helper = readFileSync('app/features/backup/import.ts', 'utf8');

    expect(modal).toContain('Locked — enter password to review contents');
    expect(modal).toContain('Password incorrect — enter the correct password to review');
    expect(modal).toContain('Verify Password');
    expect(modal).toContain('unlockAndReview(item.id)');
    expect(modal).toContain('filePasswordVisible[item.id]');
    expect(modal).toContain("'Hide password' : 'Show password'");
    expect(modal).toContain('removeQueuedFile(item.id)');
    expect(helper).toContain("status: 'needs-password'");
    expect(helper).toContain("error: 'Password required'");
  });

  it('preserves names from complete session backups while using the filename only for raw cookies', async () => {
    const source: ImportSourceItem = {
      id: 'named-backup',
      name: 'sessions-backup.json',
      sourceType: 'file',
      fileName: 'sessions-backup.json',
      raw: JSON.stringify([{
        id: 'backup-session-1',
        name: 'risundaily',
        domain: 'chatgpt.com',
        originalUrl: 'https://chatgpt.com/',
        timestamp: 1,
        cookies: [{ name: 'session', value: 'value', domain: 'chatgpt.com', path: '/', sameSite: 'lax', secure: true, httpOnly: true, session: false }],
        localStorage: {},
        sessionStorage: {},
      }]),
    };
    const normalized = Normalize.importSessions(JSON.parse(source.raw));
    const parsed = await parseImportSources([source]);
    const modal = readFileSync('app/popup/modals/AddSessionModal.vue', 'utf8');

    expect(normalized[0]?.name, JSON.stringify(normalized)).toBe('risundaily');

    expect(parsed.items[0]).toMatchObject({ detectedKind: 'json-backup', status: 'ready' });
    expect(parsed.items[0]?.payload?.data.sessions[0]?.name, JSON.stringify(parsed)).toBe('risundaily');
    expect(modal).toContain('mergeImportPayloads(readyItems)');
  });

  it('wires Add Session file mode to the shared batch queue contract', () => {
    const modal = readFileSync('app/popup/modals/AddSessionModal.vue', 'utf8');
    const helper = readFileSync('app/features/backup/import.ts', 'utf8');

    expect(modal).toContain('const fileQueue = ref<ImportSourceItem[]>([])');
    expect(modal).toContain('const parsedFileBatch = ref<BatchParseResult | null>(null)');
    expect(modal).toContain('createImportSourcesFromFiles');
    expect(modal).toContain('parseImportSources(fileQueue.value');
    expect(modal).toContain('Verify Password');
    expect(modal).toContain('Enter passwords for all encrypted files first');
    expect(modal).toContain('No session or 2FA data found in selected files');
    expect(helper).toContain('export async function parseImportSources');
    expect(helper).toContain('export async function createImportSourcesFromFiles');
    expect(helper).toContain('export function flattenSessionCandidates');
    expect(helper).toContain('export function summarizeBatchResult');
  });

  it('wires Backup Restore import mode to the shared batch queue contract', () => {
    const modal = readFileSync('app/popup/modals/BackupRestoreModal.vue', 'utf8');
    const helper = readFileSync('app/features/backup/import.ts', 'utf8');

    expect(modal).toContain('const fileQueue = ref<ImportSourceItem[]>([])');
    expect(modal).toContain('const parsedImportBatch = ref<BatchParseResult | null>(null)');
    expect(modal).toContain('parseImportSources(fileQueue.value');
    expect(modal).toContain('mergeImportPayloads');
    expect(modal).toContain('Review Queue');
    expect(modal).toContain('Enter passwords for all encrypted files first');
    expect(helper).toContain('export function mergeImportPayloads');
  });
});

describe('browser commands', () => {
  it('declares only Alt+Q as a browser-level SesWi command', () => {
    const source = readFileSync('wxt.config.ts', 'utf8');
    const bg = readFileSync('app/background/index.ts', 'utf8');

    expect(source).toContain('open_seswi');
    expect(source).toContain("default: 'Alt+Q'");
    expect(source).toContain('Open the SesWi popup');
    expect(source).not.toContain('close_all_tabs');
    expect(source).not.toContain("default: 'Alt+W'");
    expect(source).not.toContain('contextMenus');
    expect(bg).toContain("OPEN_SESWI_COMMAND = 'open_seswi'");
    expect(bg).toContain('command === OPEN_SESWI_COMMAND');
    expect(bg).toContain('handleOpenSeswiCommand()');
    expect(bg).toContain("browser.runtime.sendMessage({ action: TOGGLE_SESWI_POPUP_ACTION })");
    expect(bg).toContain('await browser.action.openPopup()');
    expect(bg).not.toContain('browser.browserAction');
    expect(readFileSync('app/popup/App.vue', 'utf8')).toContain('window.close()');
    expect(bg).not.toContain('CLOSE_ALL_TABS_COMMAND');
    expect(bg).not.toContain('handleCloseAllTabsCommand');
    expect(bg).not.toContain('contextMenus');
    expect(readFileSync('app/popup/App.vue', 'utf8')).toContain("message.action === 'seswi:toggle-popup'");
  });

  it('routes destructive confirmation and OWI passwords through SesWi modals', () => {
    const files = [
      'app/popup/modals/SessionManagerModal.vue',
      'app/popup/modals/SessionActionsModal.vue',
      'app/popup/modals/MasterPasswordModal.vue',
      'app/popup/modals/BackupRestoreModal.vue',
      'app/forgot-password/ForgotPasswordApp.vue',
    ];

    for (const file of files) expect(readFileSync(file, 'utf8')).not.toMatch(/\b(confirm|alert|prompt)\s*\(/);
    expect(readFileSync('app/popup/modals/SessionManagerModal.vue', 'utf8')).toContain("emit('confirm-delete', sessions)");
    expect(readFileSync('app/popup/modals/OwiPasswordModal.vue', 'utf8')).toContain('Set OWI Export Password');
  });

  it('binds userscript actions to the approved requester tab', () => {
    const source = readFileSync('app/features/userscript/bridge.ts', 'utf8');

    expect(source).toContain('browser.tabs.get(request.tabId)');
    expect(source).toContain('BrowserStorage.clear(target.data.tabId, true, true)');
    expect(readFileSync('app/popup/App.vue', 'utf8')).toContain('runUserscriptBridgeAction(activeRequest)');
    expect(source).not.toContain('TabInfo.getCurrent()');
  });

  it('expires Master Password plaintext caches and validates recovery before protecting data', () => {
    const background = readFileSync('app/background/index.ts', 'utf8');
    const offscreen = readFileSync('app/background/masterUnlockOffscreen.ts', 'utf8');
    const crypto = readFileSync('app/features/security/crypto.ts', 'utf8');

    expect(background).toContain('setTimeout(clearMasterPasswordCache, ttlMs)');
    expect(offscreen).toContain('setTimeout(clearMasterPasswordCache, ttlMs)');
    expect(crypto).toContain('async setup(password: string, recovery?');
    expect(crypto).toContain('recoverySettings');
  });

  it('bounds Aegis import work and skips non-password credential slots', () => {
    const source = readFileSync('app/features/two-factor/importFormats.ts', 'utf8');

    expect(source).toContain("if (requireNumber(record.type, 'Aegis slot type') !== 1) return null;");
    expect(source).toContain("slot.n > 32768");
    expect(source).toContain("slot.r > 16");
    expect(source).toContain("slot.p > 4");
  });

  it('targets Firefox Manifest V3 for development and production', () => {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as { scripts: Record<string, string> };

    expect(packageJson.scripts['dev:firefox']).toBe('wxt dev -b firefox --mv3');
    expect(packageJson.scripts['build:firefox']).toBe('wxt build -b firefox --mv3');
  });

  it('keeps Firefox Manifest V3 compatibility metadata', () => {
    const source = readFileSync('wxt.config.ts', 'utf8');

    expect(source).toContain('manifestVersion: 3');
    expect(source).toContain("minimum_chrome_version: '127'");
    expect(source).toContain("strict_min_version: '109.0'");
    expect(source).toContain("required: ['none']");
  });
});
