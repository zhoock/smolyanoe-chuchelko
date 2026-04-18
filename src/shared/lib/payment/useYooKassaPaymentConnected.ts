import { useEffect, useState } from 'react';
import { getPaymentSettings } from '@shared/api/payment/settings';

/**
 * Активная ЮKassa у пользователя: запись в БД с is_active и непустым shopId.
 */
export function useYooKassaPaymentConnected(userId: string | undefined | null) {
  const [loading, setLoading] = useState(true);
  const [hasYooKassa, setHasYooKassa] = useState(false);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      setHasYooKassa(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void getPaymentSettings({ userId, provider: 'yookassa' }).then((res) => {
      if (cancelled) return;
      const ok = res.success && !!res.settings?.isActive && !!res.settings?.shopId?.trim();
      setHasYooKassa(ok);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  return { loading, hasYooKassa };
}
