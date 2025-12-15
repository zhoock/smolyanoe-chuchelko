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
      // Используем только статический JSON, без обращения к API/БД
      const fallback = await fetch(`/assets/albums-${lang}.json`, { signal });
      if (fallback.ok) {
        const data = await fallback.json();
        if (Array.isArray(data)) {
          console.log('✅ Loaded albums from static JSON (DB disabled)');
          return normalize(data);
        }
      }
      throw new Error('Static JSON unavailable');
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Unknown error');
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
