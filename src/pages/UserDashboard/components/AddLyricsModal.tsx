// src/pages/UserDashboard/components/AddLyricsModal.tsx
import React, { useState } from 'react';
import { Popup } from '@shared/ui/popup';
import { useAppSelector } from '@shared/lib/hooks/useAppSelector';
import { selectUiDictionaryFirst } from '@shared/model/uiDictionary';
import { useLang } from '@app/providers/lang';
import './AddLyricsModal.style.scss';

interface AddLyricsModalProps {
  isOpen: boolean;
  trackTitle: string;
  onClose: () => void;
  onSave: () => void;
  onPreview?: () => void;
}

export function AddLyricsModal({
  isOpen,
  trackTitle,
  onClose,
  onSave,
  onPreview,
}: AddLyricsModalProps) {
  const { lang } = useLang();
  const ui = useAppSelector((state) => selectUiDictionaryFirst(state, lang));
  const [lyricsText, setLyricsText] = useState('');

  const handleSave = () => {
    onSave();
    setLyricsText('');
  };

  const handleClose = () => {
    setLyricsText('');
    onClose();
  };

  return (
    <Popup isActive={isOpen} onClose={handleClose}>
      <div className="add-lyrics-modal">
        <div className="add-lyrics-modal__card">
          <div className="add-lyrics-modal__header">
            <div className="add-lyrics-modal__header-content">
              <h2 className="add-lyrics-modal__title">
                {ui?.dashboard?.addLyrics ?? 'Add Lyrics'}
              </h2>
              <h3 className="add-lyrics-modal__subtitle">{trackTitle}</h3>
            </div>
            {onPreview && (
              <button
                type="button"
                className="add-lyrics-modal__preview-button"
                onClick={onPreview}
              >
                {ui?.dashboard?.preview ?? 'Preview'}
              </button>
            )}
          </div>
          <div className="add-lyrics-modal__divider"></div>
          <textarea
            className="add-lyrics-modal__textarea"
            placeholder={ui?.dashboard?.insertLyricsHere ?? 'Insert lyrics here…'}
            value={lyricsText}
            onChange={(e) => setLyricsText(e.target.value)}
          />
          <div className="add-lyrics-modal__divider"></div>
          <div className="add-lyrics-modal__actions">
            <button
              type="button"
              className="add-lyrics-modal__button add-lyrics-modal__button--cancel"
              onClick={handleClose}
            >
              {ui?.dashboard?.cancel ?? 'Cancel'}
            </button>
            <button
              type="button"
              className="add-lyrics-modal__button add-lyrics-modal__button--primary"
              onClick={handleSave}
            >
              {ui?.dashboard?.addLyrics ?? 'Add Lyrics'}
            </button>
          </div>
        </div>
      </div>
    </Popup>
  );
}
