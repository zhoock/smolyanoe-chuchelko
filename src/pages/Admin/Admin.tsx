// src/pages/Admin/Admin.tsx
/**
 * Главная страница личного кабинета.
 * Отображает список альбомов с прогрессом синхронизации.
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAlbumsData } from '@shared/api/albums';
import { DataAwait } from '@shared/DataAwait';
import { useLang } from '@app/providers/lang';
import { Loader } from '@shared/ui/loader';
import { ErrorMessage } from '@shared/ui/error-message';
import { AlbumCover } from '@entities/album';
import { loadSyncedLyricsFromStorage, loadAuthorshipFromStorage } from '@features/syncedLyrics/lib';
import { loadTrackTextFromStorage } from '@entities/track/lib';
import type { IAlbums } from '@models';
import './style.scss';

type TrackStatus = 'synced' | 'text-only' | 'empty';

interface AlbumStats {
  total: number;
  synced: number;
  textOnly: number;
  empty: number;
}

function getTrackStatus(
  albumId: string,
  trackId: string | number,
  lang: string,
  hasSyncedLyrics: boolean
): TrackStatus {
  const storedText = loadTrackTextFromStorage(albumId, trackId, lang);
  const storedSync = loadSyncedLyricsFromStorage(albumId, trackId, lang);

  if (hasSyncedLyrics || (storedSync && storedSync.length > 0)) {
    return 'synced';
  }

  if (storedText || storedText !== null) {
    return 'text-only';
  }

  return 'empty';
}

function calculateAlbumStats(album: IAlbums, lang: string): AlbumStats {
  const stats: AlbumStats = {
    total: album.tracks?.length || 0,
    synced: 0,
    textOnly: 0,
    empty: 0,
  };

  if (!album.tracks) return stats;

  album.tracks.forEach((track) => {
    const status = getTrackStatus(
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
  });

  return stats;
}

export default function Admin() {
  const { lang } = useLang();
  const data = useAlbumsData(lang);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredAlbums = useMemo(() => {
    if (!data) {
      return Promise.resolve([] as IAlbums[]);
    }

    return data.templateA.then((albums) => {
      if (!searchQuery.trim()) return albums;

      const query = searchQuery.toLowerCase();
      return albums.filter(
        (album) =>
          album.album.toLowerCase().includes(query) || album.artist.toLowerCase().includes(query)
      );
    });
  }, [data, searchQuery]);

  if (!data) {
    return (
      <section className="admin main-background" aria-label="Личный кабинет">
        <div className="wrapper">
          <Loader />
        </div>
      </section>
    );
  }

  return (
    <section className="admin main-background" aria-label="Личный кабинет">
      <div className="wrapper">
        <div className="admin__header">
          <h1>Личный кабинет</h1>
          <p className="admin__subtitle">Управление альбомами и синхронизацией текстов</p>
          <Link to="/admin/builder" className="admin__builder-link">
            Создать новый альбом →
          </Link>
        </div>

        <div className="admin__search">
          <input
            type="text"
            placeholder="Поиск альбомов..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="admin__search-input"
          />
        </div>

        <DataAwait
          value={filteredAlbums}
          fallback={<Loader />}
          error={<ErrorMessage error="Не удалось загрузить альбомы" />}
        >
          {(albums) => {
            if (albums.length === 0) {
              return (
                <div className="admin__empty">
                  <p>Альбомы не найдены</p>
                </div>
              );
            }

            return (
              <div className="admin__albums">
                {albums.map((album) => {
                  const stats = calculateAlbumStats(album, lang);
                  const progress = stats.total > 0 ? (stats.synced / stats.total) * 100 : 0;

                  return (
                    <Link
                      key={album.albumId}
                      to={`/admin/album/${album.albumId}`}
                      className="admin__album-card"
                    >
                      <div className="admin__album-cover">
                        {album.cover && (
                          <AlbumCover
                            {...album.cover}
                            fullName={`${album.artist} - ${album.album}`}
                          />
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
                    </Link>
                  );
                })}
              </div>
            );
          }}
        </DataAwait>
      </div>
    </section>
  );
}
