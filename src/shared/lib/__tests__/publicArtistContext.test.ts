import { describe, test, expect } from '@jest/globals';

import { isAuthOverlayPathname } from '../publicArtistContext';

describe('isAuthOverlayPathname', () => {
  test('распознаёт точный /auth', () => {
    expect(isAuthOverlayPathname('/auth')).toBe(true);
  });

  test('распознаёт вложенные пути auth-маршрутов', () => {
    expect(isAuthOverlayPathname('/auth/')).toBe(true);
    expect(isAuthOverlayPathname('/auth/reset-password')).toBe(true);
    expect(isAuthOverlayPathname('/auth/verify')).toBe(true);
  });

  test('не считает auth-overlay-ом другие маршруты, начинающиеся со схожих токенов', () => {
    expect(isAuthOverlayPathname('/authority')).toBe(false);
    expect(isAuthOverlayPathname('/authorize')).toBe(false);
    expect(isAuthOverlayPathname('/authoring')).toBe(false);
  });

  test('не считает корневые/публичные маршруты auth-overlay-ом', () => {
    expect(isAuthOverlayPathname('/')).toBe(false);
    expect(isAuthOverlayPathname('/albums')).toBe(false);
    expect(isAuthOverlayPathname('/dashboard')).toBe(false);
    expect(isAuthOverlayPathname('')).toBe(false);
  });
});
