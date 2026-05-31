import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';

import { isListenerAccount } from '@shared/lib/accountType';
import { isAuthenticated, AUTH_SESSION_CHANGED_EVENT } from '@shared/lib/auth';
import { useAuthSessionUser } from '@shared/lib/hooks/useAuthSessionUser';

import { markListenerWelcomeSeen, shouldShowListenerWelcome } from '../lib/listenerWelcomeStorage';
import { ListenerWelcomeModal } from './ListenerWelcomeModal';

function isUniverseHomePath(pathname: string, search: string): boolean {
  if (pathname !== '/') return false;
  return !new URLSearchParams(search).has('artist');
}

/**
 * Shows one-time welcome modal for listeners on universe home after registration.
 */
export function ListenerWelcomeController() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const viewer = useAuthSessionUser();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const openedForUserRef = useRef<string | null>(null);

  const tryOpen = useCallback(() => {
    if (!isAuthenticated()) {
      setOpen(false);
      return;
    }

    const userId = viewer?.id?.trim();
    if (!userId || !isListenerAccount(viewer)) {
      setOpen(false);
      return;
    }

    if (location.pathname.startsWith('/auth')) return;
    if (!isUniverseHomePath(location.pathname, searchParams.toString())) return;
    if (!shouldShowListenerWelcome(userId)) return;
    if (openedForUserRef.current === userId && open) return;

    openedForUserRef.current = userId;
    setOpen(true);
  }, [location.pathname, open, searchParams, viewer]);

  useEffect(() => {
    tryOpen();
  }, [tryOpen]);

  useEffect(() => {
    const onAuthChanged = () => {
      tryOpen();
    };
    window.addEventListener(AUTH_SESSION_CHANGED_EVENT, onAuthChanged);
    return () => window.removeEventListener(AUTH_SESSION_CHANGED_EVENT, onAuthChanged);
  }, [tryOpen]);

  const handleDismiss = useCallback(() => {
    const userId = viewer?.id?.trim();
    if (userId) {
      markListenerWelcomeSeen(userId);
    }
    setOpen(false);
  }, [viewer?.id]);

  return <ListenerWelcomeModal dialogRef={dialogRef} open={open} onDismiss={handleDismiss} />;
}
