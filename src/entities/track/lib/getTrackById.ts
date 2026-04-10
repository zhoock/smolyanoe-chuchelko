import type { TracksProps } from '@models';
import { normalizeTrackIdString } from '@shared/lib/tracks/normalizeTrackIdString';

/** Найти трек в списке по стабильному `id` (не по индексу массива). */
export function getTrackById(
  tracks: readonly TracksProps[],
  trackId: string
): TracksProps | undefined {
  const needle = normalizeTrackIdString(trackId);
  return tracks.find((t) => t.id === needle);
}
