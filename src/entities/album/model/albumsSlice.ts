import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

import type { IAlbums, IAlbumTranslations, IAlbumTrackTranslations } from '@models';
import { normalizeTrackIdString } from '@shared/lib/tracks/normalizeTrackIdString';
import type { RootState } from '@shared/model/appStore/types';
import { getToken } from '@shared/lib/auth';
import { buildApiUrl } from '@shared/lib/artistQuery';
import { isDashboardPathname } from '@shared/lib/publicArtistContext';
import { selectPublicArtistSlug } from '@shared/model/currentArtist';

import type { AlbumsState, FetchAlbumsFulfilledPayload } from './types';

const initialState: AlbumsState = {
  status: 'idle',
  error: null,
  data: [],
  lastUpdated: null,
  fetchContextKey: null,
  inFlightFetchContextKey: null,
  dashboard: {
    status: 'idle',
    error: null,
    data: [],
    lastUpdated: null,
    inFlightFetchContextKey: null,
  },
};

/** Ключ кэша публичного каталога в `data` (artist slug из store / фон под модалкой). */
function getCatalogAlbumsFetchContextKey(getState: () => RootState): string {
  if (typeof window === 'undefined') {
    return 'ssr';
  }
  const publicSlug = selectPublicArtistSlug(getState())?.trim() ?? '';
  return publicSlug ? `public:${publicSlug}` : 'public:no-slug';
}

function wrapAlbumsResult(
  albums: IAlbums[],
  fetchContextKey: string,
  writeTarget: 'catalog' | 'dashboard'
): FetchAlbumsFulfilledPayload {
  return { albums, fetchContextKey, writeTarget };
}

function staleSnapshotPayload(
  getState: () => RootState,
  target: 'catalog' | 'dashboard'
): FetchAlbumsFulfilledPayload {
  const s = getState().albums;
  if (target === 'dashboard') {
    return {
      albums: s.dashboard.data,
      fetchContextKey: 'dashboard',
      staleAbort: true,
      writeTarget: 'dashboard',
    };
  }
  return {
    albums: s.data,
    fetchContextKey: s.fetchContextKey ?? 'stale-keep',
    staleAbort: true,
    writeTarget: 'catalog',
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
      const isDashboardRoute = isDashboardPathname();
      const publicSlug = selectPublicArtistSlug(getState())?.trim() ?? '';
      const requestWasDashboard = isDashboardRoute;
      const requestFetchKey = requestWasDashboard
        ? 'dashboard'
        : getCatalogAlbumsFetchContextKey(getState);
      const writeTarget: 'catalog' | 'dashboard' = requestWasDashboard ? 'dashboard' : 'catalog';

      const catalogStale = (): boolean =>
        getCatalogAlbumsFetchContextKey(getState) !== requestFetchKey;

      const dashboardStale = (): boolean => !isDashboardPathname();

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

        const token = getToken();

        // Кабинет без JWT: иначе GET /api/albums без ?artist= → 400 на бэкенде.
        if (isDashboardRoute && !token) {
          if (dashboardStale()) {
            return staleSnapshotPayload(getState, 'dashboard');
          }
          return wrapAlbumsResult([], 'dashboard', 'dashboard');
        }

        // Публичный каталог: без public slug API не вызываем (нужен контекст артиста).
        if (!isDashboardRoute && !publicSlug) {
          if (catalogStale()) {
            return staleSnapshotPayload(getState, 'catalog');
          }
          return wrapAlbumsResult([], requestFetchKey, 'catalog');
        }

        const headers: Record<string, string> = {
          'Cache-Control': 'no-cache',
        };
        if (token) {
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
              if (requestWasDashboard) {
                if (dashboardStale()) {
                  return staleSnapshotPayload(getState, 'dashboard');
                }
              } else if (catalogStale()) {
                return staleSnapshotPayload(getState, 'catalog');
              }
              return wrapAlbumsResult([], requestFetchKey, writeTarget);
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

            if (requestWasDashboard) {
              if (dashboardStale()) {
                return staleSnapshotPayload(getState, 'dashboard');
              }
            } else if (catalogStale()) {
              return staleSnapshotPayload(getState, 'catalog');
            }
            return wrapAlbumsResult(normalize(result.data), requestFetchKey, writeTarget);
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
      const albums = getState().albums;
      const onDashboard = isDashboardPathname();

      if (onDashboard) {
        const { status } = albums.dashboard;
        if (status === 'loading' && !force) return false;
        if (status === 'succeeded' && !force) return false;
        return true;
      }

      const { status } = albums;
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
        const onDashboard = isDashboardPathname();
        if (onDashboard) {
          state.dashboard.status = 'loading';
          state.dashboard.error = null;
          state.dashboard.inFlightFetchContextKey = 'dashboard';
        } else {
          state.status = 'loading';
          state.error = null;
          state.inFlightFetchContextKey = 'public';
        }
      })
      .addCase(fetchAlbums.fulfilled, (state, action) => {
        const target = action.payload.writeTarget ?? 'catalog';
        if (action.payload.staleAbort) {
          if (target === 'dashboard') {
            state.dashboard.inFlightFetchContextKey = null;
          } else {
            state.inFlightFetchContextKey = null;
          }
          return;
        }
        if (target === 'dashboard') {
          state.dashboard.data = [...action.payload.albums];
          state.dashboard.status = 'succeeded';
          state.dashboard.error = null;
          state.dashboard.lastUpdated = Date.now();
          state.dashboard.inFlightFetchContextKey = null;
          return;
        }
        state.data = [...action.payload.albums];
        state.fetchContextKey = action.payload.fetchContextKey;
        state.status = 'succeeded';
        state.error = null;
        state.lastUpdated = Date.now();
        state.inFlightFetchContextKey = null;
      })
      .addCase(fetchAlbums.rejected, (state, action) => {
        let errorText = 'Failed to fetch albums';
        if (action.payload) {
          errorText = action.payload;
        } else if (action.error && typeof action.error === 'object' && 'message' in action.error) {
          errorText = String((action.error as { message?: string }).message || errorText);
        }

        const dashInFlight = state.dashboard.inFlightFetchContextKey != null;
        const catInFlight = state.inFlightFetchContextKey != null;

        if (dashInFlight) {
          state.dashboard.inFlightFetchContextKey = null;
          if (state.dashboard.data.length > 0) {
            state.dashboard.status = 'succeeded';
            state.dashboard.error = null;
          } else {
            state.dashboard.status = 'failed';
            state.dashboard.error = errorText;
          }
        }

        if (catInFlight) {
          state.inFlightFetchContextKey = null;
          if (state.data.length > 0) {
            state.status = 'succeeded';
            state.error = null;
          } else {
            state.status = 'failed';
            state.error = errorText;
          }
        }
      });
  },
});

export const albumsReducer = albumsSlice.reducer;
