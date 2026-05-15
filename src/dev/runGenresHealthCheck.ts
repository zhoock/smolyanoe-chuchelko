/**
 * Только development: запрос GET /api/health/genres и предупреждение в консоль при рассинхроне.
 */

import { fetchWithAuthSession } from '@shared/lib/authFetch';

export function runGenresHealthCheck(): void {
  if (typeof window === 'undefined' || process.env.NODE_ENV !== 'development') {
    return;
  }

  void (async () => {
    try {
      const res = await fetchWithAuthSession('/api/health/genres', { cache: 'no-store' });
      const data = (await res.json()) as {
        success?: boolean;
        match?: boolean;
        onlyInCanonical?: string[];
        onlyInDatabase?: string[];
        error?: string;
      };

      if (data.success && data.match) {
        return;
      }

      console.warn('Check: canonicalGenres vs DB genres mismatch', {
        httpStatus: res.status,
        ...data,
      });
    } catch (e) {
      console.warn('Check: canonicalGenres vs DB genres — /api/health/genres request failed', e);
    }
  })();
}
