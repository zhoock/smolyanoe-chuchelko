// src/pages/UserDashboard/components/EditLyricsModal.tsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Popup } from '@shared/ui/popup';
import { useAppSelector } from '@shared/lib/hooks/useAppSelector';
import { selectUiDictionaryFirst } from '@shared/model/uiDictionary';
import { useLang } from '@app/providers/lang';
import './EditLyricsModal.style.scss';

interface EditLyricsModalProps {
  isOpen: boolean;
  initialLyrics: string;
  initialAuthorship?: string;
  onClose: () => void;
  onSave: (lyrics: string, authorship?: string) => Promise<void> | void;
}

export function EditLyricsModal({
  isOpen,
  initialLyrics,
  initialAuthorship,
  onClose,
  onSave,
}: EditLyricsModalProps) {
  const { lang } = useLang();
  const ui = useAppSelector((state) => selectUiDictionaryFirst(state, lang));
  const [lyricsText, setLyricsText] = useState(initialLyrics);
  const [authorship, setAuthorship] = useState(initialAuthorship || '');

  // Исходные значения для отслеживания изменений
  const [initialLyricsValue, setInitialLyricsValue] = useState(initialLyrics);
  const [initialAuthorshipValue, setInitialAuthorshipValue] = useState(initialAuthorship || '');

  // Обновляем состояние при изменении initialLyrics или initialAuthorship
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[EditLyricsModal] initialLyrics changed:', {
        initialLyricsLength: initialLyrics.length,
        currentLyricsLength: lyricsText.length,
        isOpen,
      });
    }
    // Обновляем только если модалка открыта, чтобы не сбрасывать изменения пользователя при закрытии
    if (isOpen) {
      setLyricsText(initialLyrics);
      setAuthorship(initialAuthorship || '');
      setInitialLyricsValue(initialLyrics);
      setInitialAuthorshipValue(initialAuthorship || '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialLyrics, initialAuthorship, isOpen]);

  // Проверка наличия изменений
  const hasChanges = useMemo(() => {
    return (
      lyricsText.trim() !== initialLyricsValue.trim() ||
      authorship.trim() !== initialAuthorshipValue.trim()
    );
  }, [lyricsText, initialLyricsValue, authorship, initialAuthorshipValue]);

  // Отмена изменений
  const handleCancel = useCallback(() => {
    setLyricsText(initialLyricsValue);
    setAuthorship(initialAuthorshipValue);
  }, [initialLyricsValue, initialAuthorshipValue]);

  const handleSave = async () => {
    try {
      await onSave(lyricsText, authorship.trim() || undefined);
      // Обновляем начальные значения после успешного сохранения
      setInitialLyricsValue(lyricsText);
      setInitialAuthorshipValue(authorship.trim() || '');
      // Закрываем модальное окно только после успешного сохранения
      onClose();
    } catch (error) {
      console.error('Error saving lyrics:', error);
      // Не закрываем модальное окно при ошибке
    }
  };

  // Обработка закрытия модального окна
  const handleClose = useCallback(() => {
    if (hasChanges) {
      // Если есть изменения, отменяем их и закрываем
      handleCancel();
    }
    onClose();
  }, [hasChanges, handleCancel, onClose]);

  return (
    <Popup isActive={isOpen} onClose={handleClose}>
      <div className="edit-lyrics-modal">
        <div className="edit-lyrics-modal__card">
          <div className="edit-lyrics-modal__header">
            <button
              type="button"
              className="edit-lyrics-modal__close"
              onClick={handleClose}
              aria-label={ui?.dashboard?.close ?? 'Закрыть'}
            >
              ×
            </button>
            <h2 className="edit-lyrics-modal__title">
              {ui?.dashboard?.editLyrics ?? 'Edit Lyrics'}
            </h2>
          </div>
          <div className="edit-lyrics-modal__content">
            <div className="edit-lyrics-modal__divider"></div>
            <textarea
              className="edit-lyrics-modal__textarea"
              value={lyricsText}
              onChange={(e) => setLyricsText(e.target.value)}
            />
            <div className="edit-lyrics-modal__divider"></div>
            <div className="edit-lyrics-modal__field">
              <label className="edit-lyrics-modal__label">
                {ui?.dashboard?.authorship ?? 'Authorship:'}
              </label>
              <input
                type="text"
                className="edit-lyrics-modal__input"
                name="authorship"
                id="authorship"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                data-gramm="false"
                data-lpignore="true"
                data-form-type="other"
                inputMode="text"
                aria-autocomplete="none"
                placeholder={
                  ui?.dashboard?.authorshipPlaceholder ??
                  'For example: Yaroslav Zhuk — words and music'
                }
                value={authorship}
                onChange={(e) => setAuthorship(e.target.value)}
                onFocus={(e) => {
                  // Предотвращаем всплытие события, чтобы избежать конфликтов с расширениями браузера
                  e.stopPropagation();
                }}
                onBlur={(e) => {
                  e.stopPropagation();
                }}
                onClick={(e) => {
                  e.stopPropagation();
                }}
                onKeyDown={(e) => {
                  e.stopPropagation();
                }}
                onKeyUp={(e) => {
                  e.stopPropagation();
                }}
                onKeyPress={(e) => {
                  e.stopPropagation();
                }}
                onInput={(e) => {
                  e.stopPropagation();
                }}
              />
            </div>
          </div>

          {/* Footer с кнопками - показывается только при наличии изменений */}
          {hasChanges && (
            <div className="edit-lyrics-modal__footer">
              <button
                type="button"
                className="edit-lyrics-modal__button edit-lyrics-modal__button--cancel"
                onClick={handleCancel}
              >
                {ui?.dashboard?.cancel ?? 'Cancel'}
              </button>
              <button
                type="button"
                className="edit-lyrics-modal__button edit-lyrics-modal__button--primary"
                onClick={handleSave}
              >
                {ui?.dashboard?.save ?? 'Save'}
              </button>
            </div>
          )}
        </div>
      </div>
    </Popup>
  );
}
