import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

import { getJSON } from '@shared/api/http';
import type { SupportedLang } from '@shared/model/lang';
import type { IAlbums } from '@models';
import type { RootState } from '@shared/model/appStore/types';

import type { AlbumsEntry, AlbumsState } from './types';

const createInitialEntry = (): AlbumsEntry => ({
  status: 'idle',
  error: null,
  data: [],
  lastUpdated: null,
});

const initialState: AlbumsState = {
  en: createInitialEntry(),
  ru: createInitialEntry(),
};

export const fetchAlbums = createAsyncThunk<
  IAlbums[],
  { lang: SupportedLang },
  { rejectValue: string; state: RootState }
>(
  'albums/fetchByLang',
  async ({ lang }, { signal, rejectWithValue }) => {
    try {
      // Сначала пытаемся загрузить из БД через API
      try {
        const response = await fetch(`/api/albums?lang=${lang}`, {
          signal,
          cache: 'no-cache',
          headers: {
            'Cache-Control': 'no-cache',
          },
        });

        if (response.ok) {
          const result = await response.json();
          if (
            result.success &&
            result.data &&
            Array.isArray(result.data) &&
            result.data.length > 0
          ) {
            // Преобразуем данные из API в формат IAlbums
            const albums: IAlbums[] = result.data.map((album: any) => ({
              albumId: album.albumId,
              artist: album.artist,
              album: album.album,
              fullName: album.fullName,
              description: album.description,
              cover: album.cover,
              release: album.release,
              buttons: album.buttons,
              details: album.details,
              tracks: album.tracks.map((track: any) => ({
                id: track.id,
                title: track.title,
                duration: track.duration,
                src: track.src,
                content: track.content,
                authorship: track.authorship,
                syncedLyrics: track.syncedLyrics,
              })),
            }));
            return albums;
          }
        }
      } catch (apiError) {
        // Если API недоступен, используем fallback на JSON
        console.warn('⚠️ API недоступен, используем JSON fallback:', apiError);
      }

      // Fallback: загружаем из JSON (для обратной совместимости)
      const albums = await getJSON<IAlbums[]>(`albums-${lang}.json`, signal);
      return albums;
    } catch (error) {
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
  extraReducers: (builder) => {
    builder
      .addCase(fetchAlbums.pending, (state, action) => {
        const { lang } = action.meta.arg;
        const entry = state[lang];
        entry.status = 'loading';
        entry.error = null;
      })
      .addCase(fetchAlbums.fulfilled, (state, action) => {
        const { lang } = action.meta.arg;
        const entry = state[lang];
        entry.data = action.payload;
        entry.status = 'succeeded';
        entry.error = null;
        entry.lastUpdated = Date.now();
      })
      .addCase(fetchAlbums.rejected, (state, action) => {
        const { lang } = action.meta.arg;
        const entry = state[lang];
        entry.status = 'failed';
        entry.error = action.payload ?? action.error.message ?? 'Failed to fetch albums';
      });
  },
});

export const albumsReducer = albumsSlice.reducer;
