// src/pages/UserDashboard/components/EditAlbumModal.constants.ts

export type GenreOption = {
  code: string;
  label: {
    en: string;
    ru: string;
  };
};

export const GENRE_OPTIONS: GenreOption[] = [
  { code: 'grunge', label: { en: 'Grunge', ru: 'Гранж' } },
  { code: 'alternative', label: { en: 'Alternative', ru: 'Альтернатива' } },
  { code: 'punk', label: { en: 'Punk', ru: 'Панк' } },
  { code: 'rock', label: { en: 'Rock', ru: 'Рок' } },
  { code: 'metal', label: { en: 'Metal', ru: 'Метал' } },
  { code: 'other', label: { en: 'Other', ru: 'Другое' } },
];

export const MAX_TAGS = 10;
export const MIN_TAG_LENGTH = 2;
export const MAX_TAG_LENGTH = 30;
export const MAX_BAND_MEMBERS = 20;
export const DEFAULT_PRODUCING_CREDIT_TYPES = ['Producer', 'Mastering'];

export const PURCHASE_SERVICES = [
  { id: 'apple', name: 'Apple', icon: 'icon-apple' },
  { id: 'bandcamp', name: 'Bandcamp', icon: 'icon-bandcamp' },
  { id: 'amazon', name: 'Amazon', icon: 'icon-amazon' },
  { id: 'physical', name: 'Physical store', icon: '' },
];

export const STREAMING_SERVICES = [
  { id: 'applemusic', name: 'Apple Music', icon: 'icon-applemusic' },
  { id: 'vk', name: 'VK', icon: 'icon-vk' },
  { id: 'youtube', name: 'YouTube', icon: 'icon-youtube' },
  { id: 'spotify', name: 'Spotify', icon: 'icon-spotify' },
  { id: 'yandex', name: 'Yandex Music', icon: 'icon-yandex' },
  { id: 'tidal', name: 'TIDAL', icon: 'icon-tidal' },
  { id: 'deezer', name: 'Deezer', icon: 'icon-deezer' },
  { id: 'googleplay', name: 'Google Play', icon: 'icon-googleplay' },
];
