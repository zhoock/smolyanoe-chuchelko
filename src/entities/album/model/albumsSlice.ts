import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

import type { SupportedLang } from '@shared/model/lang';
import type { IAlbums } from '@models';
import type { RootState } from '@shared/model/appStore/types';
import { createInitialLangState, createLangExtraReducers } from '@shared/lib/redux/createLangSlice';

import type { AlbumsState } from './types';

const initialState: AlbumsState = createInitialLangState<IAlbums[]>([]);

export const fetchAlbums = createAsyncThunk<
  IAlbums[],
  { lang: SupportedLang; force?: boolean },
  { rejectValue: string; state: RootState }
>(
  'albums/fetchByLang',
  async ({ lang }, { signal, rejectWithValue }) => {
    const normalize = (data: any[]): IAlbums[] =>
      data.map(
        (album: any) =>
          ({
            albumId: album.albumId,
            artist: album.artist,
            album: album.album,
            fullName: album.fullName,
            description: album.description,
            cover: album.cover,
            release: album.release,
            buttons: album.buttons,
            details: album.details,
            tracks: (album.tracks ?? []).map((track: any) => ({
              id: track.id,
              title: track.title,
              duration: track.duration,
              src: track.src,
              content: track.content,
              authorship: track.authorship,
              syncedLyrics: track.syncedLyrics,
            })),
          }) as IAlbums
      );

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

        const response = await fetch(`/api/albums?lang=${lang}`, {
          signal: controller.signal,
          cache: 'no-cache',
          headers: {
            'Cache-Control': 'no-cache',
          },
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const result = await response.json();

          if (result.success && result.data && Array.isArray(result.data)) {
            // Если данных нет, возвращаем пустой массив
            if (result.data.length === 0) {
              return [];
            }

            // Преобразуем данные из API в формат IAlbums
            console.log('✅ Loaded albums from API');

            // 🔍 DEBUG: Проверяем cover для первого альбома
            if (result.data.length > 0) {
              const firstAlbum = result.data[0];
              console.log('🔍 [DEBUG] First album cover from API:', {
                albumId: firstAlbum.albumId,
                cover: firstAlbum.cover,
                coverType: typeof firstAlbum.cover,
                coverUndefined: firstAlbum.cover === undefined,
                coverNull: firstAlbum.cover === null,
                coverEmpty: firstAlbum.cover === '',
              });
            }

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
            console.log('✅ Loaded albums from static JSON fallback');
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
