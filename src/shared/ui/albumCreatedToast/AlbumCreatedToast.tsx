import { useEffect, useState } from 'react';
import { useLang } from '@app/providers/lang';
import { useAppSelector } from '@shared/lib/hooks/useAppSelector';
import { consumeAlbumCreatedToast } from '@shared/lib/albumCreatedToast';
import { selectUiDictionaryFirst } from '@shared/model/uiDictionary';
import './style.scss';

const TOAST_DURATION_MS = 4500;

function SuccessIcon() {
  return (
    <svg
      className="album-created-toast__icon-svg"
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

type AlbumCreatedToastProps = {
  triggerKey: unknown;
};

export function AlbumCreatedToast({ triggerKey }: AlbumCreatedToastProps) {
  const { lang } = useLang();
  const ui = useAppSelector((state) => selectUiDictionaryFirst(state, lang));
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (consumeAlbumCreatedToast()) {
      setVisible(true);
    }
  }, [triggerKey]);

  useEffect(() => {
    if (!visible) return undefined;

    const timer = window.setTimeout(() => setVisible(false), TOAST_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [visible]);

  if (!visible) return null;

  const en = lang !== 'ru';
  const title = ui?.dashboard?.albumCreatedSuccessToast ?? (en ? 'Album created' : 'Альбом создан');
  const description =
    ui?.dashboard?.albumCreatedSuccessToastDescription ??
    (en ? 'Upload tracks to complete publication.' : 'Загрузите треки для завершения публикации.');

  return (
    <div
      className="album-created-toast"
      role="status"
      aria-live="polite"
      style={{ '--album-created-toast-duration': `${TOAST_DURATION_MS}ms` } as React.CSSProperties}
    >
      <div className="album-created-toast__icon">
        <SuccessIcon />
      </div>
      <div className="album-created-toast__body">
        <p className="album-created-toast__title">{title}</p>
        <p className="album-created-toast__description">{description}</p>
      </div>
      <div className="album-created-toast__progress" aria-hidden="true" />
    </div>
  );
}
