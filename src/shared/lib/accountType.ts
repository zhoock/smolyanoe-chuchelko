import { readAccountTypeFromStoredToken, type AuthUser } from '@shared/lib/auth';

export type AccountType = 'listener' | 'artist';

export const DASHBOARD_TAB_SLUGS = [
  'albums',
  'posts',
  'payment-settings',
  'my-purchases',
  'profile',
  'social-links',
  'mixer',
  'archive',
] as const;

export type DashboardTab = (typeof DASHBOARD_TAB_SLUGS)[number];

const LISTENER_TABS: DashboardTab[] = ['profile', 'my-purchases', 'archive'];

const ARTIST_TABS: DashboardTab[] = [
  'profile',
  'albums',
  'posts',
  'mixer',
  'archive',
  'payment-settings',
  'my-purchases',
  'social-links',
];

export function isDashboardTabSlug(value: string): value is DashboardTab {
  return (DASHBOARD_TAB_SLUGS as readonly string[]).includes(value);
}

/** Legacy sessions without accountType are treated as artist (existing CMS users). */
export function getAccountType(user: AuthUser | null | undefined): AccountType {
  if (user?.accountType === 'listener') return 'listener';
  if (user?.accountType === 'artist') return 'artist';
  if (user) {
    const fromToken = readAccountTypeFromStoredToken();
    if (fromToken) return fromToken;
  }
  return 'artist';
}

export function isArtistAccount(user: AuthUser | null | undefined): boolean {
  return getAccountType(user) === 'artist';
}

export function isListenerAccount(user: AuthUser | null | undefined): boolean {
  return getAccountType(user) === 'listener';
}

export function getVisibleDashboardTabs(user: AuthUser | null | undefined): DashboardTab[] {
  return isListenerAccount(user) ? LISTENER_TABS : ARTIST_TABS;
}

export function getDefaultDashboardTab(user: AuthUser | null | undefined): DashboardTab {
  return isListenerAccount(user) ? 'profile' : 'albums';
}

export function isDashboardTabAllowed(
  tab: string | undefined,
  user: AuthUser | null | undefined
): tab is DashboardTab {
  if (!tab || !isDashboardTabSlug(tab)) return false;
  return getVisibleDashboardTabs(user).includes(tab);
}

export function resolveDashboardTab(
  tab: string | undefined,
  user: AuthUser | null | undefined
): DashboardTab {
  if (isDashboardTabAllowed(tab, user)) return tab;
  return getDefaultDashboardTab(user);
}
