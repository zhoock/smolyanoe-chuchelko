import {
  Universe3D,
  type SceneArtist,
  UNIVERSE_FOCUS_ARTIST_STORAGE_KEY,
} from '../../../components/view/Universe3D';
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useLang } from '@app/providers/lang';
import { useAppDispatch } from '@shared/lib/hooks/useAppDispatch';
import { playerActions } from '@features/player';
import { getUserAudioUrl } from '@shared/api/albums';
import type { IAlbums, TracksProps } from '@models';
import { fetchAlbums } from '@entities/album';
import { fetchArticles } from '@entities/article';
import { generateMockArtists } from '@shared/lib/generateMockArtists';
import { prepareUniverseData } from '@features/universe/model/prepareUniverseData';
import { AboutSection } from './AboutSection';
import { AlbumsSection } from './AlbumsSection';
import { ArticlesSection } from './ArticlesSection';
import '../../../components/view/Universe3D.style.scss';

const HOME_USE_MOCKS_STORAGE_KEY = 'homeUseMocks';

export function HomePage() {
  const dispatch = useAppDispatch();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { lang } = useLang();
  const sceneRef = useRef<HTMLDivElement | null>(null);
  const universeRef = useRef<Universe3D | null>(null);
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);
  const [useMocks, setUseMocks] = useState(() => {
    try {
      return sessionStorage.getItem(HOME_USE_MOCKS_STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [cloudDamping, setCloudDamping] = useState(true);
  const [universeRefreshToken, setUniverseRefreshToken] = useState(0);
  const hasArtistParam = !!searchParams.get('artist');
  const artistSlug = searchParams.get('artist') || '';

  useEffect(() => {
    const handler = () => setUniverseRefreshToken((n) => n + 1);
    window.addEventListener('artist:updated', handler);
    return () => window.removeEventListener('artist:updated', handler);
  }, []);

  useEffect(() => {
    if (!hasArtistParam) return;
    void dispatch(fetchAlbums({ lang, force: true }));
    void dispatch(fetchArticles({ lang, force: true }));
  }, [dispatch, hasArtistParam, lang, artistSlug]);

  useEffect(() => {
    if (hasArtistParam) return;
    if (!sceneRef.current) return;

    let universe: Universe3D | null = null;
    let cancelled = false;

    const init = async () => {
      let apiArtists: SceneArtist[] = [];

      try {
        const response = await fetch('/api/public-artists', { cache: 'no-store' });
        const payload = (await response.json()) as { success?: boolean; data?: SceneArtist[] };
        if (response.ok && payload.success && Array.isArray(payload.data)) {
          apiArtists = payload.data;
        }
      } catch (error) {
        console.warn('[HomePage] Failed to fetch /api/public-artists, using fallback data', error);
      }

      const artists = prepareUniverseData(useMocks ? generateMockArtists(50) : apiArtists);

      if (cancelled || !sceneRef.current) return;
      universe = new Universe3D(sceneRef.current, artists, {
        onNavigateToArtist: (publicSlug) => {
          sessionStorage.setItem(UNIVERSE_FOCUS_ARTIST_STORAGE_KEY, publicSlug);
          navigate({
            pathname: '/',
            search: `?artist=${encodeURIComponent(publicSlug)}`,
            hash: '',
          });
        },
        onPlayArtist: async (artist) => {
          if (!artist?.publicSlug) return false;

          const url = `/api/albums?lang=${encodeURIComponent(lang)}&artist=${encodeURIComponent(artist.publicSlug)}`;
          const response = await fetch(url);
          const payload = (await response.json()) as { success?: boolean; data?: IAlbums[] };

          if (
            !response.ok ||
            !payload.success ||
            !Array.isArray(payload.data) ||
            payload.data.length === 0
          ) {
            return false;
          }

          const firstAlbum = payload.data.find(
            (album) => Array.isArray(album.tracks) && album.tracks.length > 0
          );
          if (!firstAlbum) return false;

          const playlist: TracksProps[] = firstAlbum.tracks.map((track) => ({
            ...track,
            src: getUserAudioUrl(track.src),
          }));

          dispatch(playerActions.setPlaylist(playlist));
          dispatch(playerActions.setCurrentTrackIndex(0));

          const albumId =
            firstAlbum.albumId ??
            `${firstAlbum.artist}-${firstAlbum.album}`.toLowerCase().replace(/\s+/g, '-');

          dispatch(
            playerActions.setAlbumInfo({
              albumId,
              albumTitle: firstAlbum.album,
            })
          );

          dispatch(
            playerActions.setAlbumMeta({
              albumId,
              userId: firstAlbum.userId ?? null,
              publicSlug: artist.publicSlug,
              album: firstAlbum.album,
              artist: firstAlbum.artist,
              fullName: firstAlbum.fullName ?? `${firstAlbum.artist} — ${firstAlbum.album}`,
              cover: firstAlbum.cover ?? null,
            })
          );

          dispatch(
            playerActions.setSourceLocation({
              pathname: location.pathname,
              search: location.search || undefined,
            })
          );

          dispatch(playerActions.requestPlay());

          // Force mini-player mode for this flow (avoid hidden mini when URL has #player).
          navigate(
            {
              pathname: location.pathname,
              search: location.search || undefined,
              hash: '',
            },
            { replace: true }
          );
          return true;
        },
      });

      universeRef.current = universe;
      universe.setCloudDamping(cloudDamping);

      const focusSlug = sessionStorage.getItem(UNIVERSE_FOCUS_ARTIST_STORAGE_KEY);
      if (focusSlug) {
        setTimeout(() => {
          universe?.focusOnArtist(focusSlug);
        }, 300);
        sessionStorage.removeItem(UNIVERSE_FOCUS_ARTIST_STORAGE_KEY);
      }
    };

    void init();

    return () => {
      cancelled = true;
      universeRef.current = null;
      universe?.destroy();
      if (sceneRef.current) {
        sceneRef.current.innerHTML = '';
      }
    };
  }, [
    dispatch,
    hasArtistParam,
    lang,
    location.pathname,
    location.search,
    navigate,
    useMocks,
    universeRefreshToken,
  ]);

  if (hasArtistParam) {
    return (
      <>
        <AlbumsSection />
        <ArticlesSection />
        <AboutSection
          isAboutModalOpen={isAboutModalOpen}
          onOpen={() => setIsAboutModalOpen(true)}
          onClose={() => setIsAboutModalOpen(false)}
        />
      </>
    );
  }

  return (
    <section
      aria-label="Cloud scene"
      style={{ width: '100%', height: '100%', minHeight: 0, position: 'relative' }}
    >
      <div
        style={{
          position: 'absolute',
          top: 12,
          right: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          zIndex: 20,
        }}
      >
        <button
          type="button"
          onClick={() => {
            setUseMocks((prev) => {
              const next = !prev;
              sessionStorage.setItem(HOME_USE_MOCKS_STORAGE_KEY, next ? '1' : '0');
              return next;
            });
          }}
          style={{
            padding: '6px 10px',
            borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.35)',
            background: 'rgba(12,12,14,0.72)',
            color: '#fff',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          {useMocks ? 'Mocks: ON' : 'Mocks: OFF'}
        </button>
        <button
          type="button"
          onClick={() => {
            setCloudDamping((prev) => {
              const next = !prev;
              universeRef.current?.setCloudDamping(next);
              return next;
            });
          }}
          style={{
            padding: '6px 10px',
            borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.35)',
            background: 'rgba(12,12,14,0.72)',
            color: '#fff',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          {cloudDamping ? 'Cloud: ON' : 'Cloud: OFF'}
        </button>
      </div>
      <div
        ref={sceneRef}
        style={{ width: '100%', height: '100%', minHeight: 0, position: 'relative' }}
      />
    </section>
  );
}

export default HomePage;
