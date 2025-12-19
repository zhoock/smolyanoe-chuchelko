// src/pages/UserDashboard/UserDashboard.tsx

import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useLang } from '@app/providers/lang';
import { useAppSelector } from '@shared/lib/hooks/useAppSelector';
import { useAppDispatch } from '@shared/lib/hooks/useAppDispatch';
import { selectUiDictionaryFirst } from '@shared/model/uiDictionary';
import { getUserImageUrl } from '@shared/api/albums';
import { Popup } from '@shared/ui/popup';
import { Hamburger } from '@shared/ui/hamburger';
import { logout, isAuthenticated, getUser, getToken } from '@shared/lib/auth';
import {
  fetchAlbums,
  selectAlbumsStatus,
  selectAlbumsData,
  selectAlbumsError,
} from '@entities/album';
import { loadTrackTextFromDatabase, saveTrackText } from '@entities/track/lib';
import { uploadFile } from '@shared/api/storage';
import { loadAuthorshipFromStorage } from '@features/syncedLyrics/lib';
import { uploadTracks, prepareAndUploadTrack, type TrackUploadData } from '@shared/api/tracks';
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
  albumId: string; // Строковый ID альбома (например, "23-remastered")
  title: string;
  artist: string;
  year: string;
  cover?: string;
  coverUpdatedAt?: number; // Timestamp для принудительной перезагрузки изображения
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
  const [isUploadingTracks, setIsUploadingTracks] = useState<{ [albumId: string]: boolean }>({});
  const [uploadProgress, setUploadProgress] = useState<{ [albumId: string]: number }>({});
  const fileInputRefs = useRef<{ [albumId: string]: HTMLInputElement | null }>({});
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  // Ключ для сохранения URL аватара в localStorage
  const AVATAR_URL_KEY = 'user-avatar-url';

  // Инициализация avatarSrc: сначала проверяем localStorage, затем fallback на дефолтный аватар
  const [avatarSrc, setAvatarSrc] = useState<string>(() => {
    try {
      const savedUrl = localStorage.getItem(AVATAR_URL_KEY);
      if (savedUrl) {
        // Добавляем cache-bust при загрузке из localStorage для принудительного обновления
        const bust = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        return `${savedUrl}?t=${bust}`;
      }
    } catch (error) {
      console.warn('Failed to load avatar URL from localStorage:', error);
    }
    // Дефолтный аватар
    return '/images/avatar.png';
  });
  const [isUploadingAvatar, setIsUploadingAvatar] = useState<boolean>(false);
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
    trackSrc?: string;
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
    albumId?: string;
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
      dispatch(fetchAlbums({ lang })).catch((error: any) => {
        // ConditionError - это нормально, condition отменил запрос
        if (error?.name === 'ConditionError') {
          return;
        }
        console.error('Error fetching albums:', error);
      });
    }
  }, [dispatch, lang, albumsStatus]);

  // Преобразование данных из IAlbums[] в AlbumData[] и загрузка статусов треков
  // Используем JSON.stringify для отслеживания изменений в данных
  const albumsFromStoreKey = JSON.stringify(
    albumsFromStore?.map((a) => ({
      albumId: a.albumId,
      artist: a.artist,
      album: a.album,
      cover: a.cover,
    }))
  );

  useEffect(() => {
    if (!albumsFromStore || albumsFromStore.length === 0) {
      setAlbumsData([]);
      setIsLoadingTracks(false);
      return;
    }

    setIsLoadingTracks(true);
    const abortController = new AbortController();

    (async () => {
      try {
        // Преобразуем альбомы из Redux store в формат для UI
        // Создаем новый массив для каждого альбома, чтобы React увидел изменения
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
            albumId: album.albumId || albumId, // Сохраняем строковый ID альбома
            title: album.album,
            artist: album.artist || '',
            year: releaseDate ? releaseDate.getFullYear().toString() : '',
            cover: album.cover,
            coverUpdatedAt: Date.now(), // Добавляем timestamp для принудительной перезагрузки изображения
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

        // Обновляем локальное состояние из Redux store
        // Принудительно создаем новый массив для гарантии обновления React
        if (!abortController.signal.aborted) {
          setAlbumsData([...transformedAlbums]);
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
  }, [albumsFromStoreKey, lang, albumsFromStore]);

  const toggleAlbum = (albumId: string) => {
    setExpandedAlbumId((prev) => (prev === albumId ? null : albumId));
  };

  // Удаление альбома
  const handleDeleteTrack = async (albumId: string, trackId: string, trackTitle: string) => {
    // Подтверждение удаления
    const confirmed = window.confirm(
      `Вы уверены, что хотите удалить трек "${trackTitle}"?\n\nЭто действие нельзя отменить.`
    );

    if (!confirmed) {
      return;
    }

    try {
      const token = getToken();
      if (!token) {
        alert('Ошибка: вы не авторизованы. Пожалуйста, войдите в систему.');
        return;
      }

      // Удаляем трек через API
      const response = await fetch(
        `/api/albums?trackId=${encodeURIComponent(trackId)}&albumId=${encodeURIComponent(albumId)}&lang=${encodeURIComponent(lang)}`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error((errorData as any)?.error || `HTTP error! status: ${response.status}`);
      }

      // Обновляем Redux store
      await dispatch(fetchAlbums({ lang, force: true })).unwrap();

      console.log('✅ Track deleted successfully:', { albumId, trackId });
    } catch (error) {
      console.error('❌ Error deleting track:', error);
      alert(
        `Ошибка при удалении трека: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  };

  const handleDeleteAlbum = async (albumId: string) => {
    // Находим альбом для получения названия
    const album = albumsData.find((a) => a.id === albumId);
    const albumTitle = album?.title || albumId;

    // Подтверждение удаления
    const confirmed = window.confirm(
      `Вы уверены, что хотите удалить альбом "${albumTitle}"?\n\nЭто действие нельзя отменить.`
    );

    if (!confirmed) {
      return;
    }

    try {
      const token = getToken();
      if (!token) {
        alert('Ошибка: вы не авторизованы. Пожалуйста, войдите в систему.');
        return;
      }

      // Удаляем альбом через API
      const response = await fetch('/api/albums', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          albumId,
          lang,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error((errorData as any)?.error || `HTTP error! status: ${response.status}`);
      }

      // Обновляем Redux store
      await dispatch(fetchAlbums({ lang, force: true })).unwrap();

      // Удаляем альбом из локального состояния
      setAlbumsData((prev) => prev.filter((a) => a.id !== albumId));

      // Закрываем расширенный вид, если удаленный альбом был открыт
      if (expandedAlbumId === albumId) {
        setExpandedAlbumId(null);
      }

      console.log('✅ Album deleted successfully:', albumId);
    } catch (error) {
      console.error('❌ Error deleting album:', error);
      alert(
        `Ошибка при удалении альбома: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  };

  // Обработка загрузки треков
  const handleTrackUpload = async (albumId: string, files: FileList) => {
    if (isUploadingTracks[albumId]) {
      return;
    }

    setIsUploadingTracks((prev) => ({ ...prev, [albumId]: true }));
    setUploadProgress((prev) => ({ ...prev, [albumId]: 0 }));

    try {
      // Находим альбом в albumsFromStore для получения данных
      const albumFromStore = albumsFromStore.find((a) => a.albumId === albumId);
      if (!albumFromStore) {
        throw new Error('Album not found');
      }

      // Загружаем файлы и подготавливаем метаданные для каждого трека
      const tracksData: TrackUploadData[] = [];
      const fileArray = Array.from(files);

      // Получаем текущее количество треков в альбоме для правильной нумерации
      const currentAlbum = albumsData.find((a) => a.id === albumId);
      const existingTracksCount = currentAlbum?.tracks?.length || 0;
      const startTrackNumber = existingTracksCount + 1;

      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i];
        // Генерируем trackId начиная с существующего количества + 1
        const trackId = String(startTrackNumber + i);

        // Обновляем прогресс: загрузка файла (0-80% для всех файлов)
        const fileProgressStart = (i / fileArray.length) * 80;
        const fileProgressEnd = ((i + 1) / fileArray.length) * 80;
        setUploadProgress((prev) => ({ ...prev, [albumId]: fileProgressStart }));

        // orderIndex должен быть равен индексу в массиве всех треков (существующие + новые)
        const orderIndex = existingTracksCount + i;

        try {
          const trackData = await prepareAndUploadTrack(file, albumId, trackId, orderIndex);
          tracksData.push(trackData);

          // Обновляем прогресс после успешной загрузки файла
          setUploadProgress((prev) => ({ ...prev, [albumId]: fileProgressEnd }));
        } catch (error) {
          console.error(`❌ [handleTrackUpload] Error uploading track ${trackId}:`, error);
          // Продолжаем загрузку остальных треков, но не обновляем прогресс при ошибке
        }
      }

      // Обновляем прогресс: сохранение метаданных в БД (80-100%)
      setUploadProgress((prev) => ({ ...prev, [albumId]: 90 }));

      if (tracksData.length === 0) {
        throw new Error('Failed to upload any tracks');
      }

      // Загружаем треки
      const result = await uploadTracks(albumId, lang, tracksData);

      if (result.success && result.data) {
        const uploadedCount = Array.isArray(result.data) ? result.data.length : 0;

        // Обновляем прогресс: завершение (100%)
        setUploadProgress((prev) => ({ ...prev, [albumId]: 100 }));

        // Обновляем список альбомов
        try {
          await dispatch(fetchAlbums({ lang, force: true })).unwrap();
        } catch (fetchError: any) {
          // ConditionError - это нормально, condition отменил запрос
          if (fetchError?.name !== 'ConditionError') {
            console.error('⚠️ Failed to refresh albums:', fetchError);
          }
        }

        // Принудительно обновляем локальное состояние, если нужно
        // Это гарантирует, что новые треки появятся в UI
        setTimeout(() => {
          // Даем время на обновление Redux store, затем обновляем локальное состояние
          const updatedAlbums = albumsFromStore.map((album) => {
            if (album.albumId === albumId) {
              // Альбом уже обновлен через fetchAlbums, просто возвращаем его
              return album;
            }
            return album;
          });

          // Преобразуем в формат AlbumData
          const transformedAlbums: AlbumData[] = updatedAlbums.map((album) => {
            const releaseDate = album.release?.date ? new Date(album.release.date) : null;
            const tracks: TrackData[] = (album.tracks || []).map((track) => {
              // Преобразуем duration в строку (формат "M:SS" или "MM:SS")
              let durationStr = '0:00';
              if (track.duration) {
                if (typeof track.duration === 'string') {
                  durationStr = track.duration;
                } else if (typeof track.duration === 'number') {
                  const minutes = Math.floor(track.duration / 60);
                  const seconds = Math.floor(track.duration % 60);
                  durationStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
                }
              }

              // Определяем статус текста
              let lyricsStatus: TrackData['lyricsStatus'] = 'empty';
              if (track.syncedLyrics && track.syncedLyrics.length > 0) {
                const isActuallySynced = track.syncedLyrics.some((line) => line.startTime > 0);
                lyricsStatus = isActuallySynced ? 'synced' : 'text-only';
              } else if (track.content && track.content.trim() !== '') {
                lyricsStatus = 'text-only';
              }

              return {
                id: String(track.id || ''),
                title: track.title || '',
                duration: durationStr,
                lyricsStatus,
              };
            });

            return {
              id: album.albumId || '',
              albumId: album.albumId || '', // Сохраняем строковый ID альбома
              title: album.album,
              artist: album.artist || '',
              year: releaseDate ? releaseDate.getFullYear().toString() : '',
              cover: album.cover || '',
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

          setAlbumsData(transformedAlbums);
        }, 500);

        alert(`Successfully uploaded ${uploadedCount} track(s)`);
      } else {
        throw new Error(result.error || 'Failed to upload tracks');
      }
    } catch (error) {
      console.error('❌ Error uploading tracks:', error);
      alert(`Error uploading tracks: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsUploadingTracks((prev) => {
        const newState = { ...prev };
        delete newState[albumId];
        return newState;
      });
      setUploadProgress((prev) => {
        const newState = { ...prev };
        delete newState[albumId];
        return newState;
      });
    }
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
      const syncedLyrics = getTrackSyncedLyrics(albumId, trackId);
      const album = albumsData.find((a) => a.id === albumId);
      const track = album?.tracks.find((t) => t.id === trackId);
      console.log('[UserDashboard] Opening Preview Lyrics:', {
        albumId,
        trackId,
        trackSrc: track?.src,
        hasTrack: !!track,
        albumTracks: album?.tracks.map((t) => ({ id: t.id, src: t.src })),
      });
      setPreviewLyricsModal({
        isOpen: true,
        lyrics,
        syncedLyrics,
        authorship: track?.authorship,
        trackSrc: track?.src,
      });
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

  const getTrackAuthorship = (albumId: string, trackId: string): string | undefined => {
    const album = albumsData.find((a) => a.id === albumId);
    const track = album?.tracks.find((t) => t.id === trackId);
    return track?.authorship;
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
      trackSrc: track?.src,
    });
  };

  const handleSyncLyricsFromEdit = async (currentLyrics: string, currentAuthorship?: string) => {
    if (!editLyricsModal) return;
    const { albumId, trackId, trackTitle } = editLyricsModal;
    // Сначала сохраняем изменения текста
    await handleSaveLyrics(currentLyrics, currentAuthorship);
    // Закрываем модалку редактирования текста
    setEditLyricsModal(null);
    // Открываем модалку синхронизации с сохранённым текстом
    const album = albumsData.find((a) => a.id === albumId);
    const track = album?.tracks.find((t) => t.id === trackId);
    if (track) {
      // Используем переданный текст напрямую (он уже сохранён через handleSaveLyrics)
      setSyncLyricsModal({
        isOpen: true,
        albumId,
        trackId,
        trackTitle,
        trackSrc: track.src,
        lyricsText: currentLyrics,
        authorship: currentAuthorship,
      });
    }
  };

  const handleAvatarClick = () => {
    if (isUploadingAvatar) return;
    avatarInputRef.current?.click();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingAvatar(true);
    try {
      // Определяем расширение файла из MIME типа или имени файла
      let fileExtension = '.jpg'; // По умолчанию
      if (file.type) {
        if (file.type === 'image/png') {
          fileExtension = '.png';
        } else if (file.type === 'image/jpeg' || file.type === 'image/jpg') {
          fileExtension = '.jpg';
        } else if (file.type === 'image/webp') {
          fileExtension = '.webp';
        } else {
          // Пытаемся определить из имени файла
          const nameMatch = file.name.match(/\.([a-z0-9]+)$/i);
          if (nameMatch) {
            fileExtension = `.${nameMatch[1].toLowerCase()}`;
          }
        }
      }

      const fileName = `profile${fileExtension}`;

      const result = await uploadFile({
        category: 'profile',
        file,
        fileName,
        upsert: true,
      });

      if (!result) {
        console.error('Upload failed: result is null');
        alert('Не удалось загрузить аватар. Проверьте консоль для деталей и повторите.');
        return;
      }

      // Проверяем, что URL валидный
      if (!result.startsWith('http')) {
        console.error('Invalid URL returned:', result);
        alert('Получен невалидный URL аватара. Проверьте консоль для деталей.');
        return;
      }

      // Используем URL, который вернула функцию uploadFile (публичный URL из Supabase Storage)
      // Добавляем агрессивный cache-bust для принудительного обновления изображения
      // Используем timestamp + случайное число для гарантированного обновления
      const bust = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const avatarUrl = `${result}?t=${bust}`;

      // Предзагружаем новое изображение перед обновлением состояния
      // Это гарантирует, что новый аватар отобразится сразу после окончания прелоадера
      const preloadImg = new Image();

      await new Promise<void>((resolve, reject) => {
        preloadImg.onload = () => {
          resolve();
        };
        preloadImg.onerror = () => {
          console.warn('⚠️ Failed to preload new avatar, but will try to display it anyway');
          // Не отклоняем промис, чтобы всё равно обновить URL
          resolve();
        };
        // Начинаем загрузку
        preloadImg.src = avatarUrl;
      });

      // Сохраняем URL в localStorage (без cache-bust)
      try {
        localStorage.setItem(AVATAR_URL_KEY, result);
      } catch (error) {
        console.warn('Failed to save avatar URL to localStorage:', error);
      }

      // Обновляем состояние только после предзагрузки
      // Теперь новое изображение уже в кеше браузера и отобразится мгновенно
      setAvatarSrc(avatarUrl);
    } catch (error) {
      console.error('❌ Error uploading avatar:', error);
      alert(
        `Ошибка загрузки аватара: ${error instanceof Error ? error.message : 'Unknown error'}. Проверьте консоль для деталей.`
      );
    } finally {
      setIsUploadingAvatar(false);
      if (avatarInputRef.current) {
        avatarInputRef.current.value = '';
      }
    }
  };

  // Показываем загрузку пока данные не загружены
  // Не показываем пустой дашборд - ждем данные
  if ((albumsStatus === 'loading' || albumsStatus === 'idle') && albumsData.length === 0) {
    return (
      <Popup isActive={true} onClose={() => navigate('/')}>
        <div className="user-dashboard">
          <div className="user-dashboard__card">
            <div className="user-dashboard__loading">Загрузка...</div>
          </div>
        </div>
      </Popup>
    );
  }

  if (albumsStatus === 'failed') {
    return (
      <Popup isActive={true} onClose={() => navigate('/')}>
        <div className="user-dashboard">
          <div className="user-dashboard__card">
            <div className="user-dashboard__error">
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
        <div className="user-dashboard">
          {/* Main card container */}
          <div className="user-dashboard__card">
            {/* Header with tabs */}
            <div className="user-dashboard__header">
              <div className="user-dashboard__tabs">
                <button
                  type="button"
                  className={`user-dashboard__tab ${activeTab === 'albums' ? 'user-dashboard__tab--active' : ''}`}
                  onClick={() => setActiveTab('albums')}
                >
                  {ui?.dashboard?.tabs?.albums ?? 'Albums'}
                </button>
                <button
                  type="button"
                  className={`user-dashboard__tab ${activeTab === 'posts' ? 'user-dashboard__tab--active' : ''}`}
                  onClick={() => setActiveTab('posts')}
                >
                  {ui?.dashboard?.tabs?.posts ?? 'Posts'}
                </button>
                <button
                  type="button"
                  className={`user-dashboard__tab ${activeTab === 'payment-settings' ? 'user-dashboard__tab--active' : ''}`}
                  onClick={() => setActiveTab('payment-settings')}
                >
                  Payment Settings
                </button>
              </div>
              <div className="user-dashboard__header-controls">
                <button
                  type="button"
                  className="user-dashboard__logout-button"
                  onClick={() => {
                    logout();
                    navigate('/auth');
                  }}
                >
                  {ui?.dashboard?.logout ?? 'Logout'}
                </button>
              </div>
            </div>

            {/* Main layout */}
            <div className="user-dashboard__layout">
              {/* Left column - Profile */}
              <div className="user-dashboard__profile">
                <h3 className="user-dashboard__profile-title">
                  {ui?.dashboard?.profile ?? 'Profile'}
                </h3>

                <div className="user-dashboard__avatar">
                  <div
                    className="user-dashboard__avatar-img"
                    role="button"
                    tabIndex={0}
                    aria-label="Изменить аватар"
                    onClick={handleAvatarClick}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleAvatarClick();
                      }
                    }}
                  >
                    <img
                      src={avatarSrc}
                      alt={ui?.dashboard?.profile ?? 'Profile'}
                      onError={(e) => {
                        const img = e.target as HTMLImageElement;
                        const applied = img.dataset.fallbackApplied;

                        // 1) если фолбэк ещё не пробовали — пробуем дефолтный аватар
                        if (!applied) {
                          img.dataset.fallbackApplied = 'default';
                          img.src = '/images/avatar.png';
                          return;
                        }

                        // 2) если и дефолтный не загрузился — скрываем
                        img.style.display = 'none';
                      }}
                    />
                    {isUploadingAvatar && (
                      <div
                        className="user-dashboard__avatar-loader"
                        aria-live="polite"
                        aria-busy="true"
                      >
                        <div className="user-dashboard__avatar-spinner"></div>
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    className="user-dashboard__avatar-edit"
                    onClick={handleAvatarClick}
                    disabled={isUploadingAvatar}
                    aria-label="Изменить аватар"
                  >
                    ✎
                  </button>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    style={{
                      position: 'absolute',
                      width: '1px',
                      height: '1px',
                      opacity: 0,
                      pointerEvents: 'none',
                    }}
                    onChange={handleAvatarChange}
                  />
                </div>

                <div className="user-dashboard__profile-fields">
                  <div className="user-dashboard__field">
                    <label htmlFor="name">{ui?.dashboard?.profileFields?.name ?? 'Name'}</label>
                    <input id="name" type="text" defaultValue={user?.name || ''} disabled />
                  </div>

                  <div className="user-dashboard__field">
                    <label htmlFor="email">{ui?.dashboard?.profileFields?.email ?? 'Email'}</label>
                    <input id="email" type="email" defaultValue={user?.email || ''} disabled />
                  </div>
                </div>
              </div>

              {/* Vertical separator */}
              <div className="user-dashboard__separator"></div>

              {/* Right column - Content */}
              <div className="user-dashboard__content">
                {activeTab === 'payment-settings' ? (
                  <PaymentSettings userId="current-user" />
                ) : activeTab === 'albums' ? (
                  <>
                    <h3 className="user-dashboard__section-title">
                      {ui?.dashboard?.tabs?.albums ?? 'Albums'}
                    </h3>
                    <div className="user-dashboard__section">
                      <div className="user-dashboard__albums-list">
                        {albumsData.map((album, index) => {
                          const isExpanded = expandedAlbumId === album.id;
                          return (
                            <React.Fragment key={album.id}>
                              <div
                                className={`user-dashboard__album-item ${isExpanded ? 'user-dashboard__album-item--expanded' : ''}`}
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
                                <div className="user-dashboard__album-thumbnail">
                                  {album.cover ? (
                                    <img
                                      key={`cover-${album.id}-${album.cover}-${album.coverUpdatedAt || ''}`}
                                      src={`${getUserImageUrl(album.cover, 'albums', '-128.webp')}&v=${album.cover}${album.coverUpdatedAt ? `-${album.coverUpdatedAt}` : ''}`}
                                      alt={album.title}
                                      onError={(e) => {
                                        const img = e.target as HTMLImageElement;
                                        // При ошибке загрузки добавляем timestamp для принудительной перезагрузки
                                        const currentSrc = img.src;
                                        if (!currentSrc.includes('&_retry=')) {
                                          img.src = `${currentSrc.split('&v=')[0]}&v=${album.cover}&_retry=${Date.now()}`;
                                        }
                                      }}
                                    />
                                  ) : (
                                    <img src="/images/album-placeholder.png" alt={album.title} />
                                  )}
                                </div>
                                <div className="user-dashboard__album-info">
                                  <div className="user-dashboard__album-title">{album.title}</div>
                                  {album.releaseDate ? (
                                    <div className="user-dashboard__album-date">
                                      {album.releaseDate}
                                    </div>
                                  ) : (
                                    <div className="user-dashboard__album-year">{album.year}</div>
                                  )}
                                </div>
                                <div
                                  className={`user-dashboard__album-arrow ${isExpanded ? 'user-dashboard__album-arrow--expanded' : ''}`}
                                >
                                  {isExpanded ? '⌃' : '›'}
                                </div>
                              </div>

                              {isExpanded && (
                                <div className="user-dashboard__album-expanded">
                                  {/* Edit Album button */}
                                  <button
                                    type="button"
                                    className="user-dashboard__edit-album-button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditAlbumModal({ isOpen: true, albumId: album.id });
                                    }}
                                  >
                                    {ui?.dashboard?.editAlbum ?? 'Edit Album'}
                                  </button>

                                  {/* Track upload section */}
                                  <div
                                    className="user-dashboard__track-upload"
                                    onDrop={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      const files = e.dataTransfer.files;
                                      if (files.length > 0) {
                                        handleTrackUpload(album.id, files);
                                      }
                                    }}
                                    onDragOver={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                    }}
                                    onDragEnter={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                    }}
                                  >
                                    {isUploadingTracks[album.id] ? (
                                      <div className="user-dashboard__track-upload-progress">
                                        <div className="user-dashboard__track-upload-text">
                                          Uploading tracks...{' '}
                                          {Math.round(uploadProgress[album.id] || 0)}%
                                        </div>
                                        <div className="user-dashboard__track-upload-progress-bar">
                                          <div
                                            className="user-dashboard__track-upload-progress-fill"
                                            style={{
                                              width: `${uploadProgress[album.id] || 0}%`,
                                              transition: 'width 0.3s ease',
                                            }}
                                          />
                                        </div>
                                      </div>
                                    ) : (
                                      <>
                                        <div className="user-dashboard__track-upload-text">
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
                                              handleTrackUpload(album.id, files);
                                            }
                                            // Сбрасываем input, чтобы можно было загрузить те же файлы снова
                                            if (e.target) {
                                              e.target.value = '';
                                            }
                                          }}
                                        />
                                        <button
                                          type="button"
                                          className="user-dashboard__choose-files-button"
                                          disabled={isUploadingTracks[album.id]}
                                          onClick={() => {
                                            const input = fileInputRefs.current[album.id];
                                            if (input) {
                                              input.click();
                                            }
                                          }}
                                        >
                                          {ui?.dashboard?.chooseFiles ?? 'Choose files'}
                                        </button>
                                      </>
                                    )}
                                  </div>

                                  {/* Tracks list */}
                                  <div className="user-dashboard__tracks-list">
                                    {album.tracks.map((track) => (
                                      <div key={track.id} className="user-dashboard__track-item">
                                        <div className="user-dashboard__track-number">
                                          {track.id.padStart(2, '0')}
                                        </div>
                                        <div className="user-dashboard__track-title">
                                          {track.title}
                                        </div>
                                        <div className="user-dashboard__track-duration-container">
                                          <div className="user-dashboard__track-duration">
                                            {track.duration}
                                          </div>
                                          <button
                                            type="button"
                                            className="user-dashboard__track-delete-button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleDeleteTrack(
                                                album.albumId,
                                                track.id,
                                                track.title
                                              );
                                            }}
                                            title="Удалить трек"
                                            aria-label="Удалить трек"
                                          >
                                            Удалить трек
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>

                                  {/* Lyrics section */}
                                  <div className="user-dashboard__lyrics-section">
                                    <h4 className="user-dashboard__lyrics-title">
                                      {ui?.dashboard?.lyrics ?? 'Lyrics'}
                                    </h4>
                                    <div className="user-dashboard__lyrics-table">
                                      <div className="user-dashboard__lyrics-header">
                                        <div className="user-dashboard__lyrics-header-cell">
                                          {ui?.dashboard?.track ?? 'Track'}
                                        </div>
                                        <div className="user-dashboard__lyrics-header-cell">
                                          {ui?.dashboard?.status ?? 'Status'}
                                        </div>
                                        <div className="user-dashboard__lyrics-header-cell">
                                          {ui?.dashboard?.actions ?? 'Actions'}
                                        </div>
                                      </div>
                                      {album.tracks.map((track) => (
                                        <div key={track.id} className="user-dashboard__lyrics-row">
                                          <div className="user-dashboard__lyrics-cell">
                                            {track.title}
                                          </div>
                                          <div className="user-dashboard__lyrics-cell">
                                            {getLyricsStatusText(track.lyricsStatus)}
                                          </div>
                                          <div className="user-dashboard__lyrics-cell user-dashboard__lyrics-cell--actions">
                                            {getLyricsActions(track.lyricsStatus).map(
                                              (action, idx) => (
                                                <button
                                                  key={idx}
                                                  type="button"
                                                  className="user-dashboard__lyrics-action-button"
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

                                  {/* Delete album button - после блока Lyrics, внизу вправо */}
                                  <div className="user-dashboard__delete-album-container">
                                    <button
                                      type="button"
                                      className="user-dashboard__delete-album-button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteAlbum(album.id);
                                      }}
                                      title="Удалить альбом"
                                      aria-label="Удалить альбом"
                                    >
                                      Удалить альбом
                                    </button>
                                  </div>
                                </div>
                              )}

                              {index < albumsData.length - 1 && (
                                <div className="user-dashboard__album-divider"></div>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </div>

                      <button
                        type="button"
                        className="user-dashboard__upload-button"
                        onClick={() => setEditAlbumModal({ isOpen: true })}
                      >
                        <span>+</span>
                        <span>{ui?.dashboard?.uploadNewAlbum ?? 'Upload New Album'}</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <h3 className="user-dashboard__section-title">
                      {ui?.dashboard?.tabs?.posts ?? 'Posts'}
                    </h3>
                    <div className="user-dashboard__section">
                      <div className="user-dashboard__posts-prompt">
                        <div className="user-dashboard__posts-prompt-text">
                          {ui?.dashboard?.writeAndPublishArticles ?? 'Write and publish articles'}
                        </div>
                        <button type="button" className="user-dashboard__new-post-button">
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
          initialAuthorship={
            editLyricsModal.initialAuthorship ||
            getTrackAuthorship(editLyricsModal.albumId, editLyricsModal.trackId)
          }
          onClose={() => setEditLyricsModal(null)}
          onSave={handleSaveLyrics}
          onPreview={editLyricsModal.trackStatus === 'synced' ? handlePreviewLyrics : undefined}
          onSync={editLyricsModal.trackStatus === 'synced' ? handleSyncLyricsFromEdit : undefined}
        />
      )}

      {/* Preview Lyrics Modal */}
      {previewLyricsModal && (
        <PreviewLyricsModal
          isOpen={previewLyricsModal.isOpen}
          lyrics={previewLyricsModal.lyrics}
          syncedLyrics={previewLyricsModal.syncedLyrics}
          authorship={previewLyricsModal.authorship}
          trackSrc={previewLyricsModal.trackSrc}
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
          onNext={async (formData, updatedAlbum) => {
            if (!editAlbumModal) {
              setEditAlbumModal(null);
              return;
            }

            // Обновляем Redux store из БД
            try {
              console.log('🔄 [UserDashboard] Fetching albums after save...');
              const result = await dispatch(fetchAlbums({ lang, force: true })).unwrap();
              console.log('✅ [UserDashboard] Albums fetched:', {
                count: result?.length || 0,
                albumIds: result?.map((a: IAlbums) => a.albumId) || [],
              });

              // Проверяем, что обновленный альбом действительно пришел с новыми данными
              if (result && result.length > 0) {
                const updatedAlbum = result.find(
                  (a: IAlbums) => a.albumId === editAlbumModal.albumId
                );
                if (updatedAlbum) {
                  console.log('🔍 [UserDashboard] Updated album from fetchAlbums:', {
                    albumId: updatedAlbum.albumId,
                    album: updatedAlbum.album, // Должно быть "32"
                    artist: updatedAlbum.artist,
                    description: updatedAlbum.description?.substring(0, 50) || '',
                    cover: updatedAlbum.cover,
                  });
                } else {
                  console.warn(
                    '⚠️ [UserDashboard] Updated album not found in fetchAlbums result:',
                    {
                      searchedAlbumId: editAlbumModal.albumId,
                      availableIds: result.map((a: IAlbums) => a.albumId),
                    }
                  );
                }
              }

              // Небольшая задержка для гарантии обновления Redux store
              await new Promise((resolve) => setTimeout(resolve, 300));

              // Принудительно обновляем albumsData из результата fetchAlbums
              // Это гарантирует, что все поля будут обновлены сразу после сохранения
              if (result && result.length > 0) {
                console.log('🔄 [UserDashboard] Updating albumsData from fetchAlbums result...');

                // Полностью пересоздаем albumsData из результата, используя ту же логику что и в useEffect
                const transformedAlbums: AlbumData[] = result.map((album: IAlbums) => {
                  const albumId = album.albumId || '';

                  // Обрабатываем release (объект с полем date)
                  let releaseDate: Date | null = null;
                  if (
                    album.release &&
                    typeof album.release === 'object' &&
                    'date' in album.release
                  ) {
                    const dateStr = album.release.date;
                    if (dateStr) {
                      releaseDate = new Date(dateStr);
                    }
                  }

                  // Создаем треки с определением статуса на основе данных из альбома
                  const tracks: TrackData[] = (album.tracks || []).map((track) => {
                    let lyricsStatus: TrackData['lyricsStatus'] = 'empty';
                    if (track.syncedLyrics && track.syncedLyrics.length > 0) {
                      const isActuallySynced = track.syncedLyrics.some(
                        (line) => line.startTime > 0
                      );
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
                      lyricsText: track.content,
                      src: track.src,
                      authorship: (track as any).authorship || undefined,
                    };
                  });

                  return {
                    id: albumId,
                    albumId: album.albumId || albumId, // Сохраняем строковый ID альбома
                    title: album.album,
                    artist: album.artist || '',
                    year: releaseDate ? releaseDate.getFullYear().toString() : '',
                    cover: album.cover || '',
                    coverUpdatedAt: Date.now(), // Обновляем timestamp для принудительной перезагрузки
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

                setAlbumsData(transformedAlbums);
                console.log('✅ [UserDashboard] albumsData updated:', {
                  count: transformedAlbums.length,
                  albumIds: transformedAlbums.map((a) => a.id),
                });
              }

              // Закрываем модальное окно после обновления
              // Небольшая задержка для гарантии обновления UI
              await new Promise((resolve) => setTimeout(resolve, 200));
              setEditAlbumModal(null);
            } catch (error: any) {
              // ConditionError - это нормально, condition отменил запрос
              if (error?.name === 'ConditionError') {
                setEditAlbumModal(null);
                return;
              }
              setEditAlbumModal(null);
            }
          }}
        />
      )}
    </>
  );
}

export default UserDashboard;
