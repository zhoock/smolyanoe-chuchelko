import { useCallback, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

import { refreshPremiumContentForArchiveChange } from '@features/artistArchive';
import { isAuthenticated, AUTH_SESSION_CHANGED_EVENT } from '@shared/lib/auth';
import { useAuthSessionUser } from '@shared/lib/hooks/useAuthSessionUser';
import { useAppDispatch } from '@shared/lib/hooks/useAppDispatch';
import { useArchiveAccessModal } from '@shared/lib/archiveAccessModal';

import {
  clearPremiumCheckoutAuthIntent,
  clearPremiumCheckoutResumeAfterAuthFlag,
  readPremiumCheckoutAuthIntent,
  resolvePremiumCheckoutArtistContext,
  shouldResumePremiumCheckoutAfterAuth,
} from './premiumCheckoutIntent';
import { resolveArtistUserIdByPublicSlug } from './resolveArtistUserIdBySlug';

/**
 * After login/register, re-evaluates premium/archive access for the protected
 * content the guest tried to open — never blindly restores the guest paywall.
 */
export function PremiumCheckoutIntentResumeController() {
  const location = useLocation();
  const dispatch = useAppDispatch();
  const viewer = useAuthSessionUser();
  const { requestAccess, close } = useArchiveAccessModal();
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
      const { artistSlug: intentArtistSlug, artistUserId: intentArtistUserId } =
        resolvePremiumCheckoutArtistContext(intent);

      if (viewerId) {
        if (intentArtistUserId && intentArtistUserId === viewerId) {
          clearPremiumCheckoutAuthIntent();
          return;
        }
        if (intentArtistSlug) {
          const ownerId = await resolveArtistUserIdByPublicSlug(intentArtistSlug);
          if (ownerId && ownerId === viewerId) {
            clearPremiumCheckoutAuthIntent();
            return;
          }
        }
      }

      close({ preserveCheckoutIntent: true });

      let artistUserId = intentArtistUserId;
      const artistSlug = intentArtistSlug || undefined;
      if (!artistUserId && artistSlug) {
        artistUserId = (await resolveArtistUserIdByPublicSlug(artistSlug)) ?? '';
      }

      resumedForSessionRef.current = true;

      await requestAccess({
        artistUserId: artistUserId || undefined,
        artistSlug,
        onAccessGranted: async () => {
          refreshPremiumContentForArchiveChange(dispatch, artistSlug, { immediate: true });
        },
      });
    } finally {
      clearPremiumCheckoutAuthIntent();
      resumeInFlightRef.current = false;
    }
  }, [close, dispatch, location.pathname, requestAccess, viewer?.id]);

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
