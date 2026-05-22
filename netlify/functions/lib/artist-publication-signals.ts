export type ArtistPublicationSignals = {
  hasPublicAlbum: boolean;
};

/** Профиль публичен только после первого опубликованного релиза. */
export function isArtistPublishedFromSignals(signals: ArtistPublicationSignals): boolean {
  return signals.hasPublicAlbum;
}

export function buildPublicationSignalsFromRow(row: {
  has_public_album: boolean;
}): ArtistPublicationSignals {
  return {
    hasPublicAlbum: Boolean(row.has_public_album),
  };
}
