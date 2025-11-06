// src/pages/AdminText/AdminText.tsx
/**
 * Админ-страница для редактирования текста песни.
 * Позволяет вводить и форматировать текст песни перед синхронизацией.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAlbumsData } from '@hooks/data';
import { DataAwait } from '@shared/DataAwait';
import { useLang } from '@contexts/lang';
import { Loader } from '@shared/ui/loader';
import { ErrorMessage } from '@shared/ui/error-message';
import {
  saveTrackText,
  loadTrackTextFromStorage,
  formatTrackText,
  splitTextIntoLines,
  countLines,
} from '../../utils/trackText';
import { loadAuthorshipFromStorage } from '../../utils/syncedLyrics';
import './style.scss';

export default function AdminText() {
  const { lang } = useLang();
  const data = useAlbumsData(lang);
  const { albumId = '', trackId = '' } = useParams<{ albumId: string; trackId: string }>();

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
    if (!data) return;

    data.templateA.then((albums) => {
      const album = albums.find((a) => a.albumId === albumId);
      const track = album?.tracks.find((t) => String(t.id) === trackId);

      if (!track) return;

      // Инициализируем только при смене трека
      if (currentTrackId !== String(track.id)) {
        setCurrentTrackId(String(track.id));

        // Загружаем сохранённый текст из localStorage (dev mode)
        const storedText = loadTrackTextFromStorage(albumId, track.id, lang);
        const storedAuthorship = loadAuthorshipFromStorage(albumId, track.id, lang);

        // Используем сохранённый текст или текст из JSON
        const initialText = storedText || track.content || '';
        const initialAuthorship = storedAuthorship || track.authorship || '';

        setText(initialText);
        setAuthorship(initialAuthorship);
        setIsDirty(false);
      }
    });
  }, [data, albumId, trackId, lang, currentTrackId]);

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

    const result = await saveTrackText({
      albumId,
      trackId,
      lang,
      content: formattedText,
      authorship: authorship.trim() || undefined,
    });

    if (result.success) {
      setIsDirty(false);
      alert('✅ Текст успешно сохранён!');
    } else {
      alert(`❌ Ошибка сохранения: ${result.message || 'Неизвестная ошибка'}`);
    }
  }, [albumId, trackId, lang, formattedText, authorship]);

  if (!data) {
    return (
      <div className="admin-text">
        <Loader />
      </div>
    );
  }

  return (
    <div className="admin-text">
      <DataAwait
        value={data.templateA}
        fallback={<Loader />}
        error={<ErrorMessage error="Не удалось загрузить данные трека" />}
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

          const track = album.tracks.find((t) => String(t.id) === trackId);

          if (!track) {
            return (
              <ErrorMessage
                error={`Трек #${trackId} не найден в альбоме "${album.album}". Доступные треки: ${album.tracks.map((t) => `${t.id} - ${t.title}`).join(', ')}`}
              />
            );
          }

          return (
            <>
              <div className="admin-text__header">
                <h1>Редактирование текста: {track.title}</h1>
                <p>
                  Альбом: {album.album} | Строк в тексте: {lineCount} | Авторство:{' '}
                  {authorship || 'не указано'}
                </p>
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
                    <span className="admin-text__dirty-indicator">
                      Есть несохранённые изменения
                    </span>
                  )}
                  {!isDirty && text.trim() && (
                    <span className="admin-text__saved-indicator">Текст сохранён</span>
                  )}
                </div>
                <Link
                  to={`/admin/sync/${albumId}/${trackId}`}
                  className={`admin-text__link-to-sync ${!isDirty && text.trim() ? 'admin-text__link-to-sync--active' : 'admin-text__link-to-sync--disabled'}`}
                  onClick={(e) => {
                    if (isDirty || !text.trim()) {
                      e.preventDefault();
                      alert('Сначала сохраните текст перед переходом к синхронизации');
                    }
                  }}
                  title={
                    isDirty || !text.trim() ? 'Сначала сохраните текст' : 'Перейти к синхронизации'
                  }
                >
                  Перейти к синхронизации →
                </Link>
              </div>
            </>
          );
        }}
      </DataAwait>
    </div>
  );
}
