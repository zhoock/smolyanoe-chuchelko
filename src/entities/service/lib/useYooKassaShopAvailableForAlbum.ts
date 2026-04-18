import { useEffect, useState } from 'react';
import type { IAlbums, String } from '@models';
import { getYooKassaShopId } from '@shared/api/payment';
import { getAlbumKeyForPaymentApis } from '@shared/lib/payment/albumPaymentKey';
import {
  hasAlbumPurchaseSectionContent,
  hasTruthyButtonUrl,
  isAlbumPaidSaleEnabled,
} from './albumPurchaseUtils';

type YookassaState = { status: 'loading' | 'done'; available: boolean };

/**
 * Продавец альбома с активной ЮKassa в БД (без shop ID кнопка «скачать» не показывается).
 */
export function useYooKassaShopAvailableForAlbum(album: IAlbums, enabled: boolean) {
  const [state, setState] = useState<YookassaState>(() =>
    enabled ? { status: 'loading', available: false } : { status: 'done', available: false }
  );

  useEffect(() => {
    if (!enabled) {
      setState({ status: 'done', available: false });
      return;
    }
    const paymentKey = getAlbumKeyForPaymentApis(album);
    if (!paymentKey) {
      setState({ status: 'done', available: false });
      return;
    }

    setState({ status: 'loading', available: false });
    let cancelled = false;

    void getYooKassaShopId(paymentKey).then(({ shopId }) => {
      if (!cancelled) {
        setState({ status: 'done', available: Boolean(shopId) });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [enabled, album.albumId, album.dbAlbumId]);

  return {
    loading: state.status === 'loading',
    available: state.available,
  };
}

/**
 * Показывать ли блок «Купить» на странице альбома: если включена только продажа скачивания,
 * блок есть только при настроенной ЮKassa у продавца.
 */
export function useShowAlbumPurchaseSection(album: IAlbums | undefined): boolean | null {
  const buttons = album?.buttons as String | undefined;
  const isDownloadAllowed = album ? isAlbumPaidSaleEnabled(album) : false;
  const hasPurchaseLinks = hasTruthyButtonUrl(buttons, ['itunes', 'bandcamp', 'amazon']);
  const { loading, available } = useYooKassaShopAvailableForAlbum(
    album ?? ({ albumId: '' } as IAlbums),
    Boolean(album && isDownloadAllowed)
  );

  if (!album) {
    return false;
  }
  if (!hasAlbumPurchaseSectionContent(album)) {
    return false;
  }
  if (hasPurchaseLinks) {
    return true;
  }
  if (loading) {
    return null;
  }
  return available;
}
