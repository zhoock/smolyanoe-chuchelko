import { useEffect } from 'react';
import { isEmailVerified, refreshAuthSession } from '@shared/lib/auth';
import { useAuthSessionUser } from '@shared/lib/hooks/useAuthSessionUser';

/** Периодически обновляет isEmailVerified без перезагрузки страницы. */
export function EmailVerificationRefreshController() {
  const user = useAuthSessionUser();

  useEffect(() => {
    if (!user || isEmailVerified(user)) return;

    const refresh = () => {
      void refreshAuthSession();
    };

    refresh();
    window.addEventListener('focus', refresh);
    const id = window.setInterval(refresh, 15_000);

    return () => {
      window.removeEventListener('focus', refresh);
      window.clearInterval(id);
    };
  }, [user?.id, user?.isEmailVerified]);

  return null;
}
