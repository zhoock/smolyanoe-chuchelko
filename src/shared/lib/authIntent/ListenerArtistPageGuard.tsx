import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { isListenerAccount } from '@shared/lib/accountType';
import { isAuthenticated } from '@shared/lib/auth';
import { isHomeArtistPagePath } from '@shared/lib/authReturnUrl';
import { useAuthSessionUser } from '@shared/lib/hooks/useAuthSessionUser';

/**
 * Listeners have no artist page — if post-auth routing lands on /?artist=, send them home.
 */
export function ListenerArtistPageGuard() {
  const location = useLocation();
  const navigate = useNavigate();
  const viewer = useAuthSessionUser();

  useEffect(() => {
    if (!isAuthenticated() || !isListenerAccount(viewer)) return;
    if (location.pathname.startsWith('/auth')) return;

    const currentPath = `${location.pathname}${location.search}${location.hash ?? ''}`;
    if (!isHomeArtistPagePath(currentPath)) return;

    navigate({ pathname: location.pathname, search: '', hash: '' }, { replace: true });
  }, [location.hash, location.pathname, location.search, navigate, viewer]);

  return null;
}
