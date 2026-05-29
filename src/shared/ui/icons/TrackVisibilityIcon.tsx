import clsx from 'clsx';
import type { TrackVisibility } from '@shared/lib/tracks/trackVisibility';

import { SubscriberContentLockIcon } from './SubscriberContentLockIcon';

function GlobeOutlineIcon({ className, size = 20 }: { className?: string; size?: number }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <circle cx="10" cy="10" r="7.25" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2.75 10H17.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path
        d="M10 2.75C12.35 5.15 13.35 7.55 13.35 10C13.35 12.45 12.35 14.85 10 17.25C7.65 14.85 6.65 12.45 6.65 10C6.65 7.55 7.65 5.15 10 2.75Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HiddenTrackIcon({ className, size = 20 }: { className?: string; size?: number }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <circle cx="10" cy="10" r="7.25" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4.5 4.5L15.5 15.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function TrackVisibilityIcon({
  visibility,
  className,
  size = 20,
}: {
  visibility: TrackVisibility;
  className?: string;
  size?: number;
}) {
  const iconClass = clsx(
    'track-visibility-icon',
    `track-visibility-icon--${visibility}`,
    className
  );

  if (visibility === 'subscribers_only') {
    return <SubscriberContentLockIcon className={iconClass} size={size} />;
  }

  if (visibility === 'hidden') {
    return <HiddenTrackIcon className={iconClass} size={size} />;
  }

  return <GlobeOutlineIcon className={iconClass} size={size} />;
}
