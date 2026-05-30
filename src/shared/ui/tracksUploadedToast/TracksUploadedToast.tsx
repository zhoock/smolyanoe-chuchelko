import { useEffect, useState } from 'react';
import { consumeTracksUploadedToast } from '@shared/lib/tracksUploadedToast';
import './style.scss';

const TOAST_DURATION_MS = 4500;

function SuccessIcon() {
  return (
    <svg
      className="tracks-uploaded-toast__icon-svg"
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

type TracksUploadedToastProps = {
  triggerKey: unknown;
};

export function TracksUploadedToast({ triggerKey }: TracksUploadedToastProps) {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const nextMessage = consumeTracksUploadedToast();
    if (nextMessage) {
      setMessage(nextMessage);
    }
  }, [triggerKey]);

  useEffect(() => {
    if (!message) return undefined;

    const timer = window.setTimeout(() => setMessage(null), TOAST_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [message]);

  if (!message) return null;

  return (
    <div
      className="tracks-uploaded-toast"
      role="status"
      aria-live="polite"
      style={
        { '--tracks-uploaded-toast-duration': `${TOAST_DURATION_MS}ms` } as React.CSSProperties
      }
    >
      <div className="tracks-uploaded-toast__icon">
        <SuccessIcon />
      </div>
      <div className="tracks-uploaded-toast__body">
        <p className="tracks-uploaded-toast__title">{message}</p>
      </div>
      <div className="tracks-uploaded-toast__progress" aria-hidden="true" />
    </div>
  );
}
