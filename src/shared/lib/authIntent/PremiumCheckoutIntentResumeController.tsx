import { useCallback, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

import { isAuthenticated, AUTH_SESSION_CHANGED_EVENT } from '@shared/lib/auth';
import { useAuthSessionUser } from '@shared/lib/hooks/useAuthSessionUser';
import { useArchiveAccessModal } from '@shared/lib/archiveAccessModal';

import {
  clearPremiumCheckoutAuthIntent,
  clearPremiumCheckoutResumeAfterAuthFlag,
  readPremiumCheckoutAuthIntent,
  shouldResumePremiumCheckoutAfterAuth,
} from './premiumCheckoutIntent';
import { resolveArtistUserIdByPublicSlug } from './resolveArtistUserIdBySlug';

/**
 * After login/register, reopens ArchiveAccessModal when guest started Premium before auth.
 */
export function PremiumCheckoutIntentResumeController() {
  const location = useLocation();
  const viewer = useAuthSessionUser();
  const { openFromIntentResume } = useArchiveAccessModal();
  const resumeInFlightRef = useRef(false);
  const resumedForSessionRef = useRef(false);

  const tryResume = useCallback(async () => {
    if (typeof window === 'undefined') return;
    if (!isAuthenticated()) return;
    if (location.pathname.startsWith('/auth')) return;
    if (location.pathname.startsWith('/pay/')) return;
    if (resumedForSessionRef.current || resumeInFlightRef.current) return;
    if (!shouldResumePremiumCheckoutAfterAuth()) return;

    const intent = readPremiumCheckoutAuthIntent();
    if (!intent) {
      clearPremiumCheckoutResumeAfterAuthFlag();
      return;
    }

    resumeInFlightRef.current = true;
    clearPremiumCheckoutResumeAfterAuthFlag();

    try {
      const viewerId = viewer?.id?.trim();
      if (viewerId) {
        if (intent.artistUserId && intent.artistUserId === viewerId) {
          clearPremiumCheckoutAuthIntent();
          return;
        }
        if (intent.artistSlug) {
          const ownerId = await resolveArtistUserIdByPublicSlug(intent.artistSlug);
          if (ownerId && ownerId === viewerId) {
            clearPremiumCheckoutAuthIntent();
            return;
          }
        }
      }

      resumedForSessionRef.current = true;
      openFromIntentResume({
        artistSlug: intent.artistSlug || undefined,
        artistUserId: intent.artistUserId || undefined,
      });
    } finally {
      resumeInFlightRef.current = false;
    }
  }, [location.pathname, openFromIntentResume, viewer?.id]);

  useEffect(() => {
    void tryResume();
  }, [tryResume, location.pathname, location.search, viewer?.id]);

  useEffect(() => {
    const onAuthChanged = () => {
      if (!isAuthenticated()) {
        resumedForSessionRef.current = false;
        return;
      }
      void tryResume();
    };
    window.addEventListener(AUTH_SESSION_CHANGED_EVENT, onAuthChanged);
    return () => window.removeEventListener(AUTH_SESSION_CHANGED_EVENT, onAuthChanged);
  }, [tryResume]);

  return null;
}
