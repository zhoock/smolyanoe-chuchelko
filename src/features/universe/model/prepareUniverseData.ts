import type { SceneArtist } from '@components/view/Universe3D';

export function prepareUniverseData(artists: SceneArtist[]): SceneArtist[] {
  return artists.map((a) => ({
    ...a,
    genreCode: a.genreCode || 'other',
  }));
}
