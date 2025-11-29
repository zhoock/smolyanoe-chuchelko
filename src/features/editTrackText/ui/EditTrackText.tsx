// src/features/editTrackText/ui/EditTrackText.tsx
/**
 * Фича для редактирования текста песни.
 * Позволяет вводить и форматировать текст песни перед синхронизацией.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useLang } from '@app/providers/lang';
import { useAppSelector } from '@shared/lib/hooks/useAppSelector';
import { selectAlbumsStatus, selectAlbumsError, selectAlbumById } from '@entities/album';
import { Loader } from '@shared/ui/loader';
import { ErrorMessage } from '@shared/ui/error-message';
import {
  saveTrackText,
  loadTrackTextFromDatabase,
  formatTrackText,
  splitTextIntoLines,
  countLines,
} from '@entities/track/lib';
import { loadAuthorshipFromStorage } from '@features/syncedLyrics/lib';
import './EditTrackText.style.scss';

interface EditTrackTextProps {
  albumId?: string; // Опциональный prop для использования без роутинга
  trackId?: string; // Опциональный prop для использования без роутинга
  onSyncOpen?: (albumId: string, trackId: string) => void; // Callback для переключения на синхронизацию
}

export default function EditTrackText({
  albumId: propAlbumId,
  trackId: propTrackId,
  onSyncOpen,
}: EditTrackTextProps = {}) {
  const { lang } = useLang();
  const { albumId: paramAlbumId = '', trackId: paramTrackId = '' } = useParams<{
    albumId: string;
    trackId: string;
  }>();
  const albumId = propAlbumId || paramAlbumId; // Используем prop или param
  const trackId = propTrackId || paramTrackId; // Используем prop или param
  const albumsStatus = useAppSelector((state) => selectAlbumsStatus(state, lang));
  const albumsError = useAppSelector((state) => selectAlbumsError(state, lang));
  const album = useAppSelector((state) => selectAlbumById(state, lang, albumId));

  const [text, setText] = useState<string>('');
  const [authorship, setAuthorship] = useState<string>('');
  const [isDirty, setIsDirty] = useState(false);
  const [currentTrackId, setCurrentTrackId] = useState<string | null>(null);

  // Форматированный текст для предпросмотра
  const formattedText = useMemo(() => formatTrackText(text), [text]);
  const lines = useMemo(() => splitTextIntoLines(formattedText), [formattedText]);
  const lineCount = useMemo(() => countLines(formattedText), [formattedText]);

  // Инициализация при загрузке или смене трека
  useEffect(() => {
    if (!album || albumsStatus !== 'succeeded') return;

    const track = album.tracks.find((t) => String(t.id) === trackId);
    if (!track) return;

    // Инициализируем только при смене трека
    if (currentTrackId !== String(track.id)) {
      setCurrentTrackId(String(track.id));

      // Загружаем текст из БД и авторство асинхронно
      (async () => {
        const [storedTextFromDb, storedAuthorshipFromDb] = await Promise.all([
          loadTrackTextFromDatabase(albumId, track.id, lang),
          loadAuthorshipFromStorage(albumId, track.id, lang),
        ]);

        // Используем текст из БД или текст из JSON (fallback)
        const initialText = storedTextFromDb || track.content || '';
        // Используем авторство из БД или из трека (fallback)
        const initialAuthorship = storedAuthorshipFromDb || track.authorship || '';

        setText(initialText);
        setAuthorship(initialAuthorship);
        setIsDirty(false);
      })();
    }
  }, [album, albumsStatus, albumId, trackId, lang, currentTrackId]);

  // Обработчик изменения текста
  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    setIsDirty(true);
  }, []);

  // Обработчик изменения авторства
  const handleAuthorshipChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setAuthorship(e.target.value);
    setIsDirty(true);
  }, []);

  // Применить форматирование
  const handleFormat = useCallback(() => {
    const formatted = formatTrackText(text);
    setText(formatted);
    setIsDirty(true);
  }, [text]);

  // Сохранить текст
  const handleSave = useCallback(async () => {
    if (!text.trim()) {
      alert('Текст не может быть пустым');
      return;
    }

    const trimmedAuthorship = authorship.trim();
    const result = await saveTrackText({
      albumId,
      trackId,
      lang,
      content: formattedText,
      authorship: trimmedAuthorship || undefined,
    });

    if (result.success) {
      setIsDirty(false);
      // Обновляем локальное состояние авторства, чтобы оно соответствовало сохранённому значению
      setAuthorship(trimmedAuthorship);
      alert('Текст успешно сохранён!');
    } else {
      alert(`Ошибка сохранения: ${result.message || 'Неизвестная ошибка'}`);
    }
  }, [albumId, trackId, lang, formattedText, authorship, text]);

  // Данные загружаются через loader

  if (albumsStatus === 'loading' || albumsStatus === 'idle') {
    return (
      <section className="admin-text main-background" aria-label="Редактирование текста">
        <div className="wrapper">
          <Loader />
        </div>
      </section>
    );
  }

  if (albumsStatus === 'failed') {
    return (
      <section className="admin-text main-background" aria-label="Редактирование текста">
        <div className="wrapper">
          <ErrorMessage error={albumsError || 'Не удалось загрузить данные трека'} />
        </div>
      </section>
    );
  }

  if (!album) {
    return (
      <section className="admin-text main-background" aria-label="Редактирование текста">
        <div className="wrapper">
          <ErrorMessage error={`Альбом "${albumId}" не найден`} />
        </div>
      </section>
    );
  }

  const track = album.tracks.find((t) => String(t.id) === trackId);

  if (!track) {
    return (
      <section className="admin-text main-background" aria-label="Редактирование текста">
        <div className="wrapper">
          <ErrorMessage
            error={`Трек #${trackId} не найден в альбоме "${album.album}". Доступные треки: ${album.tracks.map((t) => `${t.id} - ${t.title}`).join(', ')}`}
          />
        </div>
      </section>
    );
  }

  return (
    <section className="admin-text main-background" aria-label="Редактирование текста">
      <div className="wrapper">
        <div className="admin-text__header">
          <h1>Редактирование текста</h1>
          <h4>{track.title}</h4>
          <h4>Альбом: {album.album}</h4>
        </div>

        {/* Поле ввода авторства */}
        <div className="admin-text__authorship">
          <label htmlFor="authorship-input" className="admin-text__authorship-label">
            Авторство:
          </label>
          <input
            id="authorship-input"
            type="text"
            value={authorship}
            onChange={handleAuthorshipChange}
            placeholder="Например: Ярослав Жук — слова и музыка"
            className="admin-text__authorship-input"
          />
        </div>

        {/* Редактор текста */}
        <div className="admin-text__editor">
          <div className="admin-text__editor-controls">
            <button
              type="button"
              onClick={handleFormat}
              className="admin-text__format-btn"
              title="Применить форматирование (удалить лишние пробелы, нормализовать переносы строк)"
            >
              Форматировать
            </button>
            <span className="admin-text__char-count">
              Символов: {text.length} | Строк: {lineCount}
            </span>
          </div>
          <textarea
            value={text}
            onChange={handleTextChange}
            placeholder="Введите текст песни..."
            className="admin-text__textarea"
            rows={20}
          />
        </div>

        {/* Предпросмотр разбивки на строки */}
        {lines.length > 0 && (
          <div className="admin-text__preview">
            <h2>Предпросмотр (как будет разбит текст на строки):</h2>
            <div className="admin-text__preview-content">
              {lines.map((line, index) => (
                <div key={index} className="admin-text__preview-line">
                  <span className="admin-text__preview-number">{index + 1}</span>
                  <span className="admin-text__preview-text">{line}</span>
                </div>
              ))}
              {authorship && (
                <div className="admin-text__preview-line admin-text__preview-line--authorship">
                  <span className="admin-text__preview-number">~</span>
                  <span className="admin-text__preview-text">Авторство: {authorship}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Кнопки управления */}
        <div className="admin-text__controls">
          <div className="admin-text__controls-left">
            <button
              type="button"
              onClick={handleSave}
              disabled={!isDirty || !text.trim()}
              className="admin-text__save-btn"
            >
              Сохранить текст
            </button>
            {isDirty && (
              <span className="admin-text__dirty-indicator">Есть несохранённые изменения</span>
            )}
            {!isDirty && text.trim() && (
              <span className="admin-text__saved-indicator">Текст сохранён</span>
            )}
          </div>
          <button
            type="button"
            className={`admin-text__link-to-sync ${!isDirty && text.trim() ? 'admin-text__link-to-sync--active' : 'admin-text__link-to-sync--disabled'}`}
            onClick={() => {
              if (isDirty || !text.trim()) {
                alert('Сначала сохраните текст перед переходом к синхронизации');
                return;
              }
              if (onSyncOpen && albumId && trackId) {
                onSyncOpen(albumId, trackId);
              }
            }}
            disabled={isDirty || !text.trim()}
            title={isDirty || !text.trim() ? 'Сначала сохраните текст' : 'Перейти к синхронизации'}
          >
            Перейти к синхронизации →
          </button>
        </div>
      </div>
    </section>
  );
}
