declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    dataLayer?: any[];
  }
}

const DEBUG_GA =
  (typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('debugGa') === '1') ||
  (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production'); // логай и в деве

export function gaEvent(name: string, params: Record<string, any> = {}) {
  // ЛОГ — СРАЗУ, ДО return
  if (DEBUG_GA) {
    console.log('[GA4]', name, params);
    // можно ещё: console.table({ event: name, ...params });
  }

  if (window.gtag) {
    window.gtag('event', name, params);
    return;
  }
  if (window.dataLayer) {
    window.dataLayer.push({ event: name, ...params });
    return;
  }
}
