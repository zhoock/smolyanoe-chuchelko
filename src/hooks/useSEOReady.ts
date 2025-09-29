// src/hooks/useSEOReady.ts

import { useEffect } from 'react';

export function useSEOReady(deps: unknown[] = []) {
  useEffect(() => {
    const id = window.setTimeout(() => {
      document.dispatchEvent(new Event('seo-ready'));
    }, 0);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
