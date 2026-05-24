import { useEffect, useState, useSyncExternalStore } from 'react';
import type { IAlbums } from '@models';
import { getMyPurchases, type Purchase } from '@shared/api/purchases';
import { getAlbumKeyForPaymentApis } from '@shared/lib/payment/albumPaymentKey';
import {
  getAuthSessionIdentityKey,
  getUser,
  isAuthenticated,
  subscribeAuthSession,
} from '@shared/lib/auth';

let cachedUserId: string | null = null;
let cachedPurchases: Awaited<ReturnType<typeof getMyPurchases>> | null = null;
let inflightPurchases: Promise<Awaited<ReturnType<typeof getMyPurchases>>> | null = null;

function resetPurchaseCache() {
  cachedUserId = null;
  cachedPurchases = null;
  inflightPurchases = null;
}

if (typeof window !== 'undefined') {
  subscribeAuthSession(() => {
    resetPurchaseCache();
  });
}

async function loadPurchasesForUser(userId: string) {
  if (cachedPurchases && cachedUserId === userId) {
    return cachedPurchases;
  }

  if (inflightPurchases) {
    return inflightPurchases;
  }

  inflightPurchases = getMyPurchases()
    .then((purchases) => {
      cachedUserId = userId;
      cachedPurchases = purchases;
      return purchases;
    })
    .finally(() => {
      inflightPurchases = null;
    });

  return inflightPurchases;
}

function findOwnedPurchase(
  album: { dbAlbumId?: string },
  albumKey: string | undefined,
  purchases: Purchase[]
): Purchase | null {
  if (!albumKey) {
    return null;
  }

  const dbAlbumId = album.dbAlbumId?.trim();
  return (
    purchases.find(
      (purchase) => purchase.albumId === albumKey || (dbAlbumId && purchase.albumId === dbAlbumId)
    ) ?? null
  );
}

/** Whether the signed-in viewer owns this album (account library). */
export function useAlbumOwnedByViewer(album: IAlbums, enabled: boolean) {
  const albumKey = getAlbumKeyForPaymentApis(album);
  const sessionKey = useSyncExternalStore(
    subscribeAuthSession,
    getAuthSessionIdentityKey,
    () => ''
  );
  void sessionKey;

  const userId = getUser()?.id;
  const [isOwned, setIsOwned] = useState(false);
  const [ownedPurchase, setOwnedPurchase] = useState<Purchase | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || !albumKey || !userId || !isAuthenticated()) {
      setIsOwned(false);
      setOwnedPurchase(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void loadPurchasesForUser(userId)
      .then((purchases) => {
        if (cancelled) {
          return;
        }
        const purchase = findOwnedPurchase(album, albumKey, purchases);
        setIsOwned(purchase !== null);
        setOwnedPurchase(purchase);
      })
      .catch(() => {
        if (!cancelled) {
          setIsOwned(false);
          setOwnedPurchase(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [album, albumKey, enabled, userId, sessionKey]);

  return { isOwned, ownedPurchase, loading };
}
