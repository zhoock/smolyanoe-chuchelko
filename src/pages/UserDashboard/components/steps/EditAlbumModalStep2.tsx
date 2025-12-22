// src/pages/UserDashboard/components/steps/EditAlbumModalStep2.tsx
import React from 'react';
import type { AlbumFormData } from '../EditAlbumModal.types';
import type { IInterface } from '@models';
import { GENRE_OPTIONS_EN, GENRE_OPTIONS_RU, MAX_TAGS } from '../EditAlbumModal.constants';
import type { SupportedLang } from '@shared/model/lang';

interface EditAlbumModalStep2Props {
  formData: AlbumFormData;
  lang: SupportedLang;
  moodDropdownOpen: boolean;
  tagInput: string;
  tagError: string;
  moodDropdownRef: React.RefObject<HTMLDivElement>;
  tagInputRef: React.RefObject<HTMLInputElement>;
  onMoodDropdownToggle: () => void;
  onMoodToggle: (mood: string) => void;
  onRemoveMood: (mood: string) => void;
  onTagInputChange: (value: string) => void;
  onTagInputKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onAddTag: () => void;
  onRemoveTag: (tag: string) => void;
  ui?: IInterface;
}

export function EditAlbumModalStep2({
  formData,
  lang,
  moodDropdownOpen,
  tagInput,
  tagError,
  moodDropdownRef,
  tagInputRef,
  onMoodDropdownToggle,
  onMoodToggle,
  onRemoveMood,
  onTagInputChange,
  onTagInputKeyDown,
  onAddTag,
  onRemoveTag,
  ui,
}: EditAlbumModalStep2Props) {
  const genreOptions = lang === 'ru' ? GENRE_OPTIONS_RU : GENRE_OPTIONS_EN;

  return (
    <>
      <div className="edit-album-modal__divider" />

      <div className="edit-album-modal__field">
        <label className="edit-album-modal__label">
          {ui?.dashboard?.editAlbumModal?.step2?.mood ?? 'Genre'}
        </label>

        <div className="edit-album-modal__multiselect" ref={moodDropdownRef}>
          <div className="edit-album-modal__multiselect-input" onClick={onMoodDropdownToggle}>
            {formData.mood.length > 0 ? (
              <div className="edit-album-modal__tags-container">
                {formData.mood.map((mood) => (
                  <span key={mood} className="edit-album-modal__tag">
                    {mood}
                    <button
                      type="button"
                      className="edit-album-modal__tag-remove"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveMood(mood);
                      }}
                      aria-label={`${ui?.dashboard?.editAlbumModal?.step2?.removeTag ?? 'Remove'} ${mood}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <span className="edit-album-modal__multiselect-placeholder">
                {ui?.dashboard?.editAlbumModal?.step2?.selectGenres ?? 'Select genres...'}
              </span>
            )}

            <span className="edit-album-modal__multiselect-arrow">
              {moodDropdownOpen ? '⌃' : '⌄'}
            </span>
          </div>

          {moodDropdownOpen && (
            <div className="edit-album-modal__multiselect-dropdown">
              {genreOptions.map((mood: string) => (
                <label key={mood} className="edit-album-modal__multiselect-option">
                  <input
                    type="checkbox"
                    checked={formData.mood.includes(mood)}
                    onChange={() => onMoodToggle(mood)}
                  />
                  <span>{mood}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="edit-album-modal__field">
        <label className="edit-album-modal__label">
          {ui?.dashboard?.editAlbumModal?.step2?.tags ?? 'Tags'}
        </label>

        <div className="edit-album-modal__tags-input-wrapper">
          {formData.tags.length > 0 && (
            <div className="edit-album-modal__tags-container">
              {formData.tags.map((tag) => (
                <span key={tag} className="edit-album-modal__tag">
                  {tag}
                  <button
                    type="button"
                    className="edit-album-modal__tag-remove"
                    onClick={() => onRemoveTag(tag)}
                    aria-label={`${ui?.dashboard?.editAlbumModal?.step2?.removeTag ?? 'Remove'} ${tag}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="edit-album-modal__tags-input-group">
            <input
              ref={tagInputRef}
              name="tag-input"
              type="text"
              autoComplete="off"
              className="edit-album-modal__input edit-album-modal__input--tags"
              placeholder={
                ui?.dashboard?.editAlbumModal?.step2?.addTagPlaceholder ?? 'Add a tag...'
              }
              value={tagInput}
              onChange={(e) => {
                onTagInputChange(e.target.value);
              }}
              onKeyDown={onTagInputKeyDown}
              disabled={formData.tags.length >= MAX_TAGS}
            />
            <button
              type="button"
              className="edit-album-modal__add-tag-button"
              onClick={onAddTag}
              disabled={formData.tags.length >= MAX_TAGS || !tagInput.trim()}
            >
              {ui?.dashboard?.editAlbumModal?.step2?.addTagButton ?? 'Add +'}
            </button>
          </div>

          {tagError && <div className="edit-album-modal__error">{tagError}</div>}
          {formData.tags.length >= MAX_TAGS && (
            <div className="edit-album-modal__help-text">
              {ui?.dashboard?.editAlbumModal?.step2?.maxTagsReached?.replace(
                '{maxTags}',
                String(MAX_TAGS)
              ) ?? `Maximum ${MAX_TAGS} tags reached`}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
