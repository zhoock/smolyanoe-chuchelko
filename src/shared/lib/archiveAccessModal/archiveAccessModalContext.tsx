import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';

import { ArchiveAccessModalView } from './ArchiveAccessModalView';

export type ArchiveAccessModalContextValue = {
  open: () => void;
  close: () => void;
};

const ArchiveAccessModalContext = createContext<ArchiveAccessModalContextValue | null>(null);

export function ArchiveAccessModalProvider({ children }: { children: ReactNode }) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  const close = useCallback(() => {
    dialogRef.current?.close();
  }, []);

  useEffect(() => {
    const onActivated = () => close();
    window.addEventListener('subscription:activated', onActivated);
    return () => window.removeEventListener('subscription:activated', onActivated);
  }, [close]);

  const open = useCallback(() => {
    dialogRef.current?.showModal();
  }, []);

  const value = useMemo(() => ({ open, close }), [open, close]);

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
    };
  }
  return ctx;
}
