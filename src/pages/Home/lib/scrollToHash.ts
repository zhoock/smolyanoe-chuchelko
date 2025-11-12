import { HEADER_OFFSET } from '@pages/Home/config/constants';

type ScrollToHashOptions = {
  offset?: number;
  behavior?: ScrollBehavior;
};

export function scrollToHash(hash: string | null, options: ScrollToHashOptions = {}) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  if (!hash) {
    return;
  }

  const { offset = HEADER_OFFSET, behavior = 'smooth' } = options;
  const targetId = hash.startsWith('#') ? hash.slice(1) : hash;
  const target = document.getElementById(targetId);

  if (!target) {
    return;
  }

  const top = target.getBoundingClientRect().top + window.scrollY - offset;
  window.scrollTo({ top: Math.max(top, 0), behavior });
}
