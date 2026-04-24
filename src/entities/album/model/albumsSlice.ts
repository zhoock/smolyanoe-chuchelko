import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

import type { SupportedLang } from '@shared/model/lang';
import type {
  IAlbums,
  IAlbumTranslations,
  IAlbumTrackTranslations,
  SyncedLyricsLine,
} from '@models';
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
  const isDashboardRoute = window.location.pathname.startsWith('/dashboard');
  const publicSlug = selectPublicArtistSlug(getState())?.trim() ?? '';
  if (isDashboardRoute) return 'dashboard';
  return publicSlug ? `public:${publicSlug}` : 'public:no-slug';
}

function wrapAlbumsResult(
  albums: IAlbums[],
  getState: () => RootState
): FetchAlbumsFulfilledPayload {
  return { albums, fetchContextKey: getAlbumsFetchContextKey(getState) };
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

function wrapLegacyAlbumsWithTranslations(albums: unknown[], locale: SupportedLang): unknown[] {
  return albums.map((raw) => {
    if (typeof raw !== 'object' || raw === null) return raw;
    const a = raw as Record<string, unknown>;
    if (a.translations && typeof a.translations === 'object') return raw;
    return {
      ...a,
      translations: {
        [locale]: {
          fullName: String(a.fullName ?? ''),
          description: String(a.description ?? ''),
          details: Array.isArray(a.details) ? a.details : [],
        },
      },
    };
  });
}

function mergeLegacyStaticAlbumsById(enAlbums: unknown[], ruAlbums: unknown[]): unknown[] {
  const ruById = new Map<string, Record<string, unknown>>();
  for (const r of ruAlbums) {
    if (typeof r === 'object' && r !== null && 'albumId' in r) {
      ruById.set(String((r as { albumId: string }).albumId), r as Record<string, unknown>);
    }
  }

  return enAlbums.map((enRaw) => {
    const wrappedEn = wrapLegacyAlbumsWithTranslations([enRaw], 'en')[0] as Record<string, unknown>;
    const id = String(wrappedEn.albumId ?? '');
    const ruRec = ruById.get(id);
    if (!ruRec) return wrappedEn;

    const wrappedRu = wrapLegacyAlbumsWithTranslations([ruRec], 'ru')[0] as Record<string, unknown>;
    const enTr = (wrappedEn.translations as Record<string, unknown>)?.en as Record<string, unknown>;
    const ruTr = (wrappedRu.translations as Record<string, unknown>)?.ru as Record<string, unknown>;

    const enTracks = (wrappedEn.tracks as unknown[]) || [];
    const ruTracks = (wrappedRu.tracks as unknown[]) || [];
    const ruTrackById = new Map<string, Record<string, unknown>>();
    for (const t of ruTracks) {
      if (typeof t === 'object' && t !== null && 'id' in t) {
        ruTrackById.set(String((t as { id: string | number }).id), t as Record<string, unknown>);
      }
    }

    const mergedTracks = enTracks.map((tr) => {
      if (typeof tr !== 'object' || tr === null) return tr;
      const row = tr as Record<string, unknown>;
      const tid = String(row.id ?? '');
      const ruT = ruTrackById.get(tid);
      const translations: IAlbumTrackTranslations = {
        en: {
          title: String(row.title ?? ''),
          content: typeof row.content === 'string' ? row.content : undefined,
          authorship: typeof row.authorship === 'string' ? row.authorship : undefined,
          syncedLyrics: row.syncedLyrics as SyncedLyricsLine[] | undefined,
        },
      };
      if (ruT) {
        translations.ru = {
          title: String(ruT.title ?? ''),
          content: typeof ruT.content === 'string' ? ruT.content : undefined,
          authorship: typeof ruT.authorship === 'string' ? ruT.authorship : undefined,
          syncedLyrics: ruT.syncedLyrics as SyncedLyricsLine[] | undefined,
        };
      }
      return { ...row, translations };
    });

    return {
      ...wrappedEn,
      translations: { en: enTr, ru: ruTr },
      tracks: mergedTracks,
    };
  });
}

async function loadStaticAlbumsFallback(signal: AbortSignal): Promise<unknown[]> {
  const loadArr = async (url: string): Promise<unknown[] | null> => {
    const r = await fetch(url, { signal });
    if (!r?.ok) return null;
    const j: unknown = await r.json();
    return Array.isArray(j) ? j : null;
  };
  const en = await loadArr('/assets/albums-en.json');
  const ru = await loadArr('/assets/albums-ru.json');
  if (en && ru) return mergeLegacyStaticAlbumsById(en, ru);
  if (en) return wrapLegacyAlbumsWithTranslations(en, 'en');
  if (ru) return wrapLegacyAlbumsWithTranslations(ru, 'ru');
  return [];
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

        // Публичный каталог: без artist не дергаем API (инвариант), только статический fallback.
        if (!isDashboardRoute && !publicSlug) {
          try {
            const data = await loadStaticAlbumsFallback(signal);
            if (Array.isArray(data) && data.length > 0) {
              console.warn('[albumsSlice] ⚠️ Используется статический JSON (нет artist в store)');
              return wrapAlbumsResult(normalize(data), getState);
            }
            return wrapAlbumsResult([], getState);
          } catch (fallbackError) {
            console.warn('⚠️ Static JSON fallback unavailable:', fallbackError);
            return wrapAlbumsResult([], getState);
          }
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
              includeArtist: true,
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
              return wrapAlbumsResult([], getState);
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

            return wrapAlbumsResult(normalize(result.data), getState);
          }
          throw new Error('Failed to fetch albums. Invalid response format.');
        }
        throw new Error(`Failed to fetch albums. Status: ${response.status}`);
      } catch (apiError) {
        if (isDashboardRoute) {
          console.error(
            '❌ [albumsSlice] albums API failed in /dashboard; static JSON fallback is disabled',
            apiError
          );
          throw apiError instanceof Error ? apiError : new Error(String(apiError));
        }
        if (apiError instanceof Error && apiError.name === 'AbortError') {
          console.warn('⚠️ API request timeout (8s), trying fallback to static JSON');
        } else {
          console.warn('⚠️ API unavailable, trying fallback to static JSON:', apiError);
        }
      }

      if (!isDashboardRoute) {
        try {
          const data = await loadStaticAlbumsFallback(signal);
          if (Array.isArray(data) && data.length > 0) {
            console.warn('[albumsSlice] ⚠️ Используется статический JSON (fallback)');
            return wrapAlbumsResult(normalize(data), getState);
          }
        } catch (fallbackError) {
          console.warn('⚠️ Static JSON fallback also unavailable:', fallbackError);
        }
      }

      throw new Error('Failed to fetch albums from both API and static JSON');
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

      if (status === 'loading') return false;

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
        state.status = 'failed';
        state.error = errorText;
      });
  },
});

export const albumsReducer = albumsSlice.reducer;
