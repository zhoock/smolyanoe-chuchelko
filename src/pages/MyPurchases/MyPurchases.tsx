// src/pages/MyPurchases/MyPurchases.tsx
import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { getMyPurchases, getTrackDownloadUrl, type Purchase } from '@shared/api/purchases';
import './MyPurchases.style.scss';

function MyPurchases() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const emailParam = searchParams.get('email');
  const [email, setEmail] = useState(emailParam || '');
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(!!emailParam);

  useEffect(() => {
    if (emailParam) {
      fetchPurchases(emailParam);
    }
  }, [emailParam]);

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

    navigate(`/my-purchases?email=${encodeURIComponent(email.trim())}`);
  };

  const handleDownloadTrack = (purchaseToken: string, trackId: string) => {
    const url = getTrackDownloadUrl(purchaseToken, trackId);
    window.open(url, '_blank');
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
    <>
      <Helmet>
        <title>Мои покупки — Смоляное чучелко</title>
        <meta name="description" content="Просмотр и скачивание купленных альбомов" />
      </Helmet>

      <div className="my-purchases">
        <div className="my-purchases__container">
          <h1 className="my-purchases__title">Мои покупки</h1>

          {!submitted ? (
            <div className="my-purchases__form-container">
              <p className="my-purchases__description">
                Введите email, который вы использовали при покупке, чтобы просмотреть все ваши
                покупки и скачать треки.
              </p>

              <form className="my-purchases__form" onSubmit={handleSubmit}>
                <div className="my-purchases__form-group">
                  <label htmlFor="email" className="my-purchases__label">
                    Email адрес
                  </label>
                  <input
                    type="email"
                    id="email"
                    className="my-purchases__input"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setError(null);
                    }}
                    placeholder="your@email.com"
                    required
                  />
                </div>

                {error && <div className="my-purchases__error">{error}</div>}

                <button type="submit" className="my-purchases__submit" disabled={loading}>
                  {loading ? 'Загрузка...' : 'Просмотреть покупки'}
                </button>
              </form>
            </div>
          ) : (
            <>
              <div className="my-purchases__email-info">
                <p>
                  Покупки для: <strong>{emailParam}</strong>
                </p>
                <button
                  className="my-purchases__change-email"
                  onClick={() => {
                    setSubmitted(false);
                    setEmail('');
                    setPurchases([]);
                    navigate('/my-purchases');
                  }}
                >
                  Изменить email
                </button>
              </div>

              {loading && <div className="my-purchases__loading">Загрузка покупок...</div>}

              {error && <div className="my-purchases__error">{error}</div>}

              {!loading && !error && purchases.length === 0 && (
                <div className="my-purchases__empty">
                  <p>Покупки не найдены.</p>
                  <p>Убедитесь, что вы ввели правильный email адрес.</p>
                </div>
              )}

              {!loading && !error && purchases.length > 0 && (
                <div className="my-purchases__list">
                  {purchases.map((purchase) => (
                    <div key={purchase.id} className="my-purchases__purchase">
                      <div className="my-purchases__purchase-header">
                        <div className="my-purchases__purchase-info">
                          <h2 className="my-purchases__purchase-title">
                            {purchase.artist} — {purchase.album}
                          </h2>
                          <p className="my-purchases__purchase-date">
                            Куплено: {formatDate(purchase.purchasedAt)}
                          </p>
                          {purchase.downloadCount > 0 && (
                            <p className="my-purchases__purchase-downloads">
                              Скачиваний: {purchase.downloadCount}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="my-purchases__tracks">
                        <h3 className="my-purchases__tracks-title">Треки:</h3>
                        <ul className="my-purchases__tracks-list">
                          {purchase.tracks.map((track, index) => (
                            <li key={track.trackId} className="my-purchases__track">
                              <span className="my-purchases__track-number">{index + 1}.</span>
                              <span className="my-purchases__track-title">{track.title}</span>
                              <button
                                className="my-purchases__track-download"
                                onClick={() =>
                                  handleDownloadTrack(purchase.purchaseToken, track.trackId)
                                }
                                title="Скачать трек"
                              >
                                ⬇️ Скачать
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
      </div>
    </>
  );
}

export default MyPurchases;
