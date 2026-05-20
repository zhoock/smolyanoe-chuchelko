import { useEffect, useState } from 'react';
import { useLang } from '@app/providers/lang';
import { useAppSelector } from '@shared/lib/hooks/useAppSelector';
import { selectUiDictionaryFirst } from '@shared/model/uiDictionary';
import { consumeAccountDeletedToast } from '@shared/lib/accountDeletedToast';
import './style.scss';

export function AccountDeletedToast() {
  const { lang } = useLang();
  const ui = useAppSelector((state) => selectUiDictionaryFirst(state, lang));
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (consumeAccountDeletedToast()) {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  const message =
    ui?.dashboard?.deleteAccountSuccessToast ??
    (lang !== 'ru' ? 'Account deleted permanently' : 'Аккаунт удалён навсегда');

  return (
    <div className="account-deleted-toast" role="status">
      <span className="account-deleted-toast__text">{message}</span>
      <button
        type="button"
        className="account-deleted-toast__close"
        onClick={() => setVisible(false)}
        aria-label={ui?.dashboard?.close ?? 'Close'}
      >
        ×
      </button>
    </div>
  );
}
