import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { getMyArchive } from '@shared/api/archive';
import { getToken } from '@shared/lib/auth';
import { ARCHIVE_CHANGED_EVENT, SUBSCRIPTION_ACTIVATED_EVENT } from '@features/artistArchive';

export type PremiumSubscriptionContextValue = {
  isPremium: boolean;
  slotsLimit: number;
  loading: boolean;
  refetch: () => Promise<void>;
};

const PremiumSubscriptionContext = createContext<PremiumSubscriptionContextValue | null>(null);

export function PremiumSubscriptionProvider({ children }: { children: ReactNode }) {
  const [isPremium, setIsPremium] = useState(false);
  const [slotsLimit, setSlotsLimit] = useState(3);
  const [loading, setLoading] = useState(false);

  const refetch = useCallback(async () => {
    if (!getToken()) {
      setIsPremium(false);
      setSlotsLimit(3);
      return;
    }

    setLoading(true);
    try {
      const data = await getMyArchive();
      setIsPremium(data.isPremium);
      setSlotsLimit(data.slotsLimit);
    } catch {
      setIsPremium(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();

    const onChanged = () => {
      void refetch();
    };

    window.addEventListener(SUBSCRIPTION_ACTIVATED_EVENT, onChanged);
    window.addEventListener(ARCHIVE_CHANGED_EVENT, onChanged);
    return () => {
      window.removeEventListener(SUBSCRIPTION_ACTIVATED_EVENT, onChanged);
      window.removeEventListener(ARCHIVE_CHANGED_EVENT, onChanged);
    };
  }, [refetch]);

  const value = useMemo(
    () => ({ isPremium, slotsLimit, loading, refetch }),
    [isPremium, loading, refetch, slotsLimit]
  );

  return (
    <PremiumSubscriptionContext.Provider value={value}>
      {children}
    </PremiumSubscriptionContext.Provider>
  );
}

export function usePremiumSubscription(): PremiumSubscriptionContextValue {
  const ctx = useContext(PremiumSubscriptionContext);
  if (!ctx) {
    return {
      isPremium: false,
      slotsLimit: 3,
      loading: false,
      refetch: async () => {},
    };
  }
  return ctx;
}
