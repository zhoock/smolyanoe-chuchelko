import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  clearAccountDeletedLeaveArtist,
  clearAccountDeletedSkipReturn,
  shouldLeaveDeletedArtistPage,
} from '@shared/lib/accountDeletedSession';

/**
 * После удаления своего аккаунта: уйти с /?artist=deleted-slug на главную.
 * Флаг сессии не сбрасываем на /auth — иначе закрытие формы вернёт на artist через history.
 */
export function useRedirectHomeAfterOwnAccountDeleted(hasArtistContext: boolean): boolean {
  const navigate = useNavigate();
  const location = useLocation();
  const leaveArtistSession = shouldLeaveDeletedArtistPage();
  const shouldSuppressArtistUi = leaveArtistSession && hasArtistContext;

  useEffect(() => {
    if (!shouldSuppressArtistUi) return;

    navigate({ pathname: '/', search: '' }, { replace: true });
  }, [shouldSuppressArtistUi, navigate]);

  useEffect(() => {
    if (!leaveArtistSession || hasArtistContext || location.pathname === '/auth') return;

    clearAccountDeletedLeaveArtist();
    clearAccountDeletedSkipReturn();
  }, [leaveArtistSession, hasArtistContext, location.pathname]);

  return shouldSuppressArtistUi;
}
