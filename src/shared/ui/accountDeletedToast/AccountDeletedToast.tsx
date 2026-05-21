import { useEffect, useState } from 'react';
import { useLang } from '@app/providers/lang';
import { useAppSelector } from '@shared/lib/hooks/useAppSelector';
import { selectUiDictionaryFirst } from '@shared/model/uiDictionary';
import { consumeAccountDeletedToast } from '@shared/lib/accountDeletedToast';
import './style.scss';

function SuccessIcon() {
  return (
    <svg
      className="account-deleted-toast__icon-svg"
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M5 10.5L8.5 14L15 7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      className="account-deleted-toast__close-svg"
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M4.5 4.5L13.5 13.5M13.5 4.5L4.5 13.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

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

  const en = lang !== 'ru';
  const title =
    ui?.dashboard?.deleteAccountSuccessToast ?? (en ? 'Account deleted' : 'Аккаунт удалён');
  const description =
    ui?.dashboard?.deleteAccountSuccessToastDescription ??
    (en ? 'Account data is no longer available.' : 'Данные аккаунта больше недоступны.');

  return (
    <div className="account-deleted-toast" role="status">
      <div className="account-deleted-toast__icon">
        <SuccessIcon />
      </div>
      <div className="account-deleted-toast__body">
        <p className="account-deleted-toast__title">{title}</p>
        <p className="account-deleted-toast__description">{description}</p>
      </div>
      <button
        type="button"
        className="account-deleted-toast__close"
        onClick={() => setVisible(false)}
        aria-label={ui?.dashboard?.close ?? 'Close'}
      >
        <CloseIcon />
      </button>
    </div>
  );
}
