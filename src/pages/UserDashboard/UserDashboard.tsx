// src/pages/UserDashboard/UserDashboard.tsx
/**
 * Простая статическая верстка нового дизайна dashboard
 * БЕЗ логики - только верстка по макету в стиле ChatGPT popup
 */
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useLang } from '@app/providers/lang';
import { useAppSelector } from '@shared/lib/hooks/useAppSelector';
import { useAppDispatch } from '@shared/lib/hooks/useAppDispatch';
import { selectUiDictionaryFirst } from '@shared/model/uiDictionary';
import { getUserImageUrl } from '@shared/api/albums';
import { Popup } from '@shared/ui/popup';
import { Hamburger } from '@shared/ui/hamburger';
import { logout, isAuthenticated, getUser } from '@shared/lib/auth';
import {
  fetchAlbums,
  selectAlbumsStatus,
  selectAlbumsData,
  selectAlbumsError,
} from '@entities/album';
import { getTrackStatus } from '@widgets/dashboard/lib/trackStatus';
import { loadTrackTextFromDatabase, saveTrackText } from '@entities/track/lib';
import { loadAuthorshipFromStorage } from '@features/syncedLyrics/lib';
import { AddLyricsModal } from './components/AddLyricsModal';
import { EditLyricsModal } from './components/EditLyricsModal';
import { PreviewLyricsModal } from './components/PreviewLyricsModal';
import { EditAlbumModal, type AlbumFormData } from './components/EditAlbumModal';
import { SyncLyricsModal } from './components/SyncLyricsModal';
import { PaymentSettings } from '@features/paymentSettings/ui/PaymentSettings';
import type { IAlbums } from '@models';
import './UserDashboard.style.scss';

interface AlbumData {
  id: string;
  title: string;
  year: string;
  cover: string;
  releaseDate?: string;
  tracks: TrackData[];
}

interface TrackData {
  id: string;
  title: string;
  duration: string;
  lyricsStatus: 'synced' | 'text-only' | 'empty';
  lyricsText?: string;
  src?: string;
  authorship?: string;
  syncedLyrics?: { text: string; startTime: number; endTime?: number }[];
}

// Локальный кэш авторства (fallback, если API недоступен)
const AUTHORS_CACHE_KEY = 'authorship-cache-v1';

