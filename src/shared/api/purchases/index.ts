/**
 * API functions for purchases (account-owned library).
 */

import { getAuthHeader } from '@shared/lib/auth';
import { fetchWithAuthSession } from '@shared/lib/authFetch';

export interface PurchaseTrack {
  trackId: string;
  title: string;
}

export interface Purchase {
  id: string;
  orderId: string;
  albumId: string;
  /** Album owner in Storage (cover in user bucket) */
  albumUserId?: string | null;
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

interface ApiMessageResponse {
  success?: boolean;
  error?: string;
  message?: string;
}

async function parsePurchasesResponse(response: Response): Promise<Purchase[]> {
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

/** Load purchases for the authenticated account. */
export async function getMyPurchases(): Promise<Purchase[]> {
  const response = await fetchWithAuthSession('/api/my-purchases', {
    headers: {
      ...getAuthHeader(),
    },
  });
  return parsePurchasesResponse(response);
}

/** Soft-revoke a purchase from the authenticated library. */
export async function revokePurchase(purchaseId: string): Promise<void> {
  const response = await fetchWithAuthSession(
    `/api/my-purchases?purchaseId=${encodeURIComponent(purchaseId)}`,
    {
      method: 'DELETE',
      headers: {
        ...getAuthHeader(),
      },
    }
  );

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as ApiMessageResponse;
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }
}

/** Download URL for a track by purchase token */
export function getTrackDownloadUrl(purchaseToken: string, trackId: string): string {
  return `/api/download?token=${encodeURIComponent(purchaseToken)}&track=${encodeURIComponent(trackId)}`;
}

function buildAlbumZipFileName(artist: string, album: string): string {
  const slug = (value: string) =>
    value
      .trim()
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

  const artistPart = slug(artist) || 'artist';
  const albumPart = slug(album) || 'album';
  return `${artistPart}-${albumPart}.zip`;
}

function buildZipEntryFileName(
  orderIndex: number,
  trackId: string,
  title: string,
  ext: string
): string {
  const safeTitle = title
    .trim()
    .replace(/[^\w\s.-]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 80);
  const index = String(orderIndex + 1).padStart(2, '0');
  return `${index}-${safeTitle || trackId}${ext}`;
}

function guessExtensionFromResponse(response: Response, fallback = '.mp3'): string {
  const disposition = response.headers.get('Content-Disposition');
  if (disposition) {
    const match = disposition.match(/filename\*=UTF-8''(.+)|filename="(.+)"/i);
    const raw = match?.[1] || match?.[2];
    if (raw) {
      const name = decodeURIComponent(raw);
      const dot = name.lastIndexOf('.');
      if (dot >= 0) {
        return name.slice(dot);
      }
    }
  }

  const type = response.headers.get('Content-Type')?.toLowerCase() ?? '';
  if (type.includes('wav')) return '.wav';
  if (type.includes('mpeg') || type.includes('mp3')) return '.mp3';
  if (type.includes('flac')) return '.flac';
  return fallback;
}

/** Download full album as zip via per-track entitlement-checked downloads. */
export async function downloadAlbumZip(purchase: Purchase): Promise<{
  blob: Blob;
  filename: string;
}> {
  if (purchase.tracks.length === 0) {
    throw new Error('No tracks available for download');
  }

  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();

  for (let index = 0; index < purchase.tracks.length; index += 1) {
    const track = purchase.tracks[index];
    const response = await fetch(getTrackDownloadUrl(purchase.purchaseToken, track.trackId));

    if (!response.ok) {
      throw new Error(`Failed to download track: ${track.title}`);
    }

    const blob = await response.blob();
    const ext = guessExtensionFromResponse(response);
    zip.file(buildZipEntryFileName(index, track.trackId, track.title, ext), blob);
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  return {
    blob,
    filename: buildAlbumZipFileName(purchase.artist, purchase.album),
  };
}

/** Session download: allowed when album was purchased or subscription is active (backend). */
export function getTrackDownloadUrlForAlbumWithAuth(albumId: string, trackId: string): string {
  return `/api/download?albumId=${encodeURIComponent(albumId)}&track=${encodeURIComponent(trackId)}`;
}
