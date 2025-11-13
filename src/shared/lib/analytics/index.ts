declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    dataLayer?: any[];
  }
}

const DEBUG_GA =
  (typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('debugGa') === '1') ||
  (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production');

export function gaEvent(name: string, params: Record<string, any> = {}) {
  if (DEBUG_GA) {
    console.log('[GA4]', name, params);
  }

  if (window.gtag) {
    window.gtag('event', name, params);
    return;
  }

  if (window.dataLayer) {
    window.dataLayer.push({ event: name, ...params });
  }
}
