// src/pages/Admin/Admin.tsx
/**
 * Главная страница личного кабинета.
 * Отображает список альбомов с прогрессом синхронизации.
 */
import { useEffect, useMemo, useState } from 'react';
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
  const dispatch = useAppDispatch();
  const { lang } = useLang();
  const [searchQuery, setSearchQuery] = useState('');
  const status = useAppSelector((state) => selectAlbumsStatus(state, lang));
  const error = useAppSelector((state) => selectAlbumsError(state, lang));
  const albums = useAppSelector((state) => selectAlbumsData(state, lang));

  useEffect(() => {
    if (status === 'idle' || status === 'failed') {
      const promise = dispatch(fetchAlbums({ lang }));
      return () => {
        promise.abort();
      };
    }
  }, [dispatch, lang, status]);

  const filteredAlbums = useMemo(() => {
    if (!searchQuery.trim()) return albums;

    const query = searchQuery.toLowerCase();
    return albums.filter(
      (album) =>
        album.album.toLowerCase().includes(query) || album.artist.toLowerCase().includes(query)
    );
  }, [albums, searchQuery]);

  if (status === 'loading' || status === 'idle') {
    return (
      <section className="admin main-background" aria-label="Личный кабинет">
        <div className="wrapper">
          <Loader />
        </div>
      </section>
    );
  }

  if (status === 'failed') {
    return (
      <section className="admin main-background" aria-label="Личный кабинет">
        <div className="wrapper">
          <ErrorMessage error={error ?? 'Не удалось загрузить альбомы'} />
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

        {filteredAlbums.length === 0 ? (
          <div className="admin__empty">
            <p>Альбомы не найдены</p>
          </div>
        ) : (
          <div className="admin__albums">
            {filteredAlbums.map((album) => {
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
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
