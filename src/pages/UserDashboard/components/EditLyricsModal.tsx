// src/pages/UserDashboard/components/EditLyricsModal.tsx
import React, { useState } from 'react';
import { Popup } from '@shared/ui/popup';
import { useAppSelector } from '@shared/lib/hooks/useAppSelector';
import { selectUiDictionaryFirst } from '@shared/model/uiDictionary';
import { useLang } from '@app/providers/lang';
import './EditLyricsModal.style.scss';

interface EditLyricsModalProps {
  isOpen: boolean;
  initialLyrics: string;
  onClose: () => void;
  onSave: (lyrics: string) => void;
  onPreview?: () => void;
}

export function EditLyricsModal({
  isOpen,
  initialLyrics,
  onClose,
  onSave,
  onPreview,
}: EditLyricsModalProps) {
  const { lang } = useLang();
  const ui = useAppSelector((state) => selectUiDictionaryFirst(state, lang));
  const [lyricsText, setLyricsText] = useState(initialLyrics);

  const handleSave = () => {
    onSave(lyricsText);
    onClose();
  };

  const handleClose = () => {
    setLyricsText(initialLyrics);
    onClose();
  };

  return (
    <Popup isActive={isOpen} onClose={handleClose}>
      <div className="edit-lyrics-modal">
        <div className="edit-lyrics-modal__card">
          <div className="edit-lyrics-modal__header">
            <h2 className="edit-lyrics-modal__title">
              {ui?.dashboard?.editLyrics ?? 'Edit Lyrics'}
            </h2>
            {onPreview && (
              <button
                type="button"
                className="edit-lyrics-modal__preview-button"
                onClick={onPreview}
              >
                {ui?.dashboard?.preview ?? 'Preview'}
              </button>
            )}
          </div>
          <div className="edit-lyrics-modal__divider"></div>
          <textarea
            className="edit-lyrics-modal__textarea"
            value={lyricsText}
            onChange={(e) => setLyricsText(e.target.value)}
          />
          <div className="edit-lyrics-modal__divider"></div>
          <div className="edit-lyrics-modal__actions">
            <button
              type="button"
              className="edit-lyrics-modal__button edit-lyrics-modal__button--cancel"
              onClick={handleClose}
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
        </div>
      </div>
    </Popup>
  );
}
