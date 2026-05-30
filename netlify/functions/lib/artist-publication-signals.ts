export type ArtistPublicationSignals = {
  /** At least one public, non-hidden track on a titled public album. */
  hasPublishedTracks: boolean;
};

/** Catalog and search include the artist only after the first published track. */
export function isArtistPublishedFromSignals(signals: ArtistPublicationSignals): boolean {
  return signals.hasPublishedTracks;
}

export function buildPublicationSignalsFromRow(row: {
  has_published_tracks: boolean;
}): ArtistPublicationSignals {
  return {
    hasPublishedTracks: Boolean(row.has_published_tracks),
  };
}
