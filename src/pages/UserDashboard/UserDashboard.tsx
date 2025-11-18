import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useLang } from '@app/providers/lang';
import { Popup } from '@shared/ui/popup';
import { Hamburger } from '@shared/ui/hamburger';
import { PaymentSettings } from '@features/paymentSettings';
import { DashboardAlbumsRoot } from '@widgets/dashboardAlbums';
import {
  DashboardAlbumEditor,
  DashboardSyncEditor,
  DashboardTextEditor,
  DashboardAlbumBuilder,
} from '@widgets/dashboardEditors';
import { isAuthenticated, getUser, logout } from '@shared/lib/auth';
import './UserDashboard.style.scss';

type DashboardTab = 'albums' | 'payments' | string; // Расширяемый тип для будущих вкладок

interface TabConfig {
  id: DashboardTab;
  label: {
    en: string;
    ru: string;
  };
  icon: string;
  component?: React.ComponentType<{ userId?: string }> | React.ComponentType<{ userId: string }>;
}

export function UserDashboard() {
  const { lang } = useLang();
  const location = useLocation();
  const navigate = useNavigate();

  // Состояние для выбранного альбома (вместо роутинга)
  const [selectedAlbumId, setSelectedAlbumId] = useState<string | null>(null);

  // Состояние для выбранного трека (синхронизация или редактирование текста)
  const [selectedTrack, setSelectedTrack] = useState<{
    albumId: string;
    trackId: string;
    type: 'sync' | 'text';
  } | null>(null);

  // Состояние для открытия builder (создание нового альбома)
  const [isBuilderOpen, setIsBuilderOpen] = useState<boolean>(false);

  // Конфигурация вкладок - легко расширяется добавлением новых объектов
  const tabs: TabConfig[] = [
    {
      id: 'albums',
      label: {
        en: 'Albums',
        ru: 'Альбомы',
      },
      icon: '💿',
      component: DashboardAlbumsRoot,
    },
    {
      id: 'payments',
      label: {
        en: 'Payment Settings',
        ru: 'Настройки платежей',
      },
      icon: '💳',
      component: PaymentSettings,
    },
    // Добавьте здесь новые вкладки:
    // {
    //   id: 'profile',
    //   label: {
    //     en: 'Profile',
    //     ru: 'Профиль',
    //   },
    //   icon: '👤',
    //   component: ProfileSettings,
    // },
  ];

  const isUserAuthenticated = isAuthenticated();
  const user = getUser();
  const userId = user?.id || null;

  // Определяем активную вкладку из URL
  const getActiveTabFromPath = (path: string): DashboardTab => {
    // Проверяем точное совпадение с /dashboard/:tab
    const match = path.match(/^\/dashboard\/([^/]+)$/);
    if (match) {
      const tabId = match[1];
      if (tabs.some((tab) => tab.id === tabId)) {
        return tabId as DashboardTab;
      }
    }
    // Проверяем /dashboard/albums (может быть как таб, так и начало пути для альбомов)
    if (path === '/dashboard/albums') {
      return 'albums';
    }
    // По умолчанию показываем первую вкладку
    return tabs[0]?.id || 'albums';
  };

  const [activeTab, setActiveTab] = useState<DashboardTab>(() => {
    return getActiveTabFromPath(location.pathname);
  });

  // Проверяем авторизацию (после всех хуков)
  useEffect(() => {
    if (!isUserAuthenticated) {
      navigate('/auth', { replace: true });
      return;
    }
  }, [navigate, isUserAuthenticated]);

  // Редирект на первую вкладку если просто /dashboard
  useEffect(() => {
    if (location.pathname === '/dashboard') {
      const defaultTab = tabs[0]?.id || 'albums';
      navigate(`/dashboard/${defaultTab}`, { replace: true });
      return;
    }

    // Обновляем активную вкладку при изменении пути
    const newTab = getActiveTabFromPath(location.pathname);
    setActiveTab((prevTab) => {
      if (newTab !== prevTab) {
        return newTab;
      }
      return prevTab;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, navigate]);

  const handleTabChange = (tab: DashboardTab) => {
    setActiveTab(tab);
    navigate(`/dashboard/${tab}`);
  };

  const handleBack = () => {
    if (isBuilderOpen) {
      // Если открыт builder, возвращаемся к списку
      setIsBuilderOpen(false);
    } else if (selectedTrack) {
      // Если открыта синхронизация или редактирование текста, возвращаемся к альбому
      setSelectedTrack(null);
      if (selectedTrack.albumId) {
        setSelectedAlbumId(selectedTrack.albumId);
      }
    } else if (selectedAlbumId) {
      // Если открыт альбом, возвращаемся к списку
      setSelectedAlbumId(null);
    }
  };

  const handleAlbumSelect = (albumId: string) => {
    setSelectedAlbumId(albumId);
    setSelectedTrack(null); // Сбрасываем выбранный трек
    setIsBuilderOpen(false); // Закрываем builder если открыт
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

    const currentTab = tabs.find((tab) => tab.id === activeTab);

    if (!currentTab) {
      // Fallback на первую вкладку
      const defaultTab = tabs[0];
      if (defaultTab?.component) {
        const Component = defaultTab.component as React.ComponentType<{ userId?: string }>;
        return <Component userId={userId} />;
      }
      return null;
    }

    // Рендерим компонент текущей вкладки
    if (currentTab.component) {
      const Component = currentTab.component as React.ComponentType<{
        userId?: string;
        onAlbumSelect?: (albumId: string) => void;
        onBuilderOpen?: () => void;
      }>;
      // Передаём callback для выбора альбома и открытия builder только для вкладки albums
      if (currentTab.id === 'albums') {
        return (
          <Component
            userId={userId}
            onAlbumSelect={handleAlbumSelect}
            onBuilderOpen={handleBuilderOpen}
          />
        );
      }
      return <Component userId={userId} />;
    }

    // Если компонент не указан, показываем placeholder
    return (
      <div className="user-dashboard__content-placeholder">
        <h2>{currentTab.label[lang]}</h2>
        <p>
          {lang === 'en'
            ? 'This section is under development...'
            : 'Этот раздел находится в разработке...'}
        </p>
      </div>
    );
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
              ? 'Manage your account settings and payment methods'
              : 'Управляйте настройками аккаунта и способами оплаты'
          }
        />
      </Helmet>

      <Popup isActive={true} onClose={() => navigate('/')}>
        <div className="user-dashboard-wrapper">
          <div
            className={`user-dashboard ${isDetailViewOpen ? 'user-dashboard--detail-open' : ''}`}
          >
            <div className="user-dashboard__header-actions">
              <button
                type="button"
                className="user-dashboard__logout-button"
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
                className="user-dashboard__close"
              />
            </div>

            {/* Кнопка "Назад" - показывается только когда открыт альбом или синхронизация */}
            {isDetailViewOpen && (
              <button
                type="button"
                className="user-dashboard__back-button"
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

            {/* Навигация - скрывается когда открыт альбом или синхронизация */}
            {!isDetailViewOpen && (
              <nav
                className="user-dashboard__nav"
                aria-label={lang === 'en' ? 'Dashboard navigation' : 'Навигация кабинета'}
              >
                <ul className="user-dashboard__nav-list">
                  {tabs.map((tab) => (
                    <li key={tab.id} className="user-dashboard__nav-item">
                      <button
                        type="button"
                        className={`user-dashboard__nav-button ${activeTab === tab.id ? 'user-dashboard__nav-button--active' : ''}`}
                        onClick={() => handleTabChange(tab.id)}
                        aria-current={activeTab === tab.id ? 'page' : undefined}
                      >
                        <span className="user-dashboard__nav-icon" aria-hidden="true">
                          {tab.icon}
                        </span>
                        <span className="user-dashboard__nav-label">{tab.label[lang]}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </nav>
            )}

            <div className="user-dashboard__main">{renderContent()}</div>
          </div>
        </div>
      </Popup>
    </>
  );
}

export default UserDashboard;
