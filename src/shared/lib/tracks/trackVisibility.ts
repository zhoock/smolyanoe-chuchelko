export type TrackVisibility = 'public' | 'subscribers_only' | 'hidden';

const VIS_SET: ReadonlySet<string> = new Set(['public', 'subscribers_only', 'hidden']);

export function normalizeTrackVisibility(raw: unknown): TrackVisibility {
  if (typeof raw === 'string' && VIS_SET.has(raw)) {
    return raw as TrackVisibility;
  }
  return 'public';
}

export const TRACK_VISIBILITY_OPTIONS: readonly {
  value: TrackVisibility;
}[] = [
  {
    value: 'public',
  },
  {
    value: 'subscribers_only',
  },
  {
    value: 'hidden',
  },
] as const;
