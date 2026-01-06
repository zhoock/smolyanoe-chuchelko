/**
 * API функции для работы с покупками
 */

export interface PurchaseTrack {
  trackId: string;
  title: string;
}

export interface Purchase {
  id: string;
  orderId: string;
  albumId: string;
  artist: string;
  album: string;
  cover: string | null;
  purchaseToken: string;
  purchasedAt: string;
  downloadCount: number;
  tracks: PurchaseTrack[];
}

export interface GetMyPurchasesResponse {
  success: boolean;
  purchases?: Purchase[];
  error?: string;
}

/**
 * Получить список покупок покупателя по email
 */
export async function getMyPurchases(email: string): Promise<Purchase[]> {
  const response = await fetch(`/api/get-my-purchases?email=${encodeURIComponent(email)}`);

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as GetMyPurchasesResponse;
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }

  const data = (await response.json()) as GetMyPurchasesResponse;

  if (!data.success || !data.purchases) {
    throw new Error(data.error || 'Failed to get purchases');
  }

  return data.purchases;
}

/**
 * Получить URL для скачивания трека
 */
export function getTrackDownloadUrl(purchaseToken: string, trackId: string): string {
  return `/api/download?token=${encodeURIComponent(purchaseToken)}&track=${encodeURIComponent(trackId)}`;
}
