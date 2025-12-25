import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

import type { SupportedLang } from '@shared/model/lang';
import type { IAlbums } from '@models';
import type { RootState } from '@shared/model/appStore/types';
import { createInitialLangState, createLangExtraReducers } from '@shared/lib/redux/createLangSlice';
import { getToken } from '@shared/lib/auth';

import type { AlbumsState } from './types';

const initialState: AlbumsState = createInitialLangState<IAlbums[]>([]);

export const fetchAlbums = createAsyncThunk<
  IAlbums[],
  { lang: SupportedLang; force?: boolean },
  { rejectValue: string; state: RootState }
>(
  'albums/fetchByLang',
  async ({ lang }, { signal, rejectWithValue }) => {
    // Type guard для проверки структуры альбома
    const isValidAlbum = (
      album: unknown
    ): album is {
      albumId: string;
      artist: string;
      album: string;
      fullName?: string;
      description?: string;
      cover?: string;
      release?: unknown;
      buttons?: unknown;
      details?: unknown[];
      tracks?: unknown[];
    } => {
      return (
        typeof album === 'object' &&
        album !== null &&
        'albumId' in album &&
        'artist' in album &&
        'album' in album &&
        typeof (album as { albumId: unknown }).albumId === 'string' &&
        typeof (album as { artist: unknown }).artist === 'string' &&
        typeof (album as { album: unknown }).album === 'string'
      );
    };

    // Type guard для проверки структуры трека
    const isValidTrack = (
      track: unknown
    ): track is {
      id: string | number;
      title: string;
      duration?: number;
      src?: string;
      content?: string;
      authorship?: string;
      syncedLyrics?: unknown;
    } => {
      return (
        typeof track === 'object' &&
        track !== null &&
        'id' in track &&
        'title' in track &&
        typeof (track as { title: unknown }).title === 'string'
      );
    };

    const normalize = (data: unknown[]): IAlbums[] => {
      if (!Array.isArray(data)) {
        console.warn('⚠️ normalize: data is not an array', data);
        return [];
      }

      return data.filter(isValidAlbum).map((album) => {
        const tracks = Array.isArray(album.tracks)
          ? album.tracks.filter(isValidTrack).map((track) => {
              const normalizedTrack = {
                id: typeof track.id === 'number' ? track.id : parseInt(String(track.id), 10) || 0,
                title: track.title,
                duration: track.duration,
                src: track.src,
                content: track.content,
                authorship: track.authorship,
                syncedLyrics: track.syncedLyrics,
              };

              // 🔍 DEBUG: Логируем первый трек первого альбома для диагностики
              if (
                album === data[0] &&
                album.tracks &&
                album.tracks.length > 0 &&
                track === album.tracks[0]
              ) {
                console.log('[albumsSlice] normalize: первый трек после нормализации:', {
                  albumId: album.albumId,
                  track: {
                    id: normalizedTrack.id,
                    title: normalizedTrack.title,
                    hasDuration: 'duration' in normalizedTrack,
                    duration: normalizedTrack.duration,
                    durationType: typeof normalizedTrack.duration,
                  },
                });
              }

              return normalizedTrack;
            })
          : [];

        return {
          albumId: album.albumId,
          artist: album.artist,
          album: album.album,
          fullName: album.fullName || `${album.artist} — ${album.album}`,
          description: album.description || '',
          cover: album.cover || '',
          release: album.release || {},
          buttons: album.buttons || {},
          details: Array.isArray(album.details) ? album.details : [],
          tracks,
        } as IAlbums;
      });
    };

    try {
      // 1) Сначала пытаемся загрузить из БД через API (приоритет)
      // Добавляем таймаут 8 секунд для запроса к API
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 секунд таймаут

        // Привязываем внешний signal к controller
        if (signal) {
          if (signal.aborted) {
            controller.abort();
          } else {
            signal.addEventListener('abort', () => controller.abort(), { once: true });
          }
        }

        // ВАЖНО: Добавляем токен авторизации, чтобы сервер вернул пользовательские альбомы
        // Без токена сервер возвращает только публичные альбомы (user_id IS NULL)
        const token = getToken();
        const headers: Record<string, string> = {
          'Cache-Control': 'no-cache',
        };
        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }

        const response = await fetch(`/api/albums?lang=${lang}`, {
          signal: controller.signal,
          cache: 'no-store',
          headers,
        });

        clearTimeout(timeoutId);

        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/0d98fd1d-24ff-4297-901e-115ee9f70125', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            location: 'albumsSlice.ts:151',
            message: 'Albums API response',
            data: {
              status: response.status,
              ok: response.ok,
              statusText: response.statusText,
              hasToken: !!token,
            },
            timestamp: Date.now(),
            sessionId: 'debug-session',
            runId: 'run1',
            hypothesisId: 'I',
          }),
        }).catch(() => {});
        // #endregion

        if (response.ok) {
          const result = await response.json();

          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/0d98fd1d-24ff-4297-901e-115ee9f70125', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              location: 'albumsSlice.ts:159',
              message: 'Albums API result',
              data: {
                hasSuccess: result.success,
                hasData: !!result.data,
                dataIsArray: Array.isArray(result.data),
                dataLength: Array.isArray(result.data) ? result.data.length : 0,
                firstAlbum:
                  Array.isArray(result.data) && result.data[0]
                    ? { albumId: result.data[0].albumId, artist: result.data[0].artist }
                    : null,
              },
              timestamp: Date.now(),
              sessionId: 'debug-session',
              runId: 'run1',
              hypothesisId: 'I',
            }),
          }).catch(() => {});
          // #endregion

          if (result.success && result.data && Array.isArray(result.data)) {
            // Если данных нет, возвращаем пустой массив
            if (result.data.length === 0) {
              // #region agent log
              fetch('http://127.0.0.1:7242/ingest/0d98fd1d-24ff-4297-901e-115ee9f70125', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  location: 'albumsSlice.ts:164',
                  message: 'Albums API returned empty array',
                  data: {},
                  timestamp: Date.now(),
                  sessionId: 'debug-session',
                  runId: 'run1',
                  hypothesisId: 'I',
                }),
              }).catch(() => {});
              // #endregion
              return [];
            }

            // 🔍 DEBUG: Проверяем наличие duration в данных из API
            const firstAlbum = result.data[0];
            const firstTrack = firstAlbum?.tracks?.[0];
            console.log('[albumsSlice] ✅ Данные из API:', {
              source: 'API',
              albumsCount: result.data.length,
              firstAlbumId: firstAlbum?.albumId,
              firstTrack: firstTrack
                ? {
                    id: firstTrack.id,
                    title: firstTrack.title,
                    hasDuration: 'duration' in firstTrack,
                    duration: firstTrack.duration,
                    durationType: typeof firstTrack.duration,
                  }
                : null,
            });

            // Преобразуем данные из API в формат IAlbums
            return normalize(result.data);
          }
        }
      } catch (apiError) {
        // Если API недоступен или таймаут, пробуем fallback на статику
        if (apiError instanceof Error && apiError.name === 'AbortError') {
          console.warn('⚠️ API request timeout (8s), trying fallback to static JSON');
        } else {
          console.warn('⚠️ API unavailable, trying fallback to static JSON:', apiError);
        }
      }

      // 2) Фолбэк на статический JSON (если БД недоступна)
      try {
        const fallback = await fetch(`/assets/albums-${lang}.json`, { signal });
        if (fallback.ok) {
          const data = await fallback.json();
          if (Array.isArray(data)) {
            // 🔍 DEBUG: Проверяем наличие duration в статическом JSON
            const firstAlbum = data[0];
            const firstTrack = firstAlbum?.tracks?.[0];
            console.warn('[albumsSlice] ⚠️ Используется статический JSON (fallback):', {
              source: 'STATIC_JSON',
              albumsCount: data.length,
              firstAlbumId: firstAlbum?.albumId,
              firstTrack: firstTrack
                ? {
                    id: firstTrack.id,
                    title: firstTrack.title,
                    hasDuration: 'duration' in firstTrack,
                    duration: firstTrack.duration,
                    durationType: typeof firstTrack.duration,
                  }
                : null,
            });

            return normalize(data);
          }
        }
      } catch (fallbackError) {
        console.warn('⚠️ Static JSON fallback also unavailable:', fallbackError);
      }

      // Если оба источника недоступны
      throw new Error('Failed to fetch albums from both API and static JSON');
    } catch (error) {
      if (error instanceof Error) {
        return rejectWithValue(error.message);
      }
      return rejectWithValue('Unknown error');
    }
  },
  {
    condition: ({ lang, force }, { getState }) => {
      const entry = getState().albums[lang];

      // Всегда блокируем параллельные запросы
      if (entry.status === 'loading') return false;

      // Блокируем повторный запуск только если НЕ force
      if (entry.status === 'succeeded' && !force) return false;

      return true;
    },
  }
);

const albumsSlice = createSlice({
  name: 'albums',
  initialState,
  reducers: {},
  extraReducers: createLangExtraReducers(fetchAlbums, 'Failed to fetch albums'),
});

export const albumsReducer = albumsSlice.reducer;
