export type AccountType = 'listener' | 'artist';

export function normalizeAccountType(raw: unknown): AccountType {
  return raw === 'listener' ? 'listener' : 'artist';
}

export function isArtistAccountType(raw: unknown): boolean {
  return normalizeAccountType(raw) === 'artist';
}
