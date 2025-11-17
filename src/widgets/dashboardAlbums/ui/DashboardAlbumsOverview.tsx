// src/pages/DashboardAlbumsOverview/DashboardAlbumsOverview.tsx
/**
 * Главная страница личного кабинета.
 * Отображает список альбомов с прогрессом синхронизации.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLang } from '@app/providers/lang';
import { useAppDispatch } from '@shared/lib/hooks/useAppDispatch';
import { useAppSelector } from '@shared/lib/hooks/useAppSelector';
import { Loader } from '@shared/ui/loader';
import { ErrorMessage } from '@shared/ui/error-message';
import {
  AlbumCover,
  fetchAlbums,
  selectAlbumsStatus,
  selectAlbumsError,
  selectAlbumsData,
} from '@entities/album';
import { loadSyncedLyricsFromStorage, loadAuthorshipFromStorage } from '@features/syncedLyrics/lib';
import { loadTrackTextFromStorage } from '@entities/track/lib';
import type { IAlbums } from '@models';
import './DashboardAlbumsOverview.style.scss';

type TrackStatus = 'synced' | 'text-only' | 'empty';

interface AlbumStats {
  total: number;
  synced: number;
  textOnly: number;
  empty: number;
}

async function getTrackStatus(
  albumId: string,
  trackId: string | number,
  lang: string,
  hasSyncedLyrics: boolean
): Promise<TrackStatus> {
  const storedText = loadTrackTextFromStorage(albumId, trackId, lang);
  const storedSync = await loadSyncedLyricsFromStorage(albumId, trackId, lang);

  if (hasSyncedLyrics || (storedSync && storedSync.length > 0)) {
    return 'synced';
  }

  if (storedText || storedText !== null) {
    return 'text-only';
  }

  return 'empty';
}

async function calculateAlbumStats(album: IAlbums, lang: string): Promise<AlbumStats> {
  const stats: AlbumStats = {
    total: album.tracks?.length || 0,
    synced: 0,
    textOnly: 0,
    empty: 0,
  };

  if (!album.tracks) return stats;

  await Promise.all(
    album.tracks.map(async (track) => {
      const status = await getTrackStatus(
        album.albumId || '',
        track.id,
        lang,
        !!(track.syncedLyrics && track.syncedLyrics.length > 0)
      );

      switch (status) {
        case 'synced':
          stats.synced++;
          break;
        case 'text-only':
          stats.textOnly++;
          break;
        case 'empty':
          stats.empty++;
          break;
      }
    })
  );

  return stats;
}

interface DashboardAlbumsOverviewProps {
  onAlbumSelect?: (albumId: string) => void; // Callback для выбора альбома (вместо роутинга)
  onBuilderOpen?: () => void; // Callback для открытия builder
}

export default function DashboardAlbumsOverview({
  onAlbumSelect,
  onBuilderOpen,
}: DashboardAlbumsOverviewProps) {
  const dispatch = useAppDispatch();
  const { lang } = useLang();
  const status = useAppSelector((state) => selectAlbumsStatus(state, lang));
  const error = useAppSelector((state) => selectAlbumsError(state, lang));
  const albums = useAppSelector((state) => selectAlbumsData(state, lang));
  const [albumsStats, setAlbumsStats] = useState<Map<string, AlbumStats>>(new Map());

  useEffect(() => {
    if (status === 'idle' || status === 'failed') {
      const promise = dispatch(fetchAlbums({ lang }));
      return () => {
        promise.abort();
      };
    }
  }, [dispatch, lang, status]);

  // Загружаем статистику для каждого альбома
  useEffect(() => {
    if (!albums || albums.length === 0) {
      setAlbumsStats(new Map());
      return;
    }

    (async () => {
      const statsMap = new Map<string, AlbumStats>();
      await Promise.all(
        albums.map(async (album) => {
          if (album.albumId) {
            const stats = await calculateAlbumStats(album, lang);
            statsMap.set(album.albumId, stats);
          }
        })
      );
      setAlbumsStats(statsMap);
    })();
  }, [albums, lang]);

  if (status === 'loading' || status === 'idle') {
    return (
      <section className="admin main-background" aria-label="Личный кабинет">
        <div className="admin-container">
          <Loader />
        </div>
      </section>
    );
  }

  if (status === 'failed') {
    return (
      <section className="admin main-background" aria-label="Личный кабинет">
        <div className="admin-container">
          <ErrorMessage error={error ?? 'Не удалось загрузить альбомы'} />
        </div>
      </section>
    );
  }

  return (
    <section className="admin main-background" aria-label="Личный кабинет">
      <div className="admin-container">
        <div className="admin__actions">
          {onBuilderOpen ? (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                onBuilderOpen();
              }}
              className="admin__create-button"
            >
              <span className="admin__create-button-icon">+</span>
              <span className="admin__create-button-text">Добавить альбом</span>
            </button>
          ) : (
            <Link to="/dashboard/albums/new" className="admin__create-button">
              <span className="admin__create-button-icon">+</span>
              <span className="admin__create-button-text">Добавить альбом</span>
            </Link>
          )}
        </div>

        {!albums || albums.length === 0 ? (
          <div className="admin__empty">
            <p>Альбомы не найдены</p>
          </div>
        ) : (
          <div className="admin__albums">
            {albums.map((album) => {
              const stats = albumsStats.get(album.albumId || '') || {
                total: album.tracks?.length || 0,
                synced: 0,
                textOnly: 0,
                empty: album.tracks?.length || 0,
              };
              const progress = stats.total > 0 ? (stats.synced / stats.total) * 100 : 0;

              const handleAlbumClick = (e: React.MouseEvent) => {
                e.preventDefault();
                if (onAlbumSelect && album.albumId) {
                  onAlbumSelect(album.albumId);
                } else if (album.albumId) {
                  // Fallback на роутинг, если callback не передан
                  window.location.href = `/dashboard/albums/${album.albumId}`;
                }
              };

              return (
                <button
                  key={album.albumId}
                  type="button"
                  onClick={handleAlbumClick}
                  className="admin__album-card admin__album-card--button"
                >
                  <div className="admin__album-cover">
                    {album.cover && (
                      <AlbumCover {...album.cover} fullName={`${album.artist} - ${album.album}`} />
                    )}
                  </div>
                  <div className="admin__album-info">
                    <h2 className="admin__album-title">{album.album}</h2>
                    <p className="admin__album-artist">{album.artist}</p>
                    <div className="admin__album-stats">
                      <div className="admin__album-progress">
                        <div className="admin__album-progress-bar">
                          <div
                            className="admin__album-progress-fill"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <span className="admin__album-progress-text">
                          {stats.synced} из {stats.total} синхронизировано
                        </span>
                      </div>
                      <div className="admin__album-status">
                        <span className="admin__album-status-item admin__album-status-item--synced">
                          ✅ {stats.synced}
                        </span>
                        <span className="admin__album-status-item admin__album-status-item--text-only">
                          ⚠️ {stats.textOnly}
                        </span>
                        <span className="admin__album-status-item admin__album-status-item--empty">
                          ❌ {stats.empty}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
