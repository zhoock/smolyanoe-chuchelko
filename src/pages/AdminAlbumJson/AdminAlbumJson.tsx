// src/pages/AdminAlbumJson/AdminAlbumJson.tsx
/**
 * Админ-страница для работы с JSON конкретного альбома.
 * Позволяет загрузить данные из основной коллекции, отредактировать их в текстовом поле,
 * сохранить как черновик (localStorage), скачать готовый JSON-файл или скопировать в буфер обмена.
 *
 * Это удобный промежуточный шаг до полноценного API/БД — можно работать в «песочнице»,
 * не затрагивая оригинальные JSON-файлы в репозитории.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAlbumsData } from '@shared/api/albums';
import { useLang } from '@app/providers/lang';
import { DataAwait } from '@shared/DataAwait';
import { Loader } from '@shared/ui/loader';
import { ErrorMessage } from '@shared/ui/error-message';
import { Breadcrumb } from '@shared/ui/breadcrumb';
import type { IAlbums } from '@models';
import './style.scss';

type StatusType = 'success' | 'error' | 'info';

interface StatusMessage {
  type: StatusType;
  message: string;
}

const STORAGE_PREFIX = 'admin-album-json-draft';

export default function AdminAlbumJson() {
  const { lang } = useLang();
  const data = useAlbumsData(lang);
  const { albumId = '' } = useParams<{ albumId: string }>();

  const [jsonText, setJsonText] = useState<string>('');
  const [initialJson, setInitialJson] = useState<string>('');
  const [status, setStatus] = useState<StatusMessage | null>(null);
  const [albumTitle, setAlbumTitle] = useState<string>('');

  const initialLoadedRef = useRef(false);

  const storageKey = useMemo(() => `${STORAGE_PREFIX}-${lang}-${albumId}`, [albumId, lang]);

  useEffect(() => {
    if (!data || !albumId) {
      return;
    }

    let cancelled = false;

    data.templateA
      .then((albums) => {
        if (cancelled) return;
        const album = albums.find((item) => item.albumId === albumId);
        if (!album) {
          setStatus({
            type: 'error',
            message: `Альбом с идентификатором "${albumId}" не найден в текущем JSON.`,
          });
          return;
        }

        const serialized = JSON.stringify(album, null, 2);
        setAlbumTitle(album.album);

        if (!initialLoadedRef.current) {
          initialLoadedRef.current = true;
          setInitialJson(serialized);

          const draft = localStorage.getItem(storageKey);
          if (draft) {
            setJsonText(draft);
            setStatus({
              type: 'info',
              message:
                'Загружен сохранённый черновик из localStorage. Нажмите «Сбросить», чтобы вернуться к оригинальному JSON.',
            });
          } else {
            setJsonText(serialized);
          }
        } else if (!jsonText) {
          // Если страница перезагружена без черновика
          setJsonText(serialized);
        }
      })
      .catch((error) => {
        console.error('Не удалось получить данные альбома:', error);
        if (!cancelled) {
          setStatus({
            type: 'error',
            message: `Не удалось загрузить альбом: ${error instanceof Error ? error.message : 'Unknown error'}`,
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [data, albumId, storageKey, jsonText]);

  const parsedAlbum = useMemo<IAlbums | null>(() => {
    try {
      return JSON.parse(jsonText) as IAlbums;
    } catch (error) {
      return null;
    }
  }, [jsonText]);

  const setStatusMessage = useCallback((type: StatusType, message: string) => {
    setStatus({ type, message });
  }, []);

  const safeParse = useCallback(
    (value: string): IAlbums | null => {
      try {
        const parsed = JSON.parse(value) as IAlbums;
        if (!parsed || typeof parsed !== 'object') {
          throw new Error('JSON должен описывать объект альбома.');
        }
        if (!parsed.albumId) {
          throw new Error('Поле "albumId" обязательно.');
        }
        return parsed;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Ошибка разбора JSON.';
        setStatusMessage('error', `❌ ${message}`);
        return null;
      }
    },
    [setStatusMessage]
  );

  const handleReset = useCallback(() => {
    setJsonText(initialJson);
    setStatusMessage('info', 'JSON сброшен к исходным данным из файла.');
  }, [initialJson, setStatusMessage]);

  const handleFormat = useCallback(() => {
    const parsed = safeParse(jsonText);
    if (!parsed) return;
    const formatted = JSON.stringify(parsed, null, 2);
    setJsonText(formatted);
    setStatusMessage('success', 'JSON отформатирован.');
  }, [jsonText, safeParse, setStatusMessage]);

  const handleValidate = useCallback(() => {
    const parsed = safeParse(jsonText);
    if (!parsed) return;

    const warnings: string[] = [];
    if (albumId && parsed.albumId !== albumId) {
      warnings.push(
        `Идентификатор альбома в JSON (${parsed.albumId}) отличается от текущего маршрута (${albumId}).`
      );
    }
    if (!Array.isArray(parsed.tracks)) {
      warnings.push('Поле "tracks" отсутствует или не является массивом.');
    }

    if (warnings.length > 0) {
      setStatusMessage(
        'info',
        `⚠️ JSON корректен, но есть предупреждения:\n- ${warnings.join('\n- ')}`
      );
    } else {
      setStatusMessage('success', '✅ JSON успешно валидирован.');
    }
  }, [jsonText, albumId, safeParse, setStatusMessage]);

  const handleSaveDraft = useCallback(() => {
    const parsed = safeParse(jsonText);
    if (!parsed) return;

    const formatted = JSON.stringify(parsed, null, 2);
    localStorage.setItem(storageKey, formatted);
    setJsonText(formatted);
    setStatusMessage('success', 'Черновик сохранён в localStorage.');
  }, [jsonText, safeParse, setStatusMessage, storageKey]);

  const handleLoadDraft = useCallback(() => {
    const draft = localStorage.getItem(storageKey);
    if (!draft) {
      setStatusMessage('info', 'Черновик отсутствует.');
      return;
    }
    setJsonText(draft);
    setStatusMessage('success', 'Черновик загружен из localStorage.');
  }, [storageKey, setStatusMessage]);

  const handleClearDraft = useCallback(() => {
    localStorage.removeItem(storageKey);
    setStatusMessage('info', 'Черновик удалён из localStorage.');
  }, [storageKey, setStatusMessage]);

  const handleDownload = useCallback(() => {
    const parsed = safeParse(jsonText);
    if (!parsed) return;

    const formatted = JSON.stringify(parsed, null, 2);
    const blob = new Blob([formatted], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const filename = `${parsed.albumId || albumId || 'album'}-${lang}.json`;

    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);

    setStatusMessage('success', `Файл ${filename} скачан.`);
  }, [jsonText, safeParse, setStatusMessage, albumId, lang]);

  const handleCopy = useCallback(async () => {
    const parsed = safeParse(jsonText);
    if (!parsed) return;

    const formatted = JSON.stringify(parsed, null, 2);
    try {
      await navigator.clipboard.writeText(formatted);
      setStatusMessage('success', 'JSON скопирован в буфер обмена.');
    } catch (error) {
      console.error('Clipboard error:', error);
      setStatusMessage('error', 'Не удалось скопировать в буфер обмена.');
    }
  }, [jsonText, safeParse, setStatusMessage]);

  if (!data) {
    return (
      <section className="admin-json main-background" aria-label="Редактор альбомов">
        <div className="wrapper">
          <Loader />
        </div>
      </section>
    );
  }

  return (
    <section className="admin-json main-background" aria-label="Редактор JSON альбома">
      <div className="wrapper">
        <DataAwait
          value={data.templateA}
          fallback={<Loader />}
          error={<ErrorMessage error="Не удалось загрузить данные альбома" />}
        >
          {(albums) => {
            const albumExists = albums.some((album) => album.albumId === albumId);
            if (!albumExists && initialJson.length === 0) {
              return (
                <ErrorMessage
                  error={`Альбом "${albumId}" не найден. Доступные: ${albums
                    .map((a) => a.albumId)
                    .join(', ')}`}
                />
              );
            }

            const tracksPreview = parsedAlbum?.tracks ?? [];

            return (
              <>
                <Breadcrumb
                  items={[
                    { label: 'К альбомам', to: '/admin' },
                    { label: albumTitle || albumId, to: `/admin/album/${albumId}` },
                  ]}
                />

                <header className="admin-json__header">
                  <h1>
                    JSON-редактор альбома <span className="admin-json__header-id">#{albumId}</span>
                  </h1>
                  <p className="admin-json__description">
                    Здесь можно редактировать исходные данные альбома перед миграцией в БД.
                    Изменения сохраняются в localStorage как черновик. Позже вы сможете выгрузить
                    актуальный JSON и обновить файлы в репозитории.
                  </p>
                </header>

                <div className="admin-json__actions">
                  <button type="button" onClick={handleValidate}>
                    Проверить JSON
                  </button>
                  <button type="button" onClick={handleFormat}>
                    Отформатировать
                  </button>
                  <button type="button" onClick={handleReset}>
                    Сбросить
                  </button>
                  <button type="button" onClick={handleSaveDraft}>
                    Сохранить черновик
                  </button>
                  <button type="button" onClick={handleLoadDraft}>
                    Загрузить черновик
                  </button>
                  <button type="button" onClick={handleClearDraft}>
                    Удалить черновик
                  </button>
                  <button type="button" onClick={handleCopy}>
                    Скопировать JSON
                  </button>
                  <button type="button" onClick={handleDownload}>
                    Скачать JSON
                  </button>
                  <Link to={`/admin/album/${albumId}`} className="admin-json__back-link">
                    ← Назад к альбому
                  </Link>
                </div>

                {status && (
                  <div className={`admin-json__status admin-json__status--${status.type}`}>
                    {status.message}
                  </div>
                )}

                <div className="admin-json__content">
                  <div className="admin-json__editor">
                    <label htmlFor="album-json-editor" className="admin-json__label">
                      JSON альбома
                    </label>
                    <textarea
                      id="album-json-editor"
                      value={jsonText}
                      onChange={(event) => setJsonText(event.target.value)}
                      rows={28}
                      spellCheck={false}
                    />
                  </div>

                  <aside className="admin-json__preview">
                    <h2>Краткий обзор</h2>
                    {parsedAlbum ? (
                      <div className="admin-json__preview-content">
                        <dl>
                          <div>
                            <dt>ID альбома</dt>
                            <dd>{parsedAlbum.albumId}</dd>
                          </div>
                          <div>
                            <dt>Название</dt>
                            <dd>{parsedAlbum.album}</dd>
                          </div>
                          <div>
                            <dt>Артист</dt>
                            <dd>{parsedAlbum.artist}</dd>
                          </div>
                          <div>
                            <dt>Дата релиза</dt>
                            <dd>{parsedAlbum.release?.date ?? '—'}</dd>
                          </div>
                          <div>
                            <dt>Треков</dt>
                            <dd>
                              {Array.isArray(parsedAlbum.tracks) ? parsedAlbum.tracks.length : 0}
                            </dd>
                          </div>
                        </dl>

                        <div className="admin-json__tracks">
                          <h3>Треки</h3>
                          {tracksPreview.length === 0 ? (
                            <p className="admin-json__tracks-empty">В альбоме нет треков.</p>
                          ) : (
                            <ul>
                              {tracksPreview.map((track) => (
                                <li key={track.id}>
                                  <span className="admin-json__track-title">{track.title}</span>
                                  <span className="admin-json__track-meta">
                                    {track.duration ? `${track.duration.toFixed(2)} min` : '—'}
                                    {track.src ? ' • src' : ''}
                                    {track.content ? ' • текст' : ''}
                                    {track.syncedLyrics && track.syncedLyrics.length > 0
                                      ? ` • sync (${track.syncedLyrics.length})`
                                      : ''}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    ) : (
                      <p className="admin-json__preview-empty">
                        JSON невалиден — предварительный просмотр недоступен.
                      </p>
                    )}
                  </aside>
                </div>
              </>
            );
          }}
        </DataAwait>
      </div>
    </section>
  );
}
