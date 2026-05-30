import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { consumeAlbumDeletedToast } from '@shared/lib/albumDeletedToast';
import './style.scss';

const TOAST_DURATION_MS = 4000;

function SuccessIcon() {
  return (
    <svg
      className="album-deleted-toast__icon-svg"
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

export function AlbumDeletedToast() {
  const location = useLocation();
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const nextMessage = consumeAlbumDeletedToast();
    if (nextMessage) {
      setMessage(nextMessage);
    }
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!message) return undefined;

    const timer = window.setTimeout(() => setMessage(null), TOAST_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [message]);

  if (!message) return null;

  return (
    <div
      className="album-deleted-toast"
      role="status"
      aria-live="polite"
      style={{ '--album-deleted-toast-duration': `${TOAST_DURATION_MS}ms` } as React.CSSProperties}
    >
      <div className="album-deleted-toast__icon">
        <SuccessIcon />
      </div>
      <div className="album-deleted-toast__body">
        <p className="album-deleted-toast__title">{message}</p>
      </div>
      <div className="album-deleted-toast__progress" aria-hidden="true" />
    </div>
  );
}
