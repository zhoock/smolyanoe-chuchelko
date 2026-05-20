import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';

import { getToken } from '@shared/lib/auth';
import { useAuthSessionUser } from '@shared/lib/hooks/useAuthSessionUser';
import {
  beginPremiumCheckoutAuthIntent,
  clearPremiumCheckoutAuthIntent,
  type PremiumCheckoutIntentContext,
} from '@shared/lib/authIntent';

import { ArchiveAccessModalView } from './ArchiveAccessModalView';

export type OpenArchiveAccessModalOptions = PremiumCheckoutIntentContext;

export type CloseArchiveAccessModalOptions = {
  /** Keep pending premium checkout intent (e.g. redirecting to auth or YooKassa). */
  preserveCheckoutIntent?: boolean;
};

export type ArchiveAccessModalContextValue = {
  open: (options?: OpenArchiveAccessModalOptions) => void;
  close: (options?: CloseArchiveAccessModalOptions) => void;
  /** Reopen paywall after auth without re-saving intent or resume flag. */
  openFromIntentResume: (options?: OpenArchiveAccessModalOptions) => void;
};

const ArchiveAccessModalContext = createContext<ArchiveAccessModalContextValue | null>(null);

function isGuestSession(): boolean {
  return !getToken();
}

export function ArchiveAccessModalProvider({ children }: { children: ReactNode }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const viewer = useAuthSessionUser();

  const close = useCallback((options?: CloseArchiveAccessModalOptions) => {
    if (!options?.preserveCheckoutIntent) {
      clearPremiumCheckoutAuthIntent();
    }
    dialogRef.current?.close();
  }, []);

  useEffect(() => {
    const onActivated = () => {
      clearPremiumCheckoutAuthIntent();
      close({ preserveCheckoutIntent: true });
    };
    window.addEventListener('subscription:activated', onActivated);
    return () => window.removeEventListener('subscription:activated', onActivated);
  }, [close]);

  const showModal = useCallback(() => {
    dialogRef.current?.showModal();
  }, []);

  const open = useCallback(
    (options?: OpenArchiveAccessModalOptions) => {
      if (isGuestSession() && !viewer?.id) {
        beginPremiumCheckoutAuthIntent(options);
      }
      showModal();
    },
    [showModal, viewer?.id]
  );

  const openFromIntentResume = useCallback(
    (options?: OpenArchiveAccessModalOptions) => {
      showModal();
      void options;
    },
    [showModal]
  );

  const value = useMemo(
    () => ({ open, close, openFromIntentResume }),
    [open, close, openFromIntentResume]
  );

  return (
    <ArchiveAccessModalContext.Provider value={value}>
      {children}
      <ArchiveAccessModalView dialogRef={dialogRef} onClose={close} />
    </ArchiveAccessModalContext.Provider>
  );
}

export function useArchiveAccessModal(): ArchiveAccessModalContextValue {
  const ctx = useContext(ArchiveAccessModalContext);
  if (!ctx) {
    return {
      open: () => {},
      close: () => {},
      openFromIntentResume: () => {},
    };
  }
  return ctx;
}
