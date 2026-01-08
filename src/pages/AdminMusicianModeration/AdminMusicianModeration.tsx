/**
 * Админ-страница для модерации заявок музыкантов
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getToken, getUser, isAuthenticated } from '@shared/lib/auth';
import { loadUserProfile } from '@entities/user/lib/loadUserProfile';
import { isAdmin } from '@shared/types/user';
import './AdminMusicianModeration.style.scss';

interface PendingApplication {
  id: string;
  email: string;
  name: string | null;
  artistName: string | null;
  bio: string | null;
  links: string[] | null;
  musicianAppliedAt: string | null;
}

export function AdminMusicianModeration() {
  const [applications, setApplications] = useState<PendingApplication[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<{ [userId: string]: string }>({});
  const [isProcessing, setIsProcessing] = useState<{ [userId: string]: boolean }>({});
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const navigate = useNavigate();

  const user = getUser();

  // Функция загрузки заявок
  const loadApplications = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const token = getToken();
      if (!token) {
        throw new Error('Необходима авторизация');
      }

      const response = await fetch('/api/admin/musician/pending', {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Ошибка при загрузке заявок');
      }

      // Убеждаемся, что data - это массив
      const applicationsData = result.data;
      if (Array.isArray(applicationsData)) {
        setApplications(applicationsData);
      } else {
        console.warn('[AdminMusicianModeration] API returned non-array data:', applicationsData);
        setApplications([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при загрузке заявок');
    } finally {
      setIsLoading(false);
    }
  };

  // Проверяем авторизацию и права админа
  useEffect(() => {
    const checkAdminAccess = async () => {
      if (!isAuthenticated()) {
        console.log('[AdminMusicianModeration] User not authenticated, redirecting to /auth');
        // Сохраняем текущий путь для возврата после входа
        const returnTo = window.location.pathname + window.location.search;
        navigate(`/auth?returnTo=${encodeURIComponent(returnTo)}`, { replace: true });
        return;
      }

      console.log('[AdminMusicianModeration] User authenticated, checking admin status...');

      try {
        const userProfile = await loadUserProfile();
        console.log('[AdminMusicianModeration] User profile loaded:', {
          email: userProfile?.email,
          role: userProfile?.role,
          isAdmin: userProfile ? isAdmin(userProfile) : false,
        });

        if (!userProfile || !isAdmin(userProfile)) {
          const errorMsg = !userProfile
            ? 'Не удалось загрузить профиль пользователя'
            : `Доступ запрещен. Требуются права администратора. Текущая роль: ${userProfile.role}`;
          console.warn('[AdminMusicianModeration] Access denied:', errorMsg);
          setError(errorMsg);
          setIsCheckingAuth(false);
          setIsLoading(false);
          return;
        }

        console.log('[AdminMusicianModeration] Admin access confirmed, loading applications...');
        setIsCheckingAuth(false);
        loadApplications();
      } catch (err) {
        console.error('[AdminMusicianModeration] Error checking admin access:', err);
        setError(
          `Ошибка при проверке прав доступа: ${err instanceof Error ? err.message : 'Неизвестная ошибка'}`
        );
        setIsCheckingAuth(false);
        setIsLoading(false);
        return;
      }
    };

    checkAdminAccess();
  }, [navigate]);

  const handleApprove = async (userId: string) => {
    setIsProcessing((prev) => ({ ...prev, [userId]: true }));

    try {
      const token = getToken();
      if (!token) {
        throw new Error('Необходима авторизация');
      }

      const response = await fetch('/api/admin/musician/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Ошибка при одобрении заявки');
      }

      // Удаляем заявку из списка
      setApplications((prev) => prev.filter((app) => app.id !== userId));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Ошибка при одобрении заявки');
    } finally {
      setIsProcessing((prev) => ({ ...prev, [userId]: false }));
    }
  };

  const handleReject = async (userId: string) => {
    const reason = rejectReason[userId]?.trim();
    if (!reason) {
      alert('Укажите причину отклонения');
      return;
    }

    setIsProcessing((prev) => ({ ...prev, [userId]: true }));

    try {
      const token = getToken();
      if (!token) {
        throw new Error('Необходима авторизация');
      }

      const response = await fetch('/api/admin/musician/reject', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId, reason }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Ошибка при отклонении заявки');
      }

      // Удаляем заявку из списка
      setApplications((prev) => prev.filter((app) => app.id !== userId));
      setRejectReason((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Ошибка при отклонении заявки');
    } finally {
      setIsProcessing((prev) => ({ ...prev, [userId]: false }));
    }
  };

  // Показываем загрузку во время проверки прав доступа
  if (isCheckingAuth) {
    return (
      <div className="admin-musician-moderation">
        <div className="admin-musician-moderation__loading">Проверка прав доступа...</div>
      </div>
    );
  }

  // Проверка прав доступа (только для админов)
  if (!user || !isAuthenticated()) {
    return (
      <div className="admin-musician-moderation">
        <div className="admin-musician-moderation__error">
          Необходима авторизация для доступа к этой странице
        </div>
      </div>
    );
  }

  return (
    <div className="admin-musician-moderation">
      <div className="admin-musician-moderation__header">
        <h1 className="admin-musician-moderation__title">Модерация заявок музыкантов</h1>
        <button
          type="button"
          onClick={loadApplications}
          className="admin-musician-moderation__refresh"
          disabled={isLoading}
        >
          {isLoading ? 'Загрузка...' : 'Обновить'}
        </button>
      </div>

      {error && <div className="admin-musician-moderation__error">{error}</div>}

      {isLoading ? (
        <div className="admin-musician-moderation__loading">Загрузка заявок...</div>
      ) : !Array.isArray(applications) ? (
        <div className="admin-musician-moderation__error">
          Ошибка: некорректный формат данных заявок
        </div>
      ) : applications.length === 0 ? (
        <div className="admin-musician-moderation__empty">Нет заявок на рассмотрении</div>
      ) : (
        <div className="admin-musician-moderation__list">
          {applications.map((app) => (
            <div key={app.id} className="admin-musician-moderation__card">
              <div className="admin-musician-moderation__card-header">
                <h3 className="admin-musician-moderation__card-title">
                  {app.artistName || 'Без названия'}
                </h3>
                <div className="admin-musician-moderation__card-meta">
                  <div className="admin-musician-moderation__meta-item">
                    <strong>Email:</strong> {app.email}
                  </div>
                  {app.name && (
                    <div className="admin-musician-moderation__meta-item">
                      <strong>Имя:</strong> {app.name}
                    </div>
                  )}
                  {app.musicianAppliedAt && (
                    <div className="admin-musician-moderation__meta-item">
                      <strong>Дата подачи:</strong>{' '}
                      {new Date(app.musicianAppliedAt).toLocaleString('ru-RU')}
                    </div>
                  )}
                </div>
              </div>

              {app.bio && (
                <div className="admin-musician-moderation__card-section">
                  <strong>Биография:</strong>
                  <p className="admin-musician-moderation__bio">{app.bio}</p>
                </div>
              )}

              {app.links && app.links.length > 0 && (
                <div className="admin-musician-moderation__card-section">
                  <strong>Ссылки:</strong>
                  <ul className="admin-musician-moderation__links">
                    {app.links.map((link, index) => (
                      <li key={index}>
                        <a
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="admin-musician-moderation__link"
                        >
                          {link}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="admin-musician-moderation__card-actions">
                <div className="admin-musician-moderation__reject-section">
                  <label
                    htmlFor={`reject-reason-${app.id}`}
                    className="admin-musician-moderation__reject-label"
                  >
                    Причина отклонения:
                  </label>
                  <textarea
                    id={`reject-reason-${app.id}`}
                    value={rejectReason[app.id] || ''}
                    onChange={(e) =>
                      setRejectReason((prev) => ({ ...prev, [app.id]: e.target.value }))
                    }
                    className="admin-musician-moderation__reject-input"
                    placeholder="Укажите причину отклонения заявки"
                    rows={3}
                    disabled={isProcessing[app.id]}
                  />
                </div>
                <div className="admin-musician-moderation__buttons">
                  <button
                    type="button"
                    onClick={() => handleApprove(app.id)}
                    className="admin-musician-moderation__approve"
                    disabled={isProcessing[app.id]}
                  >
                    {isProcessing[app.id] ? 'Обработка...' : 'Одобрить'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReject(app.id)}
                    className="admin-musician-moderation__reject"
                    disabled={isProcessing[app.id] || !rejectReason[app.id]?.trim()}
                  >
                    {isProcessing[app.id] ? 'Обработка...' : 'Отклонить'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
