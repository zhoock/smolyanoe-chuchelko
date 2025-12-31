// src/pages/UserDashboard/components/MyPurchasesContent.tsx
import React, { useEffect, useState } from 'react';
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
      setError(err instanceof Error ? err.message : 'Failed to load purchases');
      setPurchases([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError('Please enter a valid email address');
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
      alert('Ошибка при скачивании трека. Попробуйте еще раз.');
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
      alert('Ошибка при скачивании альбома. Попробуйте еще раз.');
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
    return date.toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="user-dashboard__my-purchases">
      <h3 className="user-dashboard__section-title">Мои покупки</h3>

      {!submitted ? (
        <div className="user-dashboard__my-purchases-form">
          <p className="user-dashboard__my-purchases-description">
            Введите email, который вы использовали при покупке, чтобы просмотреть все ваши покупки и
            скачать треки.
          </p>

          <form className="user-dashboard__my-purchases-form-inner" onSubmit={handleSubmit}>
            <div className="user-dashboard__my-purchases-form-group">
              <label htmlFor="purchase-email" className="user-dashboard__my-purchases-label">
                Email адрес
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
              {loading ? 'Загрузка...' : 'Просмотреть покупки'}
            </button>
          </form>
        </div>
      ) : (
        <>
          <div className="user-dashboard__my-purchases-email-info">
            <p>
              Покупки для: <strong>{email}</strong>
            </p>
            <button
              className="user-dashboard__my-purchases-change-email"
              onClick={() => {
                setSubmitted(false);
                setEmail(userEmail || '');
                setPurchases([]);
              }}
            >
              Изменить email
            </button>
          </div>

          {loading && (
            <div className="user-dashboard__my-purchases-loading">Загрузка покупок...</div>
          )}

          {error && <div className="user-dashboard__my-purchases-error">{error}</div>}

          {!loading && !error && purchases.length === 0 && (
            <div className="user-dashboard__my-purchases-empty">
              <p>Покупки не найдены.</p>
              <p>Убедитесь, что вы ввели правильный email адрес.</p>
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
                        Куплено: {formatDate(purchase.purchasedAt)}
                      </p>
                      {purchase.downloadCount > 0 && (
                        <p className="user-dashboard__my-purchases-purchase-downloads">
                          Скачиваний: {purchase.downloadCount}
                        </p>
                      )}
                    </div>
                    <button
                      className="user-dashboard__my-purchases-album-download"
                      onClick={() => handleDownloadAlbum(purchase.purchaseToken)}
                      title="Скачать весь альбом"
                      disabled={downloadingAlbums.has(purchase.purchaseToken)}
                    >
                      {downloadingAlbums.has(purchase.purchaseToken) ? (
                        <>
                          <span className="user-dashboard__download-spinner"></span>
                          Скачивание...
                        </>
                      ) : downloadedItems.has(`album-${purchase.purchaseToken}`) ? (
                        'Скачано'
                      ) : (
                        'Скачать альбом'
                      )}
                    </button>
                  </div>

                  <div className="user-dashboard__my-purchases-tracks">
                    <h5 className="user-dashboard__my-purchases-tracks-title">Треки:</h5>
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
                            title="Скачать трек"
                            disabled={downloadingTracks.has(
                              `${purchase.purchaseToken}-${track.trackId}`
                            )}
                          >
                            {downloadingTracks.has(`${purchase.purchaseToken}-${track.trackId}`) ? (
                              <>
                                <span className="user-dashboard__download-spinner"></span>
                                Скачивание...
                              </>
                            ) : downloadedItems.has(
                                `${purchase.purchaseToken}-${track.trackId}`
                              ) ? (
                              'Скачано'
                            ) : (
                              'Скачать'
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
