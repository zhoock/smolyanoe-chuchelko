// src/pages/UserDashboard/components/MyPurchasesContent.tsx
import React, { useEffect, useState } from 'react';
import { useLang } from '@app/providers/lang';
import { useAppSelector } from '@shared/lib/hooks/useAppSelector';
import { selectUiDictionaryFirst } from '@shared/model/uiDictionary';
import {
  getMyPurchases,
  getTrackDownloadUrl,
  getAlbumDownloadUrl,
  type Purchase,
} from '@shared/api/purchases';
import { getUserImageUrl } from '@shared/api/albums';
import '../UserDashboard.style.scss';

interface MyPurchasesContentProps {
  userEmail?: string;
}

export function MyPurchasesContent({ userEmail }: MyPurchasesContentProps) {
  const { lang } = useLang();
  const ui = useAppSelector((state) => selectUiDictionaryFirst(state, lang));
  const [email, setEmail] = useState(userEmail || '');
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(!!userEmail);
  // Состояния загрузки для каждого трека и альбома
  const [downloadingTracks, setDownloadingTracks] = useState<Set<string>>(new Set());
  const [downloadingAlbums, setDownloadingAlbums] = useState<Set<string>>(new Set());
  const [downloadedItems, setDownloadedItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (userEmail) {
      setEmail(userEmail);
      fetchPurchases(userEmail);
    }
  }, [userEmail]);

  const fetchPurchases = async (emailToFetch: string) => {
    setLoading(true);
    setError(null);

    try {
      const data = await getMyPurchases(emailToFetch);
      setPurchases(data);
      setSubmitted(true);
    } catch (err) {
      console.error('Error fetching purchases:', err);
      setError(
        err instanceof Error
          ? err.message
          : (ui?.dashboard?.myPurchases?.purchasesNotFound ?? 'Failed to load purchases')
      );
      setPurchases([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError(ui?.dashboard?.myPurchases?.emailAddress ?? 'Please enter your email address');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError(ui?.dashboard?.myPurchases?.checkEmail ?? 'Please enter a valid email address');
      return;
    }

    fetchPurchases(email.trim());
  };

  const handleDownloadTrack = async (purchaseToken: string, trackId: string) => {
    const downloadKey = `${purchaseToken}-${trackId}`;

    // Если уже скачивается, не делаем ничего
    if (downloadingTracks.has(downloadKey)) {
      return;
    }

    try {
      setDownloadingTracks((prev) => new Set(prev).add(downloadKey));
      setDownloadedItems((prev) => {
        const next = new Set(prev);
        next.delete(downloadKey);
        return next;
      });

      const url = getTrackDownloadUrl(purchaseToken, trackId);
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to download: ${response.statusText}`);
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);

      // Получаем имя файла из заголовка Content-Disposition или используем дефолтное
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `track-${trackId}.wav`;
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename\*=UTF-8''(.+)/);
        if (filenameMatch) {
          filename = decodeURIComponent(filenameMatch[1]);
        } else {
          const filenameMatch2 = contentDisposition.match(/filename="(.+)"/);
          if (filenameMatch2) {
            filename = filenameMatch2[1];
          }
        }
      }

      // Создаем временный элемент <a> для скачивания
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Освобождаем URL
      window.URL.revokeObjectURL(downloadUrl);

      // Показываем состояние "Скачано" на 2 секунды
      setDownloadedItems((prev) => new Set(prev).add(downloadKey));
      setTimeout(() => {
        setDownloadedItems((prev) => {
          const next = new Set(prev);
          next.delete(downloadKey);
          return next;
        });
      }, 2000);
    } catch (err) {
      console.error('Error downloading track:', err);
      alert(
        ui?.dashboard?.myPurchases?.errorDownloadingTrack ??
          'Error downloading track. Please try again.'
      );
    } finally {
      setDownloadingTracks((prev) => {
        const next = new Set(prev);
        next.delete(downloadKey);
        return next;
      });
    }
  };

  const handleDownloadAlbum = async (purchaseToken: string) => {
    // Если уже скачивается, не делаем ничего
    if (downloadingAlbums.has(purchaseToken)) {
      return;
    }

    try {
      setDownloadingAlbums((prev) => new Set(prev).add(purchaseToken));
      setDownloadedItems((prev) => {
        const next = new Set(prev);
        next.delete(`album-${purchaseToken}`);
        return next;
      });

      const url = getAlbumDownloadUrl(purchaseToken);
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to download: ${response.statusText}`);
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);

      // Получаем имя файла из заголовка Content-Disposition или используем дефолтное
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'album.zip';
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename\*=UTF-8''(.+)/);
        if (filenameMatch) {
          filename = decodeURIComponent(filenameMatch[1]);
        } else {
          const filenameMatch2 = contentDisposition.match(/filename="(.+)"/);
          if (filenameMatch2) {
            filename = filenameMatch2[1];
          }
        }
      }

      // Создаем временный элемент <a> для скачивания
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Освобождаем URL
      window.URL.revokeObjectURL(downloadUrl);

      // Показываем состояние "Скачано" на 2 секунды
      setDownloadedItems((prev) => new Set(prev).add(`album-${purchaseToken}`));
      setTimeout(() => {
        setDownloadedItems((prev) => {
          const next = new Set(prev);
          next.delete(`album-${purchaseToken}`);
          return next;
        });
      }, 2000);
    } catch (err) {
      console.error('Error downloading album:', err);
      alert(
        ui?.dashboard?.myPurchases?.errorDownloadingAlbum ??
          'Error downloading album. Please try again.'
      );
    } finally {
      setDownloadingAlbums((prev) => {
        const next = new Set(prev);
        next.delete(purchaseToken);
        return next;
      });
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="user-dashboard__my-purchases">
      <h3 className="user-dashboard__section-title">
        {ui?.dashboard?.myPurchases?.title ?? 'My Purchases'}
      </h3>

      {!submitted ? (
        <div className="user-dashboard__my-purchases-form">
          <p className="user-dashboard__my-purchases-description">
            {ui?.dashboard?.myPurchases?.enterEmailDescription ??
              'Enter the email you used when purchasing to view all your purchases and download tracks.'}
          </p>

          <form className="user-dashboard__my-purchases-form-inner" onSubmit={handleSubmit}>
            <div className="user-dashboard__my-purchases-form-group">
              <label htmlFor="purchase-email" className="user-dashboard__my-purchases-label">
                {ui?.dashboard?.myPurchases?.emailAddress ?? 'Email address'}
              </label>
              <input
                type="email"
                id="purchase-email"
                className="user-dashboard__my-purchases-input"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError(null);
                }}
                placeholder="your@email.com"
                required
              />
            </div>

            {error && <div className="user-dashboard__my-purchases-error">{error}</div>}

            <button
              type="submit"
              className="user-dashboard__my-purchases-submit"
              disabled={loading}
            >
              {loading
                ? (ui?.dashboard?.loading ?? 'Loading...')
                : (ui?.dashboard?.myPurchases?.viewPurchases ?? 'View purchases')}
            </button>
          </form>
        </div>
      ) : (
        <>
          <div className="user-dashboard__my-purchases-email-info">
            <p>
              {ui?.dashboard?.myPurchases?.purchasesFor ?? 'Purchases for:'}{' '}
              <strong>{email}</strong>
            </p>
            <button
              className="user-dashboard__my-purchases-change-email"
              onClick={() => {
                setSubmitted(false);
                setEmail(userEmail || '');
                setPurchases([]);
              }}
            >
              {ui?.dashboard?.myPurchases?.changeEmail ?? 'Change Email'}
            </button>
          </div>

          {loading && (
            <div className="user-dashboard__my-purchases-loading">
              {ui?.dashboard?.myPurchases?.loadingPurchases ?? 'Loading purchases...'}
            </div>
          )}

          {error && <div className="user-dashboard__my-purchases-error">{error}</div>}

          {!loading && !error && purchases.length === 0 && (
            <div className="user-dashboard__my-purchases-empty">
              <p>{ui?.dashboard?.myPurchases?.purchasesNotFound ?? 'Purchases not found.'}</p>
              <p>
                {ui?.dashboard?.myPurchases?.checkEmail ??
                  'Make sure you entered the correct email address.'}
              </p>
            </div>
          )}

          {!loading && !error && purchases.length > 0 && (
            <div className="user-dashboard__my-purchases-list">
              {purchases.map((purchase) => (
                <div key={purchase.id} className="user-dashboard__my-purchases-purchase">
                  <div className="user-dashboard__my-purchases-purchase-header">
                    {purchase.cover && (
                      <div className="user-dashboard__my-purchases-purchase-cover">
                        <img
                          src={getUserImageUrl(purchase.cover, 'albums', '.jpg', true)}
                          alt={`${purchase.artist} — ${purchase.album}`}
                          className="user-dashboard__my-purchases-purchase-cover-image"
                        />
                      </div>
                    )}
                    <div className="user-dashboard__my-purchases-purchase-info">
                      <h4 className="user-dashboard__my-purchases-purchase-title">
                        {purchase.artist} — {purchase.album}
                      </h4>
                      <p className="user-dashboard__my-purchases-purchase-date">
                        {ui?.dashboard?.myPurchases?.purchased ?? 'Purchased:'}{' '}
                        {formatDate(purchase.purchasedAt)}
                      </p>
                      {purchase.downloadCount > 0 && (
                        <p className="user-dashboard__my-purchases-purchase-downloads">
                          {ui?.dashboard?.myPurchases?.downloads ?? 'Downloads:'}{' '}
                          {purchase.downloadCount}
                        </p>
                      )}
                    </div>
                    <button
                      className="user-dashboard__my-purchases-album-download"
                      onClick={() => handleDownloadAlbum(purchase.purchaseToken)}
                      title={ui?.dashboard?.myPurchases?.downloadFullAlbum ?? 'Download full album'}
                      disabled={downloadingAlbums.has(purchase.purchaseToken)}
                    >
                      {downloadingAlbums.has(purchase.purchaseToken) ? (
                        <>
                          <span className="user-dashboard__download-spinner"></span>
                          {ui?.dashboard?.myPurchases?.downloading ?? 'Downloading...'}
                        </>
                      ) : downloadedItems.has(`album-${purchase.purchaseToken}`) ? (
                        (ui?.dashboard?.myPurchases?.downloaded ?? 'Downloaded')
                      ) : (
                        (ui?.dashboard?.myPurchases?.downloadAlbum ?? 'Download Album')
                      )}
                    </button>
                  </div>

                  <div className="user-dashboard__my-purchases-tracks">
                    <h5 className="user-dashboard__my-purchases-tracks-title">
                      {ui?.dashboard?.myPurchases?.tracks ?? 'Tracks:'}
                    </h5>
                    <ul className="user-dashboard__my-purchases-tracks-list">
                      {purchase.tracks.map((track, index) => (
                        <li key={track.trackId} className="user-dashboard__my-purchases-track">
                          <span className="user-dashboard__my-purchases-track-number">
                            {index + 1}.
                          </span>
                          <span className="user-dashboard__my-purchases-track-title">
                            {track.title}
                          </span>
                          <button
                            className="user-dashboard__my-purchases-track-download"
                            onClick={() =>
                              handleDownloadTrack(purchase.purchaseToken, track.trackId)
                            }
                            title={ui?.dashboard?.myPurchases?.downloadTrack ?? 'Download track'}
                            disabled={downloadingTracks.has(
                              `${purchase.purchaseToken}-${track.trackId}`
                            )}
                          >
                            {downloadingTracks.has(`${purchase.purchaseToken}-${track.trackId}`) ? (
                              <>
                                <span className="user-dashboard__download-spinner"></span>
                                {ui?.dashboard?.myPurchases?.downloading ?? 'Downloading...'}
                              </>
                            ) : downloadedItems.has(
                                `${purchase.purchaseToken}-${track.trackId}`
                              ) ? (
                              (ui?.dashboard?.myPurchases?.downloaded ?? 'Downloaded')
                            ) : (
                              (ui?.dashboard?.myPurchases?.download ?? 'Download')
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
