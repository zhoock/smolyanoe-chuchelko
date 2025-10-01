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

  // ЛОГ ДЛЯ ТЕБЯ
  // Webpack/CRA: process.env.NODE_ENV === 'production' на проде.
  // Vite: можно использовать import.meta.env.MODE !== 'production'.
  if (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production') {
    // компактная строка
    console.debug('[GA4]', name, params);
    // удобно просматривать параметры:
    // console.table({ event: name, ...params });
  }
}
