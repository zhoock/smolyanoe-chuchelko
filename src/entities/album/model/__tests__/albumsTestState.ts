import type { AlbumsState } from '../types';

/** Минимальный `albums` slice для unit/integration тестов с полным `AlbumsState`. */
export function createAlbumsTestState(overrides: Partial<AlbumsState> = {}): AlbumsState {
  return {
    status: 'idle',
    error: null,
    data: [],
    lastUpdated: null,
    fetchContextKey: null,
    inFlightFetchContextKey: null,
    catalogArtistMissing: false,
    dashboard: {
      status: 'idle',
      error: null,
      data: [],
      lastUpdated: null,
      inFlightFetchContextKey: null,
    },
    ...overrides,
  };
}
