import { useCallback, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { useLang } from '@app/providers/lang';
import { isAuthenticated, AUTH_SESSION_CHANGED_EVENT } from '@shared/lib/auth';
import { useAuthSessionUser } from '@shared/lib/hooks/useAuthSessionUser';
import { buildOwnArtistPagePath, fetchOwnArtistPageState } from '@shared/lib/ownArtistPage';

import { shouldResumePremiumCheckoutAfterAuth } from './premiumCheckoutIntent';
import {
  clearFirstArtistOnboardingPending,
  hasFirstArtistOnboardingPending,
} from './artistOnboardingRedirect';

/**
 * After registration, redirects once to owner onboarding when the artist page has no public releases.
 */
export function ArtistOnboardingRedirectController() {
  const location = useLocation();
  const navigate = useNavigate();
  const { lang } = useLang();
  const viewer = useAuthSessionUser();
  const redirectInFlightRef = useRef(false);
  const redirectedForSessionRef = useRef(false);

  const tryRedirect = useCallback(async () => {
    if (typeof window === 'undefined') return;
    if (!isAuthenticated()) return;

    const viewerId = viewer?.id?.trim();
    if (!viewerId) return;
    if (location.pathname.startsWith('/auth')) return;
    if (location.pathname.startsWith('/pay/')) return;
    if (redirectedForSessionRef.current || redirectInFlightRef.current) return;
    if (shouldResumePremiumCheckoutAfterAuth()) return;
    if (!hasFirstArtistOnboardingPending(viewerId)) return;

    redirectInFlightRef.current = true;

    try {
      const state = await fetchOwnArtistPageState(lang);
      clearFirstArtistOnboardingPending();

      if (!state.needsOnboarding || !state.publicSlug) return;

      const targetPath = buildOwnArtistPagePath(state.publicSlug);
      const currentArtist = new URLSearchParams(location.search)
        .get('artist')
        ?.trim()
        .toLowerCase();
      if (location.pathname === '/' && currentArtist === state.publicSlug.trim().toLowerCase()) {
        return;
      }

      redirectedForSessionRef.current = true;
      navigate(targetPath, { replace: true });
    } finally {
      redirectInFlightRef.current = false;
    }
  }, [lang, location.pathname, location.search, navigate, viewer?.id]);

  useEffect(() => {
    void tryRedirect();
  }, [tryRedirect]);

  useEffect(() => {
    const onAuthChanged = () => {
      if (!isAuthenticated()) {
        redirectedForSessionRef.current = false;
        return;
      }
      void tryRedirect();
    };
    window.addEventListener(AUTH_SESSION_CHANGED_EVENT, onAuthChanged);
    return () => window.removeEventListener(AUTH_SESSION_CHANGED_EVENT, onAuthChanged);
  }, [tryRedirect]);

  return null;
}
