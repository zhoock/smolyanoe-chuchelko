declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    dataLayer?: any[];
  }
}

/** Универсальная отправка события в GA4 (работает и с gtag, и с GTM) */
export function gaEvent(name: string, params: Record<string, any> = {}) {
  if (window.gtag) {
    window.gtag('event', name, params); // пустой объект — норм
    return;
  }
  if (window.dataLayer) {
    window.dataLayer.push({ event: name, ...params }); // всегда объект
    return;
  }
  if (process.env.NODE_ENV !== 'production') {
    console.debug('[GA4]', name, params);
  }
}
