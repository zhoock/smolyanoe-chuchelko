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
    try {
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
      const albums: IAlbums[] = result.data.map(
        (album: {
          albumId: string;
          artist: string;
          album: string;
          fullName: string;
          description: string;
          cover: unknown;
          release: unknown;
          buttons: unknown;
          details: unknown;
          tracks: Array<{
            id: string;
            title: string;
            duration?: number;
            src?: string;
            content?: string;
            authorship?: string;
            syncedLyrics?: unknown;
          }>;
        }) => ({
          albumId: album.albumId,
          artist: album.artist,
          album: album.album,
          fullName: album.fullName,
          description: album.description,
          cover: album.cover,
          release: album.release,
          buttons: album.buttons,
          details: album.details,
          tracks: album.tracks.map((track) => ({
            id: track.id,
            title: track.title,
            duration: track.duration,
            src: track.src,
            content: track.content,
            authorship: track.authorship,
            syncedLyrics: track.syncedLyrics,
          })),
        })
      );

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
  extraReducers: createLangExtraReducers(fetchAlbums, 'Failed to fetch albums'),
});

export const albumsReducer = albumsSlice.reducer;
