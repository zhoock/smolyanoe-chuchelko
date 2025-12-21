// src/pages/UserDashboard/components/steps/EditAlbumModalStep3.tsx
import React from 'react';
import type { AlbumFormData } from '../EditAlbumModal.types';
import type { IInterface } from '@models';
import { EditableCardField } from '../shared/EditableCardField';
import '../shared/EditableCardField.style.scss';

interface EditAlbumModalStep3Props {
  formData: AlbumFormData;
  onFormDataChange: (field: keyof AlbumFormData, value: any) => void;
  ui?: IInterface;
}

export function EditAlbumModalStep3({ formData, onFormDataChange, ui }: EditAlbumModalStep3Props) {
  return (
    <>
      <div className="edit-album-modal__divider" />

      <div className="edit-album-modal__field">
        <label className="edit-album-modal__label">
          {ui?.dashboard?.editAlbumModal?.step3?.recordedAt ?? 'Recorded At'}
        </label>

        {formData.recordedAt.length > 0 && (
          <div className="edit-album-modal__list">
            {formData.recordedAt.map((entry, index) => {
              const isEditing = formData.editingRecordedAtIndex === index;
              return (
                <EditableCardField
                  key={index}
                  data={{
                    title: entry.text,
                    url: entry.url,
                  }}
                  isEditing={isEditing}
                  editTitle={formData.recordedAtText || ''}
                  editDescription=""
                  editUrl={formData.recordedAtURL || ''}
                  onTitleChange={(value) => onFormDataChange('recordedAtText', value)}
                  onDescriptionChange={() => {}}
                  onUrlChange={(value) => onFormDataChange('recordedAtURL', value)}
                  onEdit={() => {
                    onFormDataChange('editingRecordedAtIndex', index);
                    onFormDataChange('recordedAtText', entry.text);
                    onFormDataChange('recordedAtURL', entry.url || '');
                  }}
                  onSave={() => {
                    const updated = [...formData.recordedAt];
                    updated[index] = {
                      text: formData.recordedAtText!.trim(),
                      url: formData.recordedAtURL?.trim() || undefined,
                    };
                    onFormDataChange('recordedAt', updated);
                    onFormDataChange('recordedAtText', '');
                    onFormDataChange('recordedAtURL', '');
                    onFormDataChange('editingRecordedAtIndex', null);
                  }}
                  onCancel={() => {
                    onFormDataChange('recordedAtText', '');
                    onFormDataChange('recordedAtURL', '');
                    onFormDataChange('editingRecordedAtIndex', null);
                    onFormDataChange('showAddRecordedAtInputs', false);
                  }}
                  onRemove={() => {
                    const updated = [...formData.recordedAt];
                    updated.splice(index, 1);
                    onFormDataChange('recordedAt', updated);
                  }}
                  titlePlaceholder="Recording info (e.g., SEP. 28, 2021: Studio Name, Location.)"
                  descriptionPlaceholder=""
                  urlPlaceholder="URL (optional)"
                />
              );
            })}
          </div>
        )}

        {(formData.recordedAt.length === 0 || formData.showAddRecordedAtInputs === true) &&
          !formData.editingRecordedAtIndex && (
            <>
              <div className="edit-album-modal__two-column-inputs">
                <input
                  name="recorded-at-text"
                  type="text"
                  className="edit-album-modal__input"
                  placeholder="Recording info (e.g., SEP. 28, 2021: Studio Name, Location.)"
                  value={formData.recordedAtText || ''}
                  onChange={(e) => onFormDataChange('recordedAtText', e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && formData.recordedAtText?.trim()) {
                      e.preventDefault();
                      const text = formData.recordedAtText.trim();
                      const url = formData.recordedAtURL?.trim() || undefined;
                      const newEntry = { text, url };
                      onFormDataChange('recordedAt', [...formData.recordedAt, newEntry]);
                      onFormDataChange('recordedAtText', '');
                      onFormDataChange('recordedAtURL', '');
                      onFormDataChange('showAddRecordedAtInputs', false);
                    }
                    if (e.key === 'Escape') {
                      onFormDataChange('recordedAtText', '');
                      onFormDataChange('recordedAtURL', '');
                      onFormDataChange('showAddRecordedAtInputs', false);
                    }
                  }}
                />
                <input
                  name="recorded-at-url"
                  type="url"
                  autoComplete="url"
                  className="edit-album-modal__input"
                  placeholder="URL (optional)"
                  value={formData.recordedAtURL || ''}
                  onChange={(e) => onFormDataChange('recordedAtURL', e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && formData.recordedAtText?.trim()) {
                      e.preventDefault();
                      const text = formData.recordedAtText.trim();
                      const url = formData.recordedAtURL?.trim() || undefined;
                      const newEntry = { text, url };
                      onFormDataChange('recordedAt', [...formData.recordedAt, newEntry]);
                      onFormDataChange('recordedAtText', '');
                      onFormDataChange('recordedAtURL', '');
                      onFormDataChange('showAddRecordedAtInputs', false);
                    }
                    if (e.key === 'Escape') {
                      onFormDataChange('recordedAtText', '');
                      onFormDataChange('recordedAtURL', '');
                      onFormDataChange('showAddRecordedAtInputs', false);
                    }
                  }}
                />
              </div>
              {formData.recordedAtText?.trim() && (
                <button
                  type="button"
                  className="edit-album-modal__add-button"
                  onClick={() => {
                    const text = formData.recordedAtText!.trim();
                    const url = formData.recordedAtURL?.trim() || undefined;
                    const newEntry = { text, url };
                    onFormDataChange('recordedAt', [...formData.recordedAt, newEntry]);
                    onFormDataChange('recordedAtText', '');
                    onFormDataChange('recordedAtURL', '');
                    onFormDataChange('showAddRecordedAtInputs', false);
                  }}
                >
                  {ui?.dashboard?.editAlbumModal?.step3?.addButton ?? '+ Add'}
                </button>
              )}
            </>
          )}

        {formData.recordedAt &&
          formData.recordedAt.length > 0 &&
          formData.showAddRecordedAtInputs !== true &&
          !formData.editingRecordedAtIndex && (
            <button
              type="button"
              className="edit-album-modal__add-button"
              onClick={() => onFormDataChange('showAddRecordedAtInputs', true)}
            >
              {ui?.dashboard?.editAlbumModal?.step3?.addButton ?? '+ Add'}
            </button>
          )}
      </div>

      <div className="edit-album-modal__field">
        <label className="edit-album-modal__label">
          {ui?.dashboard?.editAlbumModal?.step3?.mixedAt ?? 'Mixed At'}
        </label>

        {formData.mixedAt.length > 0 && (
          <div className="edit-album-modal__list">
            {formData.mixedAt.map((entry, index) => {
              const isEditing = formData.editingMixedAtIndex === index;
              return (
                <EditableCardField
                  key={index}
                  data={{
                    title: entry.text,
                    url: entry.url,
                  }}
                  isEditing={isEditing}
                  editTitle={formData.mixedAtText || ''}
                  editDescription=""
                  editUrl={formData.mixedAtURL || ''}
                  onTitleChange={(value) => onFormDataChange('mixedAtText', value)}
                  onDescriptionChange={() => {}}
                  onUrlChange={(value) => onFormDataChange('mixedAtURL', value)}
                  onEdit={() => {
                    onFormDataChange('editingMixedAtIndex', index);
                    onFormDataChange('mixedAtText', entry.text);
                    onFormDataChange('mixedAtURL', entry.url || '');
                  }}
                  onSave={() => {
                    const updated = [...formData.mixedAt];
                    updated[index] = {
                      text: formData.mixedAtText!.trim(),
                      url: formData.mixedAtURL?.trim() || undefined,
                    };
                    onFormDataChange('mixedAt', updated);
                    onFormDataChange('mixedAtText', '');
                    onFormDataChange('mixedAtURL', '');
                    onFormDataChange('editingMixedAtIndex', null);
                  }}
                  onCancel={() => {
                    onFormDataChange('mixedAtText', '');
                    onFormDataChange('mixedAtURL', '');
                    onFormDataChange('editingMixedAtIndex', null);
                    onFormDataChange('showAddMixedAtInputs', false);
                  }}
                  onRemove={() => {
                    const updated = [...formData.mixedAt];
                    updated.splice(index, 1);
                    onFormDataChange('mixedAt', updated);
                  }}
                  titlePlaceholder="Mixing info (e.g., JAN. 14, 2024—SEP. 22, 2024: Studio Name, Location.)"
                  descriptionPlaceholder=""
                  urlPlaceholder="URL (optional)"
                />
              );
            })}
          </div>
        )}

        {(formData.mixedAt.length === 0 || formData.showAddMixedAtInputs === true) &&
          !formData.editingMixedAtIndex && (
            <>
              <div className="edit-album-modal__two-column-inputs">
                <input
                  name="mixed-at-text"
                  type="text"
                  className="edit-album-modal__input"
                  placeholder="Mixing info (e.g., JAN. 14, 2024—SEP. 22, 2024: Studio Name, Location.)"
                  value={formData.mixedAtText || ''}
                  onChange={(e) => onFormDataChange('mixedAtText', e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && formData.mixedAtText?.trim()) {
                      e.preventDefault();
                      const text = formData.mixedAtText.trim();
                      const url = formData.mixedAtURL?.trim() || undefined;
                      const newEntry = { text, url };
                      onFormDataChange('mixedAt', [...formData.mixedAt, newEntry]);
                      onFormDataChange('mixedAtText', '');
                      onFormDataChange('mixedAtURL', '');
                      onFormDataChange('showAddMixedAtInputs', false);
                    }
                    if (e.key === 'Escape') {
                      onFormDataChange('mixedAtText', '');
                      onFormDataChange('mixedAtURL', '');
                      onFormDataChange('showAddMixedAtInputs', false);
                    }
                  }}
                />
                <input
                  name="mixed-at-url"
                  type="url"
                  autoComplete="url"
                  className="edit-album-modal__input"
                  placeholder="URL (optional)"
                  value={formData.mixedAtURL || ''}
                  onChange={(e) => onFormDataChange('mixedAtURL', e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && formData.mixedAtText?.trim()) {
                      e.preventDefault();
                      const text = formData.mixedAtText.trim();
                      const url = formData.mixedAtURL?.trim() || undefined;
                      const newEntry = { text, url };
                      onFormDataChange('mixedAt', [...formData.mixedAt, newEntry]);
                      onFormDataChange('mixedAtText', '');
                      onFormDataChange('mixedAtURL', '');
                      onFormDataChange('showAddMixedAtInputs', false);
                    }
                    if (e.key === 'Escape') {
                      onFormDataChange('mixedAtText', '');
                      onFormDataChange('mixedAtURL', '');
                      onFormDataChange('showAddMixedAtInputs', false);
                    }
                  }}
                />
              </div>
              {formData.mixedAtText?.trim() && (
                <button
                  type="button"
                  className="edit-album-modal__add-button"
                  onClick={() => {
                    const text = formData.mixedAtText!.trim();
                    const url = formData.mixedAtURL?.trim() || undefined;
                    const newEntry = { text, url };
                    onFormDataChange('mixedAt', [...formData.mixedAt, newEntry]);
                    onFormDataChange('mixedAtText', '');
                    onFormDataChange('mixedAtURL', '');
                    onFormDataChange('showAddMixedAtInputs', false);
                  }}
                >
                  {ui?.dashboard?.editAlbumModal?.step3?.addButton ?? '+ Add'}
                </button>
              )}
            </>
          )}

        {formData.mixedAt &&
          formData.mixedAt.length > 0 &&
          formData.showAddMixedAtInputs !== true &&
          !formData.editingMixedAtIndex && (
            <button
              type="button"
              className="edit-album-modal__add-button"
              onClick={() => onFormDataChange('showAddMixedAtInputs', true)}
            >
              {ui?.dashboard?.editAlbumModal?.step3?.addButton ?? '+ Add'}
            </button>
          )}
      </div>

      <div className="edit-album-modal__field">
        <label className="edit-album-modal__label">
          {ui?.dashboard?.editAlbumModal?.step3?.masteredBy ?? 'Mastered By'}
        </label>

        {formData.mastering.length > 0 && (
          <div className="edit-album-modal__list">
            {formData.mastering.map((entry, index) => {
              const isEditing = formData.editingMasteringIndex === index;
              return (
                <EditableCardField
                  key={index}
                  data={{
                    title: entry.text,
                    url: entry.url,
                  }}
                  isEditing={isEditing}
                  editTitle={formData.masteringText || ''}
                  editDescription=""
                  editUrl={formData.masteringURL || ''}
                  onTitleChange={(value) => onFormDataChange('masteringText', value)}
                  onDescriptionChange={() => {}}
                  onUrlChange={(value) => onFormDataChange('masteringURL', value)}
                  onEdit={() => {
                    onFormDataChange('editingMasteringIndex', index);
                    onFormDataChange('masteringText', entry.text);
                    onFormDataChange('masteringURL', entry.url || '');
                  }}
                  onSave={() => {
                    const updated = [...formData.mastering];
                    updated[index] = {
                      text: formData.masteringText!.trim(),
                      url: formData.masteringURL?.trim() || undefined,
                    };
                    onFormDataChange('mastering', updated);
                    onFormDataChange('masteringText', '');
                    onFormDataChange('masteringURL', '');
                    onFormDataChange('editingMasteringIndex', null);
                  }}
                  onCancel={() => {
                    onFormDataChange('masteringText', '');
                    onFormDataChange('masteringURL', '');
                    onFormDataChange('editingMasteringIndex', null);
                    onFormDataChange('showAddMasteringInputs', false);
                  }}
                  onRemove={() => {
                    const updated = [...formData.mastering];
                    updated.splice(index, 1);
                    onFormDataChange('mastering', updated);
                  }}
                  titlePlaceholder="Mastering info (e.g., JAN. 14, 2025—FEB. 7, 2025: Chicago Mastering Service, Chicago, USA.)"
                  descriptionPlaceholder=""
                  urlPlaceholder="URL (optional)"
                />
              );
            })}
          </div>
        )}

        {(formData.mastering.length === 0 || formData.showAddMasteringInputs === true) &&
          !formData.editingMasteringIndex && (
            <>
              <div className="edit-album-modal__two-column-inputs">
                <input
                  name="mastering-text"
                  type="text"
                  className="edit-album-modal__input"
                  placeholder="Mastering info (e.g., JAN. 14, 2025—FEB. 7, 2025: Chicago Mastering Service, Chicago, USA.)"
                  value={formData.masteringText || ''}
                  onChange={(e) => onFormDataChange('masteringText', e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && formData.masteringText?.trim()) {
                      e.preventDefault();
                      const text = formData.masteringText.trim();
                      const url = formData.masteringURL?.trim() || undefined;
                      const newEntry = { text, url };
                      onFormDataChange('mastering', [...formData.mastering, newEntry]);
                      onFormDataChange('masteringText', '');
                      onFormDataChange('masteringURL', '');
                      onFormDataChange('showAddMasteringInputs', false);
                    }
                    if (e.key === 'Escape') {
                      onFormDataChange('masteringText', '');
                      onFormDataChange('masteringURL', '');
                      onFormDataChange('showAddMasteringInputs', false);
                    }
                  }}
                />
                <input
                  name="mastering-url"
                  type="url"
                  autoComplete="url"
                  className="edit-album-modal__input"
                  placeholder="URL (optional)"
                  value={formData.masteringURL || ''}
                  onChange={(e) => onFormDataChange('masteringURL', e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && formData.masteringText?.trim()) {
                      e.preventDefault();
                      const text = formData.masteringText.trim();
                      const url = formData.masteringURL?.trim() || undefined;
                      const newEntry = { text, url };
                      onFormDataChange('mastering', [...formData.mastering, newEntry]);
                      onFormDataChange('masteringText', '');
                      onFormDataChange('masteringURL', '');
                      onFormDataChange('showAddMasteringInputs', false);
                    }
                    if (e.key === 'Escape') {
                      onFormDataChange('masteringText', '');
                      onFormDataChange('masteringURL', '');
                      onFormDataChange('showAddMasteringInputs', false);
                    }
                  }}
                />
              </div>
              {formData.masteringText?.trim() && (
                <button
                  type="button"
                  className="edit-album-modal__add-button"
                  onClick={() => {
                    const text = formData.masteringText!.trim();
                    const url = formData.masteringURL?.trim() || undefined;
                    const newEntry = { text, url };
                    onFormDataChange('mastering', [...formData.mastering, newEntry]);
                    onFormDataChange('masteringText', '');
                    onFormDataChange('masteringURL', '');
                    onFormDataChange('showAddMasteringInputs', false);
                  }}
                >
                  {ui?.dashboard?.editAlbumModal?.step3?.addButton ?? '+ Add'}
                </button>
              )}
            </>
          )}

        {formData.mastering &&
          formData.mastering.length > 0 &&
          formData.showAddMasteringInputs !== true &&
          !formData.editingMasteringIndex && (
            <button
              type="button"
              className="edit-album-modal__add-button"
              onClick={() => onFormDataChange('showAddMasteringInputs', true)}
            >
              {ui?.dashboard?.editAlbumModal?.step3?.addButton ?? '+ Add'}
            </button>
          )}
      </div>
    </>
  );
}