function getCachedAuthorship(albumId: string, trackId: string, lang: string): string | null {
  try {
    const raw = localStorage.getItem(AUTHORS_CACHE_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, string>;
    const key = `${albumId}:${trackId}:${lang}`;
    return map[key] ?? null;
  } catch {
    return null;
  }
}

function setCachedAuthorship(albumId: string, trackId: string, lang: string, authorship?: string) {
  try {
    const raw = localStorage.getItem(AUTHORS_CACHE_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    const key = `${albumId}:${trackId}:${lang}`;
    if (authorship && authorship.trim()) {
      map[key] = authorship.trim();
    } else {
      delete map[key];
    }
    localStorage.setItem(AUTHORS_CACHE_KEY, JSON.stringify(map));
  } catch {
    // игнорируем ошибки localStorage
  }
}

// Mock текст для редактирования
const MOCK_LYRICS_TEXT =
  "Venturing beyond the familiar\nThrough the void of space I soar\nCarried by stars' glow so peculiar\nFinding what I've never seen before";

const initialAlbumsData: AlbumData[] = [
  {
    id: '23-remastered',
    title: '23',
    year: '2023',
    cover: 'Tar-Baby-Cover-23-remastered',
    releaseDate: 'April 5, 2024',
    tracks: [
      {
        id: '1',
        title: 'Into the Unknown',
        duration: '3:45',
        lyricsStatus: 'synced',
        lyricsText: MOCK_LYRICS_TEXT,
      },
      {
        id: '2',
        title: "Journey's End",
        duration: '4:20',
        lyricsStatus: 'text-only',
        lyricsText: MOCK_LYRICS_TEXT,
      },
      {
        id: '3',
        title: 'Beyond the Stars',
        duration: '5:10',
        lyricsStatus: 'empty',
      },
    ],
  },
  {
    id: '23',
    title: '23',
    year: '2023',
    cover: 'Tar-Baby-Cover-23',
    tracks: [
      {
        id: '1',
        title: 'Track 1',
        duration: '3:00',
        lyricsStatus: 'empty',
      },
    ],
  },
  {
    id: 'tar-baby',
    title: 'Смоляное Чучелко',
    year: '2022',
    cover: 'Tar-Baby-Cover',
    tracks: [
      {
        id: '1',
        title: 'Track 1',
        duration: '3:00',
        lyricsStatus: 'empty',
      },
    ],
  },
];

function UserDashboard() {
  const { lang } = useLang();
  const dispatch = useAppDispatch();
  const ui = useAppSelector((state) => selectUiDictionaryFirst(state, lang));
  const navigate = useNavigate();
  const albumsStatus = useAppSelector((state) => selectAlbumsStatus(state, lang));
  const albumsError = useAppSelector((state) => selectAlbumsError(state, lang));
  const albumsFromStore = useAppSelector((state) => selectAlbumsData(state, lang));
  const user = getUser();

  const [activeTab, setActiveTab] = useState<'albums' | 'posts' | 'payment-settings'>('albums');
  const [expandedAlbumId, setExpandedAlbumId] = useState<string | null>(null);
  const [albumsData, setAlbumsData] = useState<AlbumData[]>([]);
  const [isLoadingTracks, setIsLoadingTracks] = useState<boolean>(false);
  const fileInputRefs = useRef<{ [albumId: string]: HTMLInputElement | null }>({});
  const [addLyricsModal, setAddLyricsModal] = useState<{
    isOpen: boolean;
    albumId: string;
    trackId: string;
    trackTitle: string;
  } | null>(null);
  const [editLyricsModal, setEditLyricsModal] = useState<{
    isOpen: boolean;
    albumId: string;
    trackId: string;
    trackTitle: string;
    trackStatus: TrackData['lyricsStatus'];
    initialAuthorship?: string;
  } | null>(null);
  const [previewLyricsModal, setPreviewLyricsModal] = useState<{
    isOpen: boolean;
    lyrics: string;
    syncedLyrics?: { text: string; startTime: number; endTime?: number }[];
    authorship?: string;
  } | null>(null);
  const [syncLyricsModal, setSyncLyricsModal] = useState<{
    isOpen: boolean;
    albumId: string;
    trackId: string;
    trackTitle: string;
    trackSrc?: string;
    lyricsText?: string;
    authorship?: string;
  } | null>(null);
  const [editAlbumModal, setEditAlbumModal] = useState<{
    isOpen: boolean;
    albumId: string;
  } | null>(null);

  // Проверка авторизации
  useEffect(() => {
    if (!isAuthenticated()) {
      navigate('/auth', { replace: true });
    }
  }, [navigate]);

  // Загрузка альбомов
  useEffect(() => {
    if (albumsStatus === 'idle' || albumsStatus === 'failed') {
      console.log('🔄 Starting albums fetch, status:', albumsStatus);
      dispatch(fetchAlbums({ lang })).catch((error) => {
        console.error('❌ Error fetching albums:', error);
      });
    }
  }, [dispatch, lang, albumsStatus]);

  // Преобразование данных из IAlbums[] в AlbumData[] и загрузка статусов треков
  useEffect(() => {
    console.log('📊 Albums data check:', {
      albumsFromStore: albumsFromStore?.length || 0,
      albumsStatus,
      isLoadingTracks,
    });

    if (!albumsFromStore || albumsFromStore.length === 0) {
      setAlbumsData([]);
      setIsLoadingTracks(false); // Важно: сбрасываем флаг загрузки, чтобы дашборд мог показаться
      return;
    }

    setIsLoadingTracks(true);
    const abortController = new AbortController();

    (async () => {
      try {
        // Сначала преобразуем альбомы без загрузки статусов (быстро показываем структуру)
        const transformedAlbums: AlbumData[] = albumsFromStore.map((album: IAlbums) => {
          const albumId = album.albumId || '';

          // Обрабатываем release (объект с полем date)
          let releaseDate: Date | null = null;
          if (album.release && typeof album.release === 'object' && 'date' in album.release) {
            const dateStr = album.release.date;
            if (dateStr) {
              releaseDate = new Date(dateStr);
            }
          }

          // Создаем треки с определением статуса на основе данных из альбома
          const tracks: TrackData[] = (album.tracks || []).map((track) => {
            // Определяем статус на основе данных из альбома
            let lyricsStatus: TrackData['lyricsStatus'] = 'empty';
            if (track.syncedLyrics && track.syncedLyrics.length > 0) {
              // Проверяем, действительно ли синхронизировано (есть startTime > 0)
              const isActuallySynced = track.syncedLyrics.some((line) => line.startTime > 0);
              lyricsStatus = isActuallySynced ? 'synced' : 'text-only';
            } else if (track.content && track.content.trim() !== '') {
              lyricsStatus = 'text-only';
            }

            return {
              id: String(track.id),
              title: track.title,
              duration:
                typeof track.duration === 'string'
                  ? track.duration
                  : track.duration
                    ? String(track.duration)
                    : '0:00',
              lyricsStatus,
              lyricsText: track.content, // Используем текст из альбома, если есть
              src: track.src,
              authorship:
                (track as any).authorship ||
                getCachedAuthorship(albumId, String(track.id), lang) ||
                undefined,
            };
          });

          return {
            id: albumId,
            title: album.album,
            year: releaseDate ? releaseDate.getFullYear().toString() : '',
            cover: album.cover?.img || '',
            releaseDate: releaseDate
              ? releaseDate.toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })
              : undefined,
            tracks,
          };
        });

        // Показываем данные сразу (статусы определены на основе данных из альбомов)
        if (!abortController.signal.aborted) {
          setAlbumsData(transformedAlbums);
          setIsLoadingTracks(false);
        }

        // Статусы треков определяются на основе данных из альбомов
        // Дополнительная загрузка из БД отключена, чтобы избежать таймаутов
        // Статусы будут обновляться при необходимости (например, при сохранении)
      } catch (error) {
        console.error('Ошибка загрузки данных альбомов:', error);
        if (!abortController.signal.aborted) {
          setIsLoadingTracks(false);
        }
      }
    })();

    return () => {
      abortController.abort();
    };
  }, [albumsFromStore, lang]);

  const toggleAlbum = (albumId: string) => {
    setExpandedAlbumId((prev) => (prev === albumId ? null : albumId));
  };

  const getLyricsStatusText = (status: TrackData['lyricsStatus']) => {
    switch (status) {
      case 'synced':
        return ui?.dashboard?.addedSynced ?? 'Added, synced';
      case 'text-only':
        return ui?.dashboard?.addedNoSync ?? 'Added, no sync';
      case 'empty':
        return ui?.dashboard?.noLyrics ?? 'No lyrics';
      default:
        return '';
    }
  };

  const getLyricsActions = (status: TrackData['lyricsStatus']) => {
    switch (status) {
      case 'synced':
        return [
          { label: ui?.dashboard?.edit ?? 'Edit', action: 'edit' },
          { label: ui?.dashboard?.prev ?? 'Prev', action: 'prev' },
        ];
      case 'text-only':
        return [
          { label: ui?.dashboard?.edit ?? 'Edit', action: 'edit' },
          { label: ui?.dashboard?.sync ?? 'Sync', action: 'sync' },
        ];
      case 'empty':
        return [{ label: ui?.dashboard?.add ?? 'Add', action: 'add' }];
      default:
        return [];
    }
  };

  const handleLyricsAction = async (
    action: string,
    albumId: string,
    trackId: string,
    trackTitle: string
  ) => {
    if (action === 'add') {
      setAddLyricsModal({ isOpen: true, albumId, trackId, trackTitle });
    } else if (action === 'edit') {
      const album = albumsData.find((a) => a.id === albumId);
      const track = album?.tracks.find((t) => t.id === trackId);
      if (track) {
        // Загружаем authorship для отображения в модальном окне
        const cachedAuthorship = getCachedAuthorship(albumId, trackId, lang);
        const storedAuthorship = await loadAuthorshipFromStorage(albumId, trackId, lang).catch(
          () => null
        );
        const fallbackAuthorship = track.authorship || cachedAuthorship;

        setEditLyricsModal({
          isOpen: true,
          albumId,
          trackId,
          trackTitle,
          trackStatus: track.lyricsStatus,
          initialAuthorship: storedAuthorship || fallbackAuthorship || undefined,
        });
      }
    } else if (action === 'prev') {
      const lyrics = getTrackLyricsText(albumId, trackId);
      setPreviewLyricsModal({ isOpen: true, lyrics });
    } else if (action === 'sync') {
      const album = albumsData.find((a) => a.id === albumId);
      const track = album?.tracks.find((t) => t.id === trackId);
      if (track) {
        const lyricsText = getTrackLyricsText(albumId, trackId);
        setSyncLyricsModal({
          isOpen: true,
          albumId,
          trackId,
          trackTitle,
          trackSrc: track.src,
          lyricsText,
          authorship: track.authorship,
        });
      }
    }
  };

  const handleAddLyrics = async (lyrics: string, authorship?: string) => {
    if (!addLyricsModal) return;

    // Сохраняем текст и авторство в БД
    const album = albumsData.find((a) => a.id === addLyricsModal.albumId);
    if (album) {
      const result = await saveTrackText({
        albumId: addLyricsModal.albumId,
        trackId: addLyricsModal.trackId,
        lang,
        content: lyrics,
        authorship,
      });

      if (result.success) {
        setCachedAuthorship(addLyricsModal.albumId, addLyricsModal.trackId, lang, authorship);
        setAlbumsData((prev) =>
          prev.map((a) => {
            if (a.id === addLyricsModal.albumId) {
              return {
                ...a,
                tracks: a.tracks.map((track) =>
                  track.id === addLyricsModal.trackId
                    ? {
                        ...track,
                        lyricsStatus: 'text-only' as const,
                        lyricsText: lyrics,
                        authorship,
                      }
                    : track
                ),
              };
            }
            return a;
          })
        );
      } else {
        alert(result.message || 'Ошибка при сохранении текста');
      }
    }

    setAddLyricsModal(null);
  };

  const handleSaveLyrics = async (lyrics: string, authorship?: string) => {
    if (!editLyricsModal) return;

    // Сохраняем текст и авторство в БД
    const album = albumsData.find((a) => a.id === editLyricsModal.albumId);
    if (album) {
      const result = await saveTrackText({
        albumId: editLyricsModal.albumId,
        trackId: editLyricsModal.trackId,
        lang,
        content: lyrics,
        authorship,
      });

      if (result.success) {
        setCachedAuthorship(editLyricsModal.albumId, editLyricsModal.trackId, lang, authorship);
        setAlbumsData((prev) =>
          prev.map((a) => {
            if (a.id === editLyricsModal.albumId) {
              return {
                ...a,
                tracks: a.tracks.map((track) =>
                  track.id === editLyricsModal.trackId
                    ? { ...track, lyricsText: lyrics, authorship }
                    : track
                ),
              };
            }
            return a;
          })
        );
      } else {
        alert(result.message || 'Ошибка при сохранении текста');
      }
    }
  };

  const getTrackLyricsText = (albumId: string, trackId: string): string => {
    const album = albumsData.find((a) => a.id === albumId);
    const track = album?.tracks.find((t) => t.id === trackId);
    return track?.lyricsText ?? MOCK_LYRICS_TEXT;
  };

  const getTrackSyncedLyrics = (
    albumId: string,
    trackId: string
  ): { text: string; startTime: number; endTime?: number }[] | undefined => {
    const album = albumsData.find((a) => a.id === albumId);
    const track = album?.tracks.find((t) => t.id === trackId);
    if (track?.syncedLyrics && track.syncedLyrics.length > 0) {
      return track.syncedLyrics;
    }
    return undefined;
  };

  const handlePreviewLyrics = () => {
    if (!editLyricsModal) return;
    const { albumId, trackId } = editLyricsModal;
    const lyrics = getTrackLyricsText(albumId, trackId);
    const syncedLyrics = getTrackSyncedLyrics(albumId, trackId);
    const album = albumsData.find((a) => a.id === albumId);
    const track = album?.tracks.find((t) => t.id === trackId);
    setPreviewLyricsModal({
      isOpen: true,
      lyrics,
      syncedLyrics,
      authorship: track?.authorship,
    });
  };

  // Показываем загрузку пока данные не загружены
  // Не показываем пустой дашборд - ждем данные
  if ((albumsStatus === 'loading' || albumsStatus === 'idle') && albumsData.length === 0) {
    return (
      <Popup isActive={true} onClose={() => navigate('/')}>
        <div className="dashboard-v2-simple">
          <div className="dashboard-v2-simple__card">
            <div className="dashboard-v2-simple__loading">Загрузка...</div>
          </div>
        </div>
      </Popup>
    );
  }

  if (albumsStatus === 'failed') {
    return (
      <Popup isActive={true} onClose={() => navigate('/')}>
        <div className="dashboard-v2-simple">
          <div className="dashboard-v2-simple__card">
            <div className="dashboard-v2-simple__error">
              Ошибка загрузки: {albumsError || 'Не удалось загрузить альбомы'}
            </div>
          </div>
        </div>
      </Popup>
    );
  }

  return (
    <>
      <Helmet>
        <title>{ui?.dashboard?.title ?? 'User Dashboard'} — Смоляное Чучелко</title>
      </Helmet>

      <Popup isActive={true} onClose={() => navigate('/')}>
        <div className="dashboard-v2-simple">
          {/* Main card container */}
          <div className="dashboard-v2-simple__card">
            {/* Header with tabs */}
            <div className="dashboard-v2-simple__header">
              <div className="dashboard-v2-simple__tabs">
                <button
                  type="button"
                  className={`dashboard-v2-simple__tab ${activeTab === 'albums' ? 'dashboard-v2-simple__tab--active' : ''}`}
                  onClick={() => setActiveTab('albums')}
                >
                  {ui?.dashboard?.tabs?.albums ?? 'Albums'}
                </button>
                <button
                  type="button"
                  className={`dashboard-v2-simple__tab ${activeTab === 'posts' ? 'dashboard-v2-simple__tab--active' : ''}`}
                  onClick={() => setActiveTab('posts')}
                >
                  {ui?.dashboard?.tabs?.posts ?? 'Posts'}
                </button>
                <button
                  type="button"
                  className={`dashboard-v2-simple__tab ${activeTab === 'payment-settings' ? 'dashboard-v2-simple__tab--active' : ''}`}
                  onClick={() => setActiveTab('payment-settings')}
                >
                  Payment Settings
                </button>
              </div>
              <button
                type="button"
                className="dashboard-v2-simple__logout-button"
                onClick={() => {
                  logout();
                  navigate('/auth');
                }}
              >
                {ui?.dashboard?.logout ?? 'Logout'}
              </button>
            </div>

            {/* Main layout */}
            <div className="dashboard-v2-simple__layout">
              {/* Left column - Profile */}
              <div className="dashboard-v2-simple__profile">
                <h3 className="dashboard-v2-simple__profile-title">
                  {ui?.dashboard?.profile ?? 'Profile'}
                </h3>

                <div className="dashboard-v2-simple__avatar">
                  <div className="dashboard-v2-simple__avatar-img">
                    <img
                      src={getUserImageUrl('profile', 'profile', '.jpg')}
                      alt={ui?.dashboard?.profile ?? 'Profile'}
                      onError={(e) => {
                        const img = e.target as HTMLImageElement;
                        // Первая попытка: локальный файл
                        if (img.dataset.fallbackApplied !== 'local') {
                          img.dataset.fallbackApplied = 'local';
                          img.src = '/images/users/zhoock/profile/profile.jpg';
                          return;
                        }
                        // Если и локальный не найден — скрываем
                        img.style.display = 'none';
                      }}
                    />
                  </div>
                </div>

                <div className="dashboard-v2-simple__profile-fields">
                  <div className="dashboard-v2-simple__field">
                    <label htmlFor="name">{ui?.dashboard?.profileFields?.name ?? 'Name'}</label>
                    <input id="name" type="text" defaultValue={user?.name || ''} disabled />
                  </div>

                  <div className="dashboard-v2-simple__field">
                    <label htmlFor="email">{ui?.dashboard?.profileFields?.email ?? 'Email'}</label>
                    <input id="email" type="email" defaultValue={user?.email || ''} disabled />
                  </div>
                </div>
              </div>

              {/* Vertical separator */}
              <div className="dashboard-v2-simple__separator"></div>

              {/* Right column - Content */}
              <div className="dashboard-v2-simple__content">
                {activeTab === 'payment-settings' ? (
                  <PaymentSettings userId="current-user" />
                ) : activeTab === 'albums' ? (
                  <>
                    <h3 className="dashboard-v2-simple__section-title">
                      {ui?.dashboard?.tabs?.albums ?? 'Albums'}
                    </h3>
                    <div className="dashboard-v2-simple__section">
                      <div className="dashboard-v2-simple__albums-list">
                        {albumsData.map((album, index) => {
                          const isExpanded = expandedAlbumId === album.id;
                          return (
                            <React.Fragment key={album.id}>
                              <div
                                className={`dashboard-v2-simple__album-item ${isExpanded ? 'dashboard-v2-simple__album-item--expanded' : ''}`}
                                onClick={() => toggleAlbum(album.id)}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    toggleAlbum(album.id);
                                  }
                                }}
                                aria-label={isExpanded ? 'Collapse album' : 'Expand album'}
                              >
                                <div className="dashboard-v2-simple__album-thumbnail">
                                  <img
                                    src={getUserImageUrl(album.cover, 'albums', '@2x-128.webp')}
                                    alt={album.title}
                                  />
                                </div>
                                <div className="dashboard-v2-simple__album-info">
                                  <div className="dashboard-v2-simple__album-title">
                                    {album.title}
                                  </div>
                                  {album.releaseDate ? (
                                    <div className="dashboard-v2-simple__album-date">
                                      {album.releaseDate}
                                    </div>
                                  ) : (
                                    <div className="dashboard-v2-simple__album-year">
                                      {album.year}
                                    </div>
                                  )}
                                </div>
                                <div
                                  className={`dashboard-v2-simple__album-arrow ${isExpanded ? 'dashboard-v2-simple__album-arrow--expanded' : ''}`}
                                >
                                  {isExpanded ? '⌃' : '›'}
                                </div>
                              </div>

                              {isExpanded && (
                                <div className="dashboard-v2-simple__album-expanded">
                                  {/* Edit Album button */}
                                  <button
                                    type="button"
                                    className="dashboard-v2-simple__edit-album-button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditAlbumModal({ isOpen: true, albumId: album.id });
                                    }}
                                  >
                                    {ui?.dashboard?.editAlbum ?? 'Edit Album'}
                                  </button>

                                  {/* Track upload section */}
                                  <div className="dashboard-v2-simple__track-upload">
                                    <div className="dashboard-v2-simple__track-upload-text">
                                      {ui?.dashboard?.dropTracksHere ?? 'Drop tracks here or'}
                                    </div>
                                    <input
                                      ref={(el) => {
                                        fileInputRefs.current[album.id] = el;
                                      }}
                                      type="file"
                                      multiple
                                      accept="audio/*"
                                      style={{ display: 'none' }}
                                      onChange={(e) => {
                                        const files = e.target.files;
                                        if (files && files.length > 0) {
                                          // TODO: Обработка загруженных файлов
                                          console.log('Selected files:', files);
                                        }
                                      }}
                                    />
                                    <button
                                      type="button"
                                      className="dashboard-v2-simple__choose-files-button"
                                      onClick={() => {
                                        const input = fileInputRefs.current[album.id];
                                        if (input) {
                                          input.click();
                                        }
                                      }}
                                    >
                                      {ui?.dashboard?.chooseFiles ?? 'Choose files'}
                                    </button>
                                  </div>

                                  {/* Tracks list */}
                                  <div className="dashboard-v2-simple__tracks-list">
                                    {album.tracks.map((track) => (
                                      <div
                                        key={track.id}
                                        className="dashboard-v2-simple__track-item"
                                      >
                                        <div className="dashboard-v2-simple__track-number">
                                          {track.id.padStart(2, '0')}
                                        </div>
                                        <div className="dashboard-v2-simple__track-title">
                                          {track.title}
                                        </div>
                                        <div className="dashboard-v2-simple__track-duration">
                                          {track.duration}
                                        </div>
                                      </div>
                                    ))}
                                  </div>

                                  {/* Lyrics section */}
                                  <div className="dashboard-v2-simple__lyrics-section">
                                    <h4 className="dashboard-v2-simple__lyrics-title">
                                      {ui?.dashboard?.lyrics ?? 'Lyrics'}
                                    </h4>
                                    <div className="dashboard-v2-simple__lyrics-table">
                                      <div className="dashboard-v2-simple__lyrics-header">
                                        <div className="dashboard-v2-simple__lyrics-header-cell">
                                          {ui?.dashboard?.track ?? 'Track'}
                                        </div>
                                        <div className="dashboard-v2-simple__lyrics-header-cell">
                                          {ui?.dashboard?.status ?? 'Status'}
                                        </div>
                                        <div className="dashboard-v2-simple__lyrics-header-cell">
                                          {ui?.dashboard?.actions ?? 'Actions'}
                                        </div>
                                      </div>
                                      {album.tracks.map((track) => (
                                        <div
                                          key={track.id}
                                          className="dashboard-v2-simple__lyrics-row"
                                        >
                                          <div className="dashboard-v2-simple__lyrics-cell">
                                            {track.title}
                                          </div>
                                          <div className="dashboard-v2-simple__lyrics-cell">
                                            {getLyricsStatusText(track.lyricsStatus)}
                                          </div>
                                          <div className="dashboard-v2-simple__lyrics-cell dashboard-v2-simple__lyrics-cell--actions">
                                            {getLyricsActions(track.lyricsStatus).map(
                                              (action, idx) => (
                                                <button
                                                  key={idx}
                                                  type="button"
                                                  className="dashboard-v2-simple__lyrics-action-button"
                                                  onClick={() =>
                                                    handleLyricsAction(
                                                      action.action,
                                                      album.id,
                                                      track.id,
                                                      track.title
                                                    )
                                                  }
                                                >
                                                  {action.label}
                                                </button>
                                              )
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              )}

                              {index < albumsData.length - 1 && (
                                <div className="dashboard-v2-simple__album-divider"></div>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </div>

                      <button type="button" className="dashboard-v2-simple__upload-button">
                        <span>+</span>
                        <span>{ui?.dashboard?.uploadNewAlbum ?? 'Upload New Album'}</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <h3 className="dashboard-v2-simple__section-title">
                      {ui?.dashboard?.tabs?.posts ?? 'Posts'}
                    </h3>
                    <div className="dashboard-v2-simple__section">
                      <div className="dashboard-v2-simple__posts-prompt">
                        <div className="dashboard-v2-simple__posts-prompt-text">
                          {ui?.dashboard?.writeAndPublishArticles ?? 'Write and publish articles'}
                        </div>
                        <button type="button" className="dashboard-v2-simple__new-post-button">
                          {ui?.dashboard?.newPost ?? 'New Post'}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
        <Hamburger isActive={true} onToggle={() => navigate('/')} />
      </Popup>

      {/* Add Lyrics Modal */}
      {addLyricsModal && (
        <AddLyricsModal
          isOpen={addLyricsModal.isOpen}
          trackTitle={addLyricsModal.trackTitle}
          onClose={() => setAddLyricsModal(null)}
          onSave={handleAddLyrics}
        />
      )}

      {/* Edit Lyrics Modal */}
      {editLyricsModal && (
        <EditLyricsModal
          isOpen={editLyricsModal.isOpen}
          initialLyrics={getTrackLyricsText(editLyricsModal.albumId, editLyricsModal.trackId)}
          onClose={() => setEditLyricsModal(null)}
          onSave={handleSaveLyrics}
          onPreview={editLyricsModal.trackStatus === 'synced' ? handlePreviewLyrics : undefined}
        />
      )}

      {/* Preview Lyrics Modal */}
      {previewLyricsModal && (
        <PreviewLyricsModal
          isOpen={previewLyricsModal.isOpen}
          lyrics={previewLyricsModal.lyrics}
          syncedLyrics={previewLyricsModal.syncedLyrics}
          authorship={previewLyricsModal.authorship}
          onClose={() => setPreviewLyricsModal(null)}
        />
      )}

      {/* Sync Lyrics Modal */}
      {syncLyricsModal && (
        <SyncLyricsModal
          isOpen={syncLyricsModal.isOpen}
          albumId={syncLyricsModal.albumId}
          trackId={syncLyricsModal.trackId}
          trackTitle={syncLyricsModal.trackTitle}
          trackSrc={syncLyricsModal.trackSrc}
          lyricsText={syncLyricsModal.lyricsText}
          authorship={syncLyricsModal.authorship}
          onClose={() => setSyncLyricsModal(null)}
        />
      )}

      {/* Edit Album Modal */}
      {editAlbumModal && (
        <EditAlbumModal
          isOpen={editAlbumModal.isOpen}
          albumId={editAlbumModal.albumId}
          onClose={() => setEditAlbumModal(null)}
          onNext={async (formData) => {
            if (!editAlbumModal) {
              setEditAlbumModal(null);
              return;
            }

            // Обновляем локальное состояние сразу, чтобы изменения были видны мгновенно
            setAlbumsData((prev) =>
              prev.map((album) => {
                if (album.id === editAlbumModal.albumId) {
                  // Обновляем данные альбома из formData
                  const releaseDate = formData.releaseDate ? new Date(formData.releaseDate) : null;

                  return {
                    ...album,
                    title: formData.title,
                    year: releaseDate ? releaseDate.getFullYear().toString() : album.year,
                    releaseDate: releaseDate
                      ? releaseDate.toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })
                      : album.releaseDate,
                  };
                }
                return album;
              })
            );

            // Пытаемся обновить Redux store (если БД доступна)
            try {
              await dispatch(fetchAlbums({ lang })).unwrap();
              console.log('✅ Albums data refreshed from API');
            } catch (error) {
              // Если БД недоступна - не страшно, локальное состояние уже обновлено
              console.warn('⚠️ API unavailable, using local state update');
            }

            setEditAlbumModal(null);
          }}
        />
      )}
    </>
  );
}

export default UserDashboard;
