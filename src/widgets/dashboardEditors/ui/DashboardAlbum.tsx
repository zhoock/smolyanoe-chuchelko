// src/pages/DashboardAlbum/DashboardAlbum.tsx
/**
 * Страница альбома в личном кабинете.
 * Отображает список треков с их статусами и позволяет перейти к редактированию.
 */
import { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
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
  selectAlbumById,
} from '@entities/album';
import type { TracksProps } from '@models';
import { getTrackStatus, type TrackStatus } from '@widgets/dashboard/lib/trackStatus';
import {
  getStatusIcon,
  getStatusText,
  formatDuration,
} from '@widgets/dashboard/lib/trackStatusUtils';
import './DashboardAlbum.style.scss';

interface DashboardAlbumProps {
  albumId?: string; // Опциональный prop для использования без роутинга
  onTrackSelect?: (albumId: string, trackId: string, type: 'sync' | 'text') => void; // Callback для выбора трека
}

export default function DashboardAlbum({
  albumId: propAlbumId,
  onTrackSelect,
}: DashboardAlbumProps = {}) {
  const dispatch = useAppDispatch();
  const { lang } = useLang();
  const { albumId: paramAlbumId = '' } = useParams<{ albumId: string }>();
  const albumId = propAlbumId || paramAlbumId; // Используем prop или param
  const status = useAppSelector((state) => selectAlbumsStatus(state, lang));
  const error = useAppSelector((state) => selectAlbumsError(state, lang));
  const album = useAppSelector((state) => selectAlbumById(state, lang, albumId));
  const [trackStatuses, setTrackStatuses] = useState<Map<string | number, TrackStatus>>(new Map());

  // Создаем стабильный ключ для треков, чтобы избежать бесконечного цикла
  const tracksKey = useMemo(
    () => album?.tracks?.map((t) => `${t.id}`).join(',') || '',
    [album?.tracks]
  );

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

  // Загружаем статусы треков
  useEffect(() => {
    if (!album || !album.tracks) {
      setTrackStatuses(new Map());
      return;
    }

    const abortController = new AbortController();
    let cancelled = false;

    (async () => {
      const statusMap = new Map<string | number, TrackStatus>();
      // Используем текущий album из замыкания
      const currentAlbum = album;
      // Обрабатываем треки последовательно, чтобы не перегружать Supabase pooler
      for (const track of currentAlbum.tracks) {
        if (!cancelled && !abortController.signal.aborted) {
          const status = await getTrackStatus(
            albumId,
            track.id,
            lang,
            !!(track.syncedLyrics && track.syncedLyrics.length > 0),
            abortController.signal
          );
          if (!cancelled && !abortController.signal.aborted) {
            statusMap.set(track.id, status);
          }
          // Задержка между треками для снижения нагрузки
          if (!cancelled && !abortController.signal.aborted) {
            await new Promise((resolve) => setTimeout(resolve, 300));
          }
        }
      }
      if (!cancelled && !abortController.signal.aborted) {
        setTrackStatuses(statusMap);
      }
    })();

    return () => {
      cancelled = true;
      abortController.abort(); // Отменяем все запросы при размонтировании
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [albumId, lang, tracksKey]); // Используем стабильный ключ вместо массива, album используется из замыкания

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
        <div className="admin-album__header">
          <div className="admin-album__info">
            <div className="admin-album__cover">
              {album.cover && (
                <AlbumCover img={album.cover} fullName={`${album.artist} - ${album.album}`} />
              )}
            </div>
            <div className="admin-album__details">
              <h1 className="admin-album__title">{album.album}</h1>
              <p className="admin-album__artist">{album.artist}</p>
            </div>
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
                const trackStatus = trackStatuses.get(track.id) || 'empty';
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
                            to={`/dashboard/text/${albumId}/${track.id}`}
                            className="admin-album__track-action"
                          >
                            {trackStatus === 'empty' ? 'Добавить текст' : 'Редактировать текст'}
                          </Link>
                          <Link
                            to={`/dashboard/sync/${albumId}/${track.id}`}
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
