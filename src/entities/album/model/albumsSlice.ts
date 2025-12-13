import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

import type { SupportedLang } from '@shared/model/lang';
import type { IAlbums } from '@models';
import type { RootState } from '@shared/model/appStore/types';
import { createInitialLangState, createLangExtraReducers } from '@shared/lib/redux/createLangSlice';

import type { AlbumsState } from './types';

const initialState: AlbumsState = createInitialLangState<IAlbums[]>([]);

export const fetchAlbums = createAsyncThunk<
  IAlbums[],
  { lang: SupportedLang },
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
      // 1) Быстрый фолбэк на статику (без запроса к API)
      try {
        const fallback = await fetch(`/assets/albums-${lang}.json`, { signal });
        if (fallback.ok) {
          const data = await fallback.json();
          if (Array.isArray(data)) {
            return normalize(data);
          }
        }
      } catch {
        // игнорируем и пробуем API
      }

      // Загружаем из БД через API
      const response = await fetch(`/api/albums?lang=${lang}`, {
        signal,
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch albums. Status: ${response.status}`);
      }

      const result = await response.json();

      if (!result.success || !result.data || !Array.isArray(result.data)) {
        throw new Error('Invalid response from API');
      }

      // Если данных нет, возвращаем пустой массив
      if (result.data.length === 0) {
        return [];
      }

      // Преобразуем данные из API в формат IAlbums
      return normalize(result.data);
    } catch (error) {
      // Если статический фолбэк тоже недоступен – отдаём ошибку
      if (error instanceof Error) {
        return rejectWithValue(error.message);
      }
      return rejectWithValue('Unknown error');
    }
  },
  {
    condition: ({ lang }, { getState }) => {
      const state = getState();
      const entry = state.albums[lang];
      // Не запускаем, если уже загружается или уже загружено
      if (entry.status === 'loading' || entry.status === 'succeeded') {
        return false;
      }
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
