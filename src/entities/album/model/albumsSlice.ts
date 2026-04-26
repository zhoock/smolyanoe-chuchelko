import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

import type { IAlbums, IAlbumTranslations, IAlbumTrackTranslations } from '@models';
import { normalizeTrackIdString } from '@shared/lib/tracks/normalizeTrackIdString';
import type { RootState } from '@shared/model/appStore/types';
import { getToken } from '@shared/lib/auth';
import { buildApiUrl } from '@shared/lib/artistQuery';
import { selectPublicArtistSlug } from '@shared/model/currentArtist';

import type { AlbumsState, FetchAlbumsFulfilledPayload } from './types';

const initialState: AlbumsState = {
  status: 'idle',
  error: null,
  data: [],
  lastUpdated: null,
  fetchContextKey: null,
};

/** Ключ кэша списка альбомов: дашборд / публичный artist / без artist. */
function getAlbumsFetchContextKey(getState: () => RootState): string {
  if (typeof window === 'undefined') {
    return 'ssr';
  }
  const onDashboardUrl = window.location.pathname.startsWith('/dashboard');
  if (onDashboardUrl) return 'dashboard';
  const publicSlug = selectPublicArtistSlug(getState())?.trim() ?? '';
  return publicSlug ? `public:${publicSlug}` : 'public:no-slug';
}

function wrapAlbumsResult(albums: IAlbums[], fetchContextKey: string): FetchAlbumsFulfilledPayload {
  return { albums, fetchContextKey };
}

function staleSnapshotPayload(getState: () => RootState): FetchAlbumsFulfilledPayload {
  const s = getState().albums;
  return {
    albums: s.data,
    fetchContextKey: s.fetchContextKey ?? 'stale-keep',
    staleAbort: true,
  };
}

function albumHasDisplayableTitle(album: {
  album?: unknown;
  translations?: IAlbumTranslations;
}): boolean {
  const root = typeof album.album === 'string' ? album.album.trim() : '';
  if (root) return true;
  const en = album.translations?.en?.album?.trim() ?? '';
  const ru = album.translations?.ru?.album?.trim() ?? '';
  return Boolean(en || ru);
}

export const fetchAlbums = createAsyncThunk<
  FetchAlbumsFulfilledPayload,
  { force?: boolean },
  { rejectValue: string; state: RootState }
