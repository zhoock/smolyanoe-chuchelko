import { describe, expect, test, beforeEach } from '@jest/globals';

import {
  __resetListenerWelcomeStorageForTests,
  hasSeenListenerWelcome,
  markListenerWelcomePending,
  markListenerWelcomeSeen,
  shouldShowListenerWelcome,
} from '../listenerWelcomeStorage';

describe('listenerWelcomeStorage', () => {
  beforeEach(() => {
    __resetListenerWelcomeStorageForTests();
  });

  test('shows welcome when pending and not seen', () => {
    markListenerWelcomePending('user-1');
    expect(shouldShowListenerWelcome('user-1')).toBe(true);
    expect(hasSeenListenerWelcome('user-1')).toBe(false);
  });

  test('does not show after seen', () => {
    markListenerWelcomePending('user-1');
    markListenerWelcomeSeen('user-1');
    expect(shouldShowListenerWelcome('user-1')).toBe(false);
    expect(hasSeenListenerWelcome('user-1')).toBe(true);
  });

  test('does not re-pending seen users', () => {
    markListenerWelcomePending('user-1');
    markListenerWelcomeSeen('user-1');
    markListenerWelcomePending('user-1');
    expect(shouldShowListenerWelcome('user-1')).toBe(false);
  });
});
