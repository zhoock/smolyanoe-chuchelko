// src/pages/UserDashboard/UserDashboardV2.tsx
/**
 * Новая версия личного кабинета с обновлённым дизайном
 * Двухколоночный layout: профиль слева, контент справа
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useLang } from '@app/providers/lang';
import { Popup } from '@shared/ui/popup';
import { Hamburger } from '@shared/ui/hamburger';
import { isAuthenticated, getUser, logout } from '@shared/lib/auth';
import {
  DashboardAlbumEditor,
  DashboardSyncEditor,
  DashboardTextEditor,
  DashboardAlbumBuilder,
} from '@widgets/dashboardEditors';
import { ProfileSection } from './components/ProfileSection';
import { AlbumsSection } from './components/AlbumsSection';
import { PostsSection } from './components/PostsSection';
import './UserDashboardV2.style.scss';

type DashboardSection = 'albums' | 'posts';

export function UserDashboardV2() {
  const { lang } = useLang();
  const location = useLocation();
  const navigate = useNavigate();

  // Состояние для выбранного альбома
  const [selectedAlbumId, setSelectedAlbumId] = useState<string | null>(null);

  // Состояние для выбранного трека (синхронизация или редактирование текста)
  const [selectedTrack, setSelectedTrack] = useState<{
    albumId: string;
    trackId: string;
    type: 'sync' | 'text';
  } | null>(null);

  // Состояние для открытия builder (создание нового альбома)
  const [isBuilderOpen, setIsBuilderOpen] = useState<boolean>(false);

  // Активная секция (albums или posts)
  const [activeSection, setActiveSection] = useState<DashboardSection>('albums');

  const isUserAuthenticated = isAuthenticated();
  const user = getUser();
  const userId = user?.id || null;

  // Проверяем авторизацию
  useEffect(() => {
    if (!isUserAuthenticated) {
      navigate('/auth', { replace: true });
      return;
    }
  }, [navigate, isUserAuthenticated]);

  const handleBack = () => {
    if (isBuilderOpen) {
      setIsBuilderOpen(false);
    } else if (selectedTrack) {
      const albumId = selectedTrack.albumId;
      setSelectedTrack(null);
      if (albumId) {
        setSelectedAlbumId(albumId);
      }
    } else if (selectedAlbumId) {
      setSelectedAlbumId(null);
    }
  };

  const handleAlbumSelect = (albumId: string) => {
    setSelectedAlbumId(albumId);
    setSelectedTrack(null);
    setIsBuilderOpen(false);
  };

  const handleTrackSelect = (albumId: string, trackId: string, type: 'sync' | 'text') => {
    setSelectedTrack({ albumId, trackId, type });
  };

  const handleBuilderOpen = () => {
    setIsBuilderOpen(true);
    setSelectedAlbumId(null);
    setSelectedTrack(null);
  };

  const isDetailViewOpen = selectedAlbumId !== null || selectedTrack !== null || isBuilderOpen;

  if (!isUserAuthenticated || !userId) {
    return null;
  }

  const renderContent = () => {
    // Если открыт builder, показываем DashboardAlbumBuilder
    if (isBuilderOpen) {
      return <DashboardAlbumBuilder userId={userId} onBack={handleBack} />;
    }

    // Если открыта синхронизация или редактирование текста
    if (selectedTrack) {
      if (selectedTrack.type === 'sync') {
        return (
          <DashboardSyncEditor
            userId={userId}
            albumId={selectedTrack.albumId}
            trackId={selectedTrack.trackId}
          />
        );
      } else if (selectedTrack.type === 'text') {
        return (
          <DashboardTextEditor
            userId={userId}
            albumId={selectedTrack.albumId}
            trackId={selectedTrack.trackId}
            onSyncOpen={(albumId, trackId) => {
              setSelectedTrack({ albumId, trackId, type: 'sync' });
            }}
          />
        );
      }
    }

    // Если открыт альбом, показываем DashboardAlbumEditor
    if (selectedAlbumId) {
      return (
        <DashboardAlbumEditor
          userId={userId}
          albumId={selectedAlbumId}
          onTrackSelect={handleTrackSelect}
        />
      );
    }

    // Основной контент - секции albums или posts
    if (activeSection === 'albums') {
      return (
        <AlbumsSection
          userId={userId}
          onAlbumSelect={handleAlbumSelect}
          onBuilderOpen={handleBuilderOpen}
        />
      );
    }

    if (activeSection === 'posts') {
      return <PostsSection userId={userId} />;
    }

    return null;
  };

  return (
    <>
      <Helmet>
        <title>
          {lang === 'en' ? 'User Dashboard' : 'Кабинет пользователя'} — Смоляное Чучелко
        </title>
        <meta
          name="description"
          content={
            lang === 'en'
              ? 'Manage your albums, posts and profile'
              : 'Управляйте своими альбомами, статьями и профилем'
          }
        />
      </Helmet>

      <Popup isActive={true} onClose={() => navigate('/')}>
        <div className="user-dashboard-v2-wrapper">
          <div
            className={`user-dashboard-v2 ${isDetailViewOpen ? 'user-dashboard-v2--detail-open' : ''}`}
          >
            {/* Кнопки действий в header */}
            <div className="user-dashboard-v2__header-actions">
              <button
                type="button"
                className="user-dashboard-v2__switch-button"
                onClick={() => {
                  localStorage.removeItem('useNewDashboard');
                  window.location.reload();
                }}
                title={lang === 'en' ? 'Switch to old design' : 'Вернуться к старому дизайну'}
              >
                {lang === 'en' ? '← Old Design' : '← Старый дизайн'}
              </button>
              <button
                type="button"
                className="user-dashboard-v2__logout-button"
                onClick={() => {
                  logout();
                  navigate('/auth');
                }}
                title={lang === 'en' ? 'Logout' : 'Выйти'}
              >
                {lang === 'en' ? 'Logout' : 'Выйти'}
              </button>
              <Hamburger
                isActive={true}
                onToggle={() => navigate('/')}
                className="user-dashboard-v2__close"
              />
            </div>

            {/* Кнопка "Назад" - показывается только когда открыт альбом или синхронизация */}
            {isDetailViewOpen && (
              <button
                type="button"
                className="user-dashboard-v2__back-button"
                onClick={handleBack}
                aria-label={
                  selectedTrack
                    ? lang === 'en'
                      ? 'Back to album'
                      : 'Назад к альбому'
                    : lang === 'en'
                      ? 'Back to albums'
                      : 'Назад к альбомам'
                }
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
                <span>{lang === 'en' ? 'Back' : 'Назад'}</span>
              </button>
            )}

            {/* Основной layout - двухколоночный когда не открыт detail view */}
            {!isDetailViewOpen ? (
              <>
                {/* Левая колонка - Профиль */}
                <aside className="user-dashboard-v2__sidebar">
                  <ProfileSection userId={userId} />
                </aside>

                {/* Правая колонка - Контент */}
                <main className="user-dashboard-v2__main">
                  {/* Навигация между секциями */}
                  <nav className="user-dashboard-v2__section-nav" aria-label="Dashboard sections">
                    <button
                      type="button"
                      className={`user-dashboard-v2__section-button ${activeSection === 'albums' ? 'user-dashboard-v2__section-button--active' : ''}`}
                      onClick={() => setActiveSection('albums')}
                      aria-current={activeSection === 'albums' ? 'page' : undefined}
                    >
                      Albums
                    </button>
                    <button
                      type="button"
                      className={`user-dashboard-v2__section-button ${activeSection === 'posts' ? 'user-dashboard-v2__section-button--active' : ''}`}
                      onClick={() => setActiveSection('posts')}
                      aria-current={activeSection === 'posts' ? 'page' : undefined}
                    >
                      Posts
                    </button>
                  </nav>

                  {/* Контент секции */}
                  <div className="user-dashboard-v2__content">{renderContent()}</div>
                </main>
              </>
            ) : (
              /* Полноэкранный режим для detail view */
              <div className="user-dashboard-v2__detail">{renderContent()}</div>
            )}
          </div>
        </div>
      </Popup>
    </>
  );
}

export default UserDashboardV2;
