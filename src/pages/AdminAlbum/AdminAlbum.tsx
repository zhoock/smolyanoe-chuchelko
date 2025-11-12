// src/pages/AdminAlbum/AdminAlbum.tsx
/**
 * Страница альбома в личном кабинете.
 * Отображает список треков с их статусами и позволяет перейти к редактированию.
 */
import { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAlbumsData } from '@hooks/data';
import { DataAwait } from '@shared/DataAwait';
import { useLang } from '@contexts/lang';
import { Loader } from '@shared/ui/loader';
import { ErrorMessage } from '@shared/ui/error-message';
import { Breadcrumb } from '@shared/ui/breadcrumb';
import { AlbumCover } from '@entities/album';
import { loadSyncedLyricsFromStorage, loadAuthorshipFromStorage } from '@utils/syncedLyrics';
import { loadTrackTextFromStorage } from '@utils/trackText';
import type { TracksProps } from '@models';
import './style.scss';

type TrackStatus = 'synced' | 'text-only' | 'empty';

function getTrackStatus(albumId: string, track: TracksProps, lang: string): TrackStatus {
  const storedText = loadTrackTextFromStorage(albumId, track.id, lang);
  const storedSync = loadSyncedLyricsFromStorage(albumId, track.id, lang);

  if (track.syncedLyrics && track.syncedLyrics.length > 0) {
    return 'synced';
  }

  if (storedSync && storedSync.length > 0) {
    return 'synced';
  }

  if (storedText !== null && storedText !== undefined) {
    return 'text-only';
  }

  if (track.content) {
    return 'text-only';
  }

  return 'empty';
}

function getStatusIcon(status: TrackStatus): string {
  switch (status) {
    case 'synced':
      return '✅';
    case 'text-only':
      return '⚠️';
    case 'empty':
      return '❌';
  }
}

function getStatusText(status: TrackStatus): string {
  switch (status) {
    case 'synced':
      return 'Синхронизирован';
    case 'text-only':
      return 'Текст добавлен';
    case 'empty':
      return 'Пусто';
  }
}

function formatDuration(seconds: number | undefined): string {
  if (!seconds || !Number.isFinite(seconds)) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function AdminAlbum() {
  const { lang } = useLang();
  const data = useAlbumsData(lang);
  const { albumId = '' } = useParams<{ albumId: string }>();

  if (!data) {
    return (
      <section className="admin-album main-background" aria-label="Альбом в личном кабинете">
        <div className="wrapper">
          <Loader />
        </div>
      </section>
    );
  }

  return (
    <section className="admin-album main-background" aria-label="Альбом в личном кабинете">
      <div className="wrapper">
        <DataAwait
          value={data.templateA}
          fallback={<Loader />}
          error={<ErrorMessage error="Не удалось загрузить данные альбома" />}
        >
          {(albums) => {
            const album = albums.find((a) => a.albumId === albumId);

            if (!album) {
              return (
                <ErrorMessage
                  error={`Альбом "${albumId}" не найден. Доступные: ${albums.map((a) => a.albumId).join(', ')}`}
                />
              );
            }

            const tracks = album.tracks || [];

            return (
              <>
                <Breadcrumb items={[{ label: 'К альбомам', to: '/admin' }]} />
                <div className="admin-album__header">
                  <div className="admin-album__info">
                    <div className="admin-album__cover">
                      {album.cover && (
                        <AlbumCover
                          {...album.cover}
                          fullName={`${album.artist} - ${album.album}`}
                        />
                      )}
                    </div>
                    <div className="admin-album__details">
                      <h1 className="admin-album__title">{album.album}</h1>
                      <p className="admin-album__artist">{album.artist}</p>
                    </div>
                  </div>
                  <div className="admin-album__actions">
                    <Link to={`/admin/json/${albumId}`} className="admin-album__json-link">
                      Редактировать JSON →
                    </Link>
                  </div>
                </div>

                <div className="admin-album__tracks">
                  <h2 className="admin-album__tracks-title">Треки ({tracks.length})</h2>
                  {tracks.length === 0 ? (
                    <div className="admin-album__empty">
                      <p>В альбоме нет треков</p>
                    </div>
                  ) : (
                    <div className="admin-album__tracks-list">
                      {tracks.map((track, index) => {
                        const status = getTrackStatus(albumId, track, lang);
                        const statusIcon = getStatusIcon(status);
                        const statusText = getStatusText(status);

                        return (
                          <div key={track.id} className="admin-album__track">
                            <div className="admin-album__track-number">{index + 1}</div>
                            <div className="admin-album__track-info">
                              <div className="admin-album__track-title">{track.title}</div>
                              <div className="admin-album__track-meta">
                                <span className="admin-album__track-duration">
                                  {formatDuration(track.duration)}
                                </span>
                                <span
                                  className={`admin-album__track-status admin-album__track-status--${status}`}
                                >
                                  {statusIcon} {statusText}
                                </span>
                              </div>
                            </div>
                            <div className="admin-album__track-actions">
                              <Link
                                to={`/admin/text/${albumId}/${track.id}`}
                                className="admin-album__track-action"
                              >
                                {status === 'empty' ? 'Добавить текст' : 'Редактировать текст'}
                              </Link>
                              <Link
                                to={`/admin/sync/${albumId}/${track.id}`}
                                className="admin-album__track-action admin-album__track-action--primary"
                              >
                                {status === 'synced'
                                  ? 'Редактировать синхронизацию'
                                  : 'Синхронизировать'}
                              </Link>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            );
          }}
        </DataAwait>
      </div>
    </section>
  );
}
