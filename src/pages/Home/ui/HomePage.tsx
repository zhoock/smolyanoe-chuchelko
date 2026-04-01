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

const USE_MOCKS = false;

export function HomePage() {
  const dispatch = useAppDispatch();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { lang } = useLang();
  const sceneRef = useRef<HTMLDivElement | null>(null);
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);
  const hasArtistParam = !!searchParams.get('artist');
  const artistSlug = searchParams.get('artist') || '';

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

      const artists = prepareUniverseData(USE_MOCKS ? generateMockArtists(500) : apiArtists);

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
      universe?.destroy();
      if (sceneRef.current) {
        sceneRef.current.innerHTML = '';
      }
    };
  }, [dispatch, hasArtistParam, lang, location.pathname, location.search, navigate]);

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
      ref={sceneRef}
      style={{ width: '100%', height: '100%', minHeight: 0, position: 'relative' }}
    />
  );
}

export default HomePage;
