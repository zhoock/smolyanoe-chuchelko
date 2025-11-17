// src/pages/AdminAlbum/AdminAlbum.tsx
/**
 * Страница альбома в личном кабинете.
 * Отображает список треков с их статусами и позволяет перейти к редактированию.
 */
import { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useLang } from '@app/providers/lang';
import { useAppDispatch } from '@shared/lib/hooks/useAppDispatch';
import { useAppSelector } from '@shared/lib/hooks/useAppSelector';
import { Loader } from '@shared/ui/loader';
import { ErrorMessage } from '@shared/ui/error-message';
import { Breadcrumb } from '@shared/ui/breadcrumb';
import {
  AlbumCover,
  fetchAlbums,
  selectAlbumsStatus,
  selectAlbumsError,
  selectAlbumById,
} from '@entities/album';
import { loadSyncedLyricsFromStorage, loadAuthorshipFromStorage } from '@features/syncedLyrics/lib';
import { loadTrackTextFromStorage } from '@entities/track/lib';
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

interface AdminAlbumProps {
  albumId?: string; // Опциональный prop для использования без роутинга
  onTrackSelect?: (albumId: string, trackId: string, type: 'sync' | 'text') => void; // Callback для выбора трека
}

export default function AdminAlbum({ albumId: propAlbumId, onTrackSelect }: AdminAlbumProps = {}) {
  const dispatch = useAppDispatch();
  const { lang } = useLang();
  const { albumId: paramAlbumId = '' } = useParams<{ albumId: string }>();
  const albumId = propAlbumId || paramAlbumId; // Используем prop или param
  const status = useAppSelector((state) => selectAlbumsStatus(state, lang));
  const error = useAppSelector((state) => selectAlbumsError(state, lang));
  const album = useAppSelector((state) => selectAlbumById(state, lang, albumId));

  useEffect(() => {
    if (!albumId) {
      return;
    }

    if (status === 'idle' || status === 'failed') {
      const promise = dispatch(fetchAlbums({ lang }));
      return () => {
        promise.abort();
      };
    }
  }, [dispatch, lang, status, albumId]);

  if (status === 'loading' || status === 'idle') {
    return (
      <section className="admin-album main-background" aria-label="Альбом в личном кабинете">
        <div className="wrapper">
          <Loader />
        </div>
      </section>
    );
  }

  if (status === 'failed') {
    return (
      <section className="admin-album main-background" aria-label="Альбом в личном кабинете">
        <div className="wrapper">
          <ErrorMessage error={error ?? 'Не удалось загрузить данные альбома'} />
        </div>
      </section>
    );
  }

  if (!album) {
    return (
      <section className="admin-album main-background" aria-label="Альбом в личном кабинете">
        <div className="wrapper">
          <ErrorMessage error={`Альбом "${albumId}" не найден`} />
        </div>
      </section>
    );
  }

  const tracks = album.tracks || [];

  return (
    <section className="admin-album main-background" aria-label="Альбом в личном кабинете">
      <div className="wrapper">
        <Breadcrumb items={[{ label: 'К альбомам', to: '/dashboard/albums' }]} />
        <div className="admin-album__header">
          <div className="admin-album__info">
            <div className="admin-album__cover">
              {album.cover && (
                <AlbumCover {...album.cover} fullName={`${album.artist} - ${album.album}`} />
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
                const trackStatus = getTrackStatus(albumId, track, lang);
                const statusIcon = getStatusIcon(trackStatus);
                const statusText = getStatusText(trackStatus);

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
                          className={`admin-album__track-status admin-album__track-status--${trackStatus}`}
                        >
                          {statusIcon} {statusText}
                        </span>
                      </div>
                    </div>
                    <div className="admin-album__track-actions">
                      {onTrackSelect ? (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              if (albumId && track.id) {
                                onTrackSelect(albumId, String(track.id), 'text');
                              }
                            }}
                            className="admin-album__track-action"
                          >
                            {trackStatus === 'empty' ? 'Добавить текст' : 'Редактировать текст'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (albumId && track.id) {
                                onTrackSelect(albumId, String(track.id), 'sync');
                              }
                            }}
                            className="admin-album__track-action admin-album__track-action--primary"
                          >
                            {trackStatus === 'synced'
                              ? 'Редактировать синхронизацию'
                              : 'Синхронизировать'}
                          </button>
                        </>
                      ) : (
                        <>
                          <Link
                            to={`/admin/text/${albumId}/${track.id}`}
                            className="admin-album__track-action"
                          >
                            {trackStatus === 'empty' ? 'Добавить текст' : 'Редактировать текст'}
                          </Link>
                          <Link
                            to={`/admin/sync/${albumId}/${track.id}`}
                            className="admin-album__track-action admin-album__track-action--primary"
                          >
                            {trackStatus === 'synced'
                              ? 'Редактировать синхронизацию'
                              : 'Синхронизировать'}
                          </Link>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