>(
  'albums/fetchMerged',
  async (_arg, { signal, rejectWithValue, getState }) => {
    const isValidAlbum = (
      album: unknown
    ): album is {
      userId?: string;
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
      translations?: IAlbumTranslations;
    } => {
      if (typeof album !== 'object' || album === null) return false;
      if (!('albumId' in album) || !('artist' in album)) return false;
      if (typeof (album as { albumId: unknown }).albumId !== 'string') return false;
      if (typeof (album as { artist: unknown }).artist !== 'string') return false;
      return albumHasDisplayableTitle(
        album as { album?: unknown; translations?: IAlbumTranslations }
      );
    };

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
      translations?: IAlbumTrackTranslations;
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
          ? album.tracks.filter(isValidTrack).flatMap((track, idx) => {
              const id = normalizeTrackIdString(track.id);
              if (!id) return [];

              const rawOrder = (track as { order_index?: unknown }).order_index;
              const order_index =
                typeof rawOrder === 'number' && !Number.isNaN(rawOrder) ? rawOrder : idx;

              const normalizedTrack = {
                id,
                title: track.title,
                order_index,
                duration: track.duration,
                src: track.src ?? '',
                content: track.content ?? '',
                authorship: track.authorship,
                syncedLyrics: track.syncedLyrics,
                translations: track.translations,
              };

              if (normalizedTrack.duration == null) {
                console.warn(
                  `[albumsSlice] ⚠️ Track ${normalizedTrack.id} (${normalizedTrack.title}) in album ${album.albumId} has no duration`
                );
              }

              return [normalizedTrack];
            })
          : [];

        const rawAlbum = album as Record<string, unknown>;
        return {
          userId: album.userId,
          dbAlbumId: typeof rawAlbum.dbAlbumId === 'string' ? rawAlbum.dbAlbumId : undefined,
          albumId: album.albumId,
          artist: album.artist,
          album: album.album,
          fullName: album.fullName || `${album.artist} — ${album.album}`,
          description: album.description || '',
          cover: album.cover || '',
          release: album.release || {},
          buttons: album.buttons || {},
          details: Array.isArray(album.details) ? album.details : [],
          isPublic: (album as { isPublic?: boolean }).isPublic,
          translations: album.translations,
          tracks,
        } as IAlbums;
      });
    };

    try {
      const isDashboardRoute =
        typeof window !== 'undefined' && window.location.pathname.startsWith('/dashboard');
      const publicSlug = selectPublicArtistSlug(getState())?.trim() ?? '';
      /** Снимок контекста на старте запроса (не пересчитывать в fulfilled после смены маршрута). */
      const requestFetchKey = getAlbumsFetchContextKey(getState);

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        if (signal) {
          if (signal.aborted) {
            controller.abort();
          } else {
            signal.addEventListener('abort', () => controller.abort(), { once: true });
          }
        }

        // Публичный каталог: без public slug API не вызываем (нужен контекст артиста).
        if (!isDashboardRoute && !publicSlug) {
          if (getAlbumsFetchContextKey(getState) !== requestFetchKey) {
            return staleSnapshotPayload(getState);
          }
          return wrapAlbumsResult([], requestFetchKey);
        }

        const token = getToken();
        const headers: Record<string, string> = {
          'Cache-Control': 'no-cache',
        };
        if (isDashboardRoute && token) {
          headers.Authorization = `Bearer ${token}`;
        }

        const response = await fetch(
          buildApiUrl(
            '/api/albums',
            {},
            {
              includeArtist: !isDashboardRoute,
              artistSlugOverride: isDashboardRoute ? null : publicSlug,
            }
          ),
          {
            signal: controller.signal,
            cache: 'no-store',
            headers,
          }
        );

        clearTimeout(timeoutId);
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data && Array.isArray(result.data)) {
            if (result.data.length === 0) {
              if (getAlbumsFetchContextKey(getState) !== requestFetchKey) {
                return staleSnapshotPayload(getState);
              }
              return wrapAlbumsResult([], requestFetchKey);
            }

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

            if (getAlbumsFetchContextKey(getState) !== requestFetchKey) {
              return staleSnapshotPayload(getState);
            }
            return wrapAlbumsResult(normalize(result.data), requestFetchKey);
          }
          throw new Error('Failed to fetch albums. Invalid response format.');
        }
        throw new Error(`Failed to fetch albums. Status: ${response.status}`);
      } catch (apiError) {
        if (isDashboardRoute) {
          console.error('❌ [albumsSlice] albums API failed in /dashboard', apiError);
        } else if (apiError instanceof Error && apiError.name === 'AbortError') {
          console.warn('⚠️ [albumsSlice] API request timeout (8s)', apiError);
        } else {
          console.warn('⚠️ [albumsSlice] albums API failed', apiError);
        }
        throw apiError instanceof Error ? apiError : new Error(String(apiError));
      }
    } catch (error) {
      if (error instanceof Error) {
        return rejectWithValue(error.message);
      }
      return rejectWithValue('Unknown error');
    }
  },
  {
    condition: ({ force }, { getState }) => {
      const { status } = getState().albums;

      if (status === 'loading' && !force) return false;

      if (status === 'succeeded' && !force) return false;

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
      .addCase(fetchAlbums.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchAlbums.fulfilled, (state, action) => {
        // Устаревший HTTP-ответ не трогаем: иначе при двух запросах (public + dashboard)
        // сброс в succeeded до завершения актуального запроса.
        if (action.payload.staleAbort) {
          return;
        }
        state.data = [...action.payload.albums];
        state.fetchContextKey = action.payload.fetchContextKey;
        state.status = 'succeeded';
        state.error = null;
        state.lastUpdated = Date.now();
      })
      .addCase(fetchAlbums.rejected, (state, action) => {
        let errorText = 'Failed to fetch albums';
        if (action.payload) {
          errorText = action.payload;
        } else if (action.error && typeof action.error === 'object' && 'message' in action.error) {
          errorText = String((action.error as { message?: string }).message || errorText);
        }
        if (state.data.length > 0) {
          state.status = 'succeeded';
          state.error = null;
          return;
        }
        state.status = 'failed';
        state.error = errorText;
      });
  },
});

export const albumsReducer = albumsSlice.reducer;
