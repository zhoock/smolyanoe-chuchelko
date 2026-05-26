import { useCallback, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { isAuthenticated, AUTH_SESSION_CHANGED_EVENT } from '@shared/lib/auth';
import { useAuthSessionUser } from '@shared/lib/hooks/useAuthSessionUser';

import {
  clearAlbumCheckoutAuthIntent,
  clearAlbumCheckoutResumeAfterAuthFlag,
  markPendingAlbumCheckoutForKey,
  readAlbumCheckoutAuthIntent,
  shouldResumeAlbumCheckoutAfterAuth,
} from './albumCheckoutIntent';

/**
 * После login/register, если гость нажал Sign in/Create account из
 * album auth-gate, мы:
 *  1) ставим pending-key для конкретного альбома (его прочитает
 *     ServiceButtons → откроет checkout-модал сам);
 *  2) при необходимости переходим на album page (returnTo) — обычно
 *     уже не нужно, т.к. AuthPage сам ведёт на postAuthPath, но
 *     подстраховываемся, если backgroundLocation потерялся;
 *  3) очищаем intent + resume-флаг.
 *
 * Симметрично `PremiumCheckoutIntentResumeController`.
 */
export function AlbumCheckoutIntentResumeController() {
  const location = useLocation();
  const navigate = useNavigate();
  const viewer = useAuthSessionUser();
  const resumeInFlightRef = useRef(false);
  const resumedForSessionRef = useRef(false);

  const tryResume = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (!isAuthenticated()) return;
    if (location.pathname.startsWith('/auth')) return;
    if (location.pathname.startsWith('/pay/')) return;
    if (resumedForSessionRef.current || resumeInFlightRef.current) return;
    if (!shouldResumeAlbumCheckoutAfterAuth()) return;

    const intent = readAlbumCheckoutAuthIntent();
    if (!intent || !intent.albumKey) {
      clearAlbumCheckoutResumeAfterAuthFlag();
      clearAlbumCheckoutAuthIntent();
      return;
    }

    resumeInFlightRef.current = true;

    try {
      resumedForSessionRef.current = true;
      // ServiceButtons на album page прочитает этот ключ при mount
      // и сам откроет AlbumCheckoutModal с готовой формой.
      markPendingAlbumCheckoutForKey(intent.albumKey);

      const currentPath = `${location.pathname}${location.search}`;
      if (intent.returnTo && intent.returnTo !== currentPath) {
        navigate(intent.returnTo, { replace: true });
      }
    } finally {
      clearAlbumCheckoutResumeAfterAuthFlag();
      clearAlbumCheckoutAuthIntent();
      resumeInFlightRef.current = false;
    }
  }, [location.pathname, location.search, navigate]);

  useEffect(() => {
    tryResume();
  }, [tryResume, location.pathname, location.search, viewer?.id]);

  useEffect(() => {
    const onAuthChanged = () => {
      if (!isAuthenticated()) {
        resumedForSessionRef.current = false;
        return;
      }
      tryResume();
    };
    window.addEventListener(AUTH_SESSION_CHANGED_EVENT, onAuthChanged);
    return () => window.removeEventListener(AUTH_SESSION_CHANGED_EVENT, onAuthChanged);
  }, [tryResume]);

  return null;
}
