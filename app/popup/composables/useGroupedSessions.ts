import { ref } from 'vue';
import { SessionStorage } from '@features/sessions/sessionStorage';
import type { Session } from '@features/sessions/session.types';
import { tabIcons, type IconEntry } from '@platform/icons/tabIcons';
import { Time, type ExpirationInfo } from '@shared/time';

export interface DomainGroup {
  domain: string;
  sessions: Session[];
}

export function totalCookies(sessions: Session[]): number {
  return sessions.reduce((sum, session) => sum + (session.cookies?.length ?? 0), 0);
}

export function authBadgeForGroup(group: DomainGroup): ExpirationInfo | null {
  const latestSession = group.sessions.reduce((latest, session) => session.timestamp > latest.timestamp ? session : latest, group.sessions[0]);
  return Time.getSessionExpiration(latestSession?.cookies);
}

export function domainTotalPages(group: DomainGroup, perPage: number): number {
  return Math.max(1, Math.ceil(group.sessions.length / perPage));
}

export function pagedSessions(group: DomainGroup, page: number, perPage: number): Session[] {
  const safePage = Math.min(page, domainTotalPages(group, perPage));
  const start = (safePage - 1) * perPage;
  return group.sessions.slice(start, start + perPage);
}

export function useGroupedSessionsData() {
  const groups = ref<DomainGroup[]>([]);
  const iconMap = ref<Record<string, IconEntry>>({});
  const failedIcons = ref<Record<string, true>>({});

  async function loadGroups() {
    const [groupResult, icons] = await Promise.all([
      SessionStorage.getGroupedByDomain(),
      tabIcons.refresh().catch(() => ({} as Record<string, IconEntry>)),
    ]);
    groups.value = groupResult.success ? groupResult.data : [];
    iconMap.value = icons;
    failedIcons.value = {};
    return groupResult;
  }

  function iconFor(domain: string): string {
    if (failedIcons.value[domain]) return '';
    return iconMap.value[domain]?.iconUrl || tabIcons.getFaviconUrl(domain) || '';
  }

  function markIconFailed(domain: string): void {
    failedIcons.value = { ...failedIcons.value, [domain]: true };
  }

  return { groups, loadGroups, iconFor, markIconFailed };
}
