import type { AuthUser } from '@shared/lib/auth';
import {
  getAccountType,
  getDefaultDashboardTab,
  getVisibleDashboardTabs,
  isDashboardTabAllowed,
  resolveDashboardTab,
} from '@shared/lib/accountType';

function makeUser(accountType?: AuthUser['accountType']): AuthUser {
  return {
    id: 'u1',
    email: 'test@example.com',
    accountType,
  } as AuthUser;
}

describe('accountType dashboard helpers', () => {
  it('defaults legacy users without accountType to artist', () => {
    expect(getAccountType(makeUser(undefined))).toBe('artist');
    expect(getDefaultDashboardTab(makeUser(undefined))).toBe('albums');
  });

  it('listener sees profile, purchases, and archive only', () => {
    const user = makeUser('listener');
    expect(getVisibleDashboardTabs(user)).toEqual(['profile', 'my-purchases', 'archive']);
    expect(getDefaultDashboardTab(user)).toBe('profile');
  });

  it('artist keeps full dashboard tabs', () => {
    const user = makeUser('artist');
    expect(getVisibleDashboardTabs(user)).toContain('albums');
    expect(getVisibleDashboardTabs(user)).toContain('mixer');
    expect(getDefaultDashboardTab(user)).toBe('albums');
  });

  it('resolveDashboardTab redirects disallowed tabs to role default', () => {
    const listener = makeUser('listener');
    expect(resolveDashboardTab('albums', listener)).toBe('profile');
    expect(isDashboardTabAllowed('albums', listener)).toBe(false);
    expect(isDashboardTabAllowed('profile', listener)).toBe(true);
  });

  it('resolveDashboardTab keeps allowed tabs', () => {
    const artist = makeUser('artist');
    expect(resolveDashboardTab('mixer', artist)).toBe('mixer');
    expect(resolveDashboardTab(undefined, artist)).toBe('albums');
  });
});
