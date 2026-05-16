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
  icon: string;
}[] = [
  {
    value: 'public',
    icon: '🌍',
  },
  {
    value: 'subscribers_only',
    icon: '🔒',
  },
  {
    value: 'hidden',
    icon: '🚫',
  },
] as const;

export function visibilityIcon(v: TrackVisibility): string {
  return TRACK_VISIBILITY_OPTIONS.find((o) => o.value === v)?.icon ?? '🌍';
}
