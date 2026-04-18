import type { String, IAlbums } from '@models';

export function getAllowDownloadSaleValue(album: IAlbums): string {
  return album?.release && typeof album.release === 'object' && 'allowDownloadSale' in album.release
    ? String((album.release as Record<string, unknown>).allowDownloadSale)
    : 'no';
}

/** Альбом помечен как платная продажа/предзаказ (настройка в release). */
export function isAlbumPaidSaleEnabled(album: IAlbums): boolean {
  const v = getAllowDownloadSaleValue(album);
  return v === 'yes' || v === 'preorder';
}

export function hasTruthyButtonUrl(buttons: String | undefined, keys: readonly string[]): boolean {
  return keys.some((key) => Boolean(buttons?.[key]?.trim()));
}

/** Есть ли что показать в блоке «Купить»: скачивание/продажа или хотя бы одна ссылка (iTunes / Bandcamp / Amazon). */
export function hasAlbumPurchaseSectionContent(album: IAlbums): boolean {
  const buttons = album?.buttons as String | undefined;
  const isDownloadAllowed = isAlbumPaidSaleEnabled(album);
  const hasPurchaseLinks = hasTruthyButtonUrl(buttons, ['itunes', 'bandcamp', 'amazon']);
  return isDownloadAllowed || hasPurchaseLinks;
}

/** Есть ли что показать в блоке «Слушать»: хотя бы одна стриминговая ссылка. */
export function hasAlbumStreamSectionContent(album: IAlbums): boolean {
  const buttons = album?.buttons as String | undefined;
  return hasTruthyButtonUrl(buttons, [
    'apple',
    'vk',
    'youtube',
    'spotify',
    'yandex',
    'deezer',
    'tidal',
  ]);
}
