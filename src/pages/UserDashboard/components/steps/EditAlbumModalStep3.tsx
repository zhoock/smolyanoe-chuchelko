// src/pages/UserDashboard/components/steps/EditAlbumModalStep3.tsx
import React from 'react';
import type { AlbumFormData } from '../modals/album/EditAlbumModal.types';
import type { IInterface } from '@models';
import '../shared/EditableCardField.style.scss';

import { parseRecordingText, buildRecordingText } from '../modals/album/EditAlbumModal.utils';

interface EditAlbumModalStep3Props {
  formData: AlbumFormData;
  onFormDataChange: (field: keyof AlbumFormData, value: any) => void;
  ui?: IInterface;
}

interface RecordingEntryEditorProps {
  data: {
    text: string;
    url?: string;
  };
  isEditing: boolean;
  dateFrom: string;
  dateTo: string;
  studioText: string;
  city: string;
  url: string;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onStudioTextChange: (value: string) => void;
  onCityChange: (value: string) => void;
  onUrlChange: (value: string) => void;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onRemove: () => void;
  ui?: IInterface;
}

function RecordingEntryEditor({
  data,
  isEditing,
  dateFrom,
  dateTo,
  studioText,
  city,
  url,
  onDateFromChange,
  onDateToChange,
  onStudioTextChange,
  onCityChange,
  onUrlChange,
  onEdit,
  onSave,
  onCancel,
  onRemove,
  ui,
}: RecordingEntryEditorProps) {
  if (isEditing) {
    return (
      <div className="edit-album-modal__list-item edit-album-modal__list-item--editing">
        <div className="edit-album-modal__list-item-edit-wrapper">
          <div className="edit-album-modal__two-column-inputs">
            <input
              type="date"
              className="edit-album-modal__list-item-input edit-album-modal__list-item-input--title"
              placeholder="From"
              value={dateFrom}
              onChange={(e) => onDateFromChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  onSave();
                }
                if (e.key === 'Escape') {
                  e.preventDefault();
                  onCancel();
                }
              }}
            />
            <input
              type="date"
              className="edit-album-modal__list-item-input edit-album-modal__list-item-input--title"
              placeholder="To"
              value={dateTo}
              onChange={(e) => onDateToChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  onSave();
                }
                if (e.key === 'Escape') {
                  e.preventDefault();
                  onCancel();
                }
              }}
            />
          </div>
          <input
            type="text"
            className="edit-album-modal__list-item-input edit-album-modal__list-item-input--description"
            placeholder="Studio info"
            value={studioText}
            onChange={(e) => onStudioTextChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onSave();
              }
              if (e.key === 'Escape') {
                e.preventDefault();
                onCancel();
              }
            }}
          />
          <input
            type="text"
            className="edit-album-modal__list-item-input edit-album-modal__list-item-input--description"
            placeholder="City"
            value={city}
            onChange={(e) => onCityChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onSave();
              }
              if (e.key === 'Escape') {
                e.preventDefault();
                onCancel();
              }
            }}
          />
          <input
            type="url"
            className="edit-album-modal__list-item-input edit-album-modal__list-item-input--url"
            placeholder="URL (optional)"
            value={url}
            onChange={(e) => onUrlChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onSave();
              }
              if (e.key === 'Escape') {
                e.preventDefault();
                onCancel();
              }
            }}
          />
          <div className="edit-album-modal__list-item-actions">
            <button type="button" className="edit-album-modal__list-item-save" onClick={onSave}>
              {ui?.dashboard?.editAlbumModal?.step5?.save ?? 'Save'}
            </button>
            <button type="button" className="edit-album-modal__list-item-cancel" onClick={onCancel}>
              {ui?.dashboard?.editAlbumModal?.step5?.cancel ?? 'Cancel'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="edit-album-modal__list-item">
      <div className="edit-album-modal__list-item-content">
        <span className="edit-album-modal__list-item-name">{data.text}</span>
        {data.url && <span className="edit-album-modal__list-item-url">{data.url}</span>}
      </div>
      <div className="edit-album-modal__list-item-actions">
        <button
          type="button"
          className="edit-album-modal__list-item-edit"
          onClick={onEdit}
          aria-label="Edit"
        >
          ✎
        </button>
        <button
          type="button"
          className="edit-album-modal__list-item-remove"
          onClick={onRemove}
          aria-label="Remove"
        >
          ×
        </button>
      </div>
    </div>
  );
}

export function EditAlbumModalStep3({ formData, onFormDataChange, ui }: EditAlbumModalStep3Props) {
  return (
    <>
      <div className="edit-album-modal__divider" />

      {/* Recorded At */}
      <div className="edit-album-modal__field">
        <label className="edit-album-modal__label">
          {ui?.dashboard?.editAlbumModal?.step3?.recordedAt ?? 'Recorded At'}
        </label>

        {formData.recordedAt.length > 0 && (
          <div className="edit-album-modal__list">
            {formData.recordedAt.map((entry, index) => {
              const isEditing = formData.editingRecordedAtIndex === index;
              // Парсим только если нет прямых полей (для обратной совместимости)
              const parsed = entry.dateFrom ? {} : parseRecordingText(entry.text);

              return (
                <RecordingEntryEditor
                  key={index}
                  data={{
                    text: entry.text,
                    url: entry.url,
                  }}
                  isEditing={isEditing}
                  dateFrom={
                    isEditing
                      ? (formData.recordedAtDateFrom ?? '')
                      : formData.recordedAtDateFrom || entry.dateFrom || parsed.dateFrom || ''
                  }
                  dateTo={
                    isEditing
                      ? (formData.recordedAtDateTo ?? '')
                      : formData.recordedAtDateTo || entry.dateTo || parsed.dateTo || ''
                  }
                  studioText={
                    isEditing
                      ? (formData.recordedAtText ?? '')
                      : formData.recordedAtText || entry.studioText || parsed.studioText || ''
                  }
                  city={
                    isEditing
                      ? (formData.recordedAtCity ?? '')
                      : formData.recordedAtCity || entry.city || ''
                  }
                  url={
                    isEditing
                      ? (formData.recordedAtURL ?? '')
                      : formData.recordedAtURL || entry.url || ''
                  }
                  onDateFromChange={(value: string) =>
                    onFormDataChange('recordedAtDateFrom', value)
                  }
                  onDateToChange={(value: string) => onFormDataChange('recordedAtDateTo', value)}
                  onStudioTextChange={(value: string) => onFormDataChange('recordedAtText', value)}
                  onCityChange={(value: string) => onFormDataChange('recordedAtCity', value)}
                  onUrlChange={(value: string) => onFormDataChange('recordedAtURL', value)}
                  onEdit={() => {
                    onFormDataChange('editingRecordedAtIndex', index);
                    onFormDataChange('recordedAtDateFrom', entry.dateFrom || parsed.dateFrom || '');
                    onFormDataChange('recordedAtDateTo', entry.dateTo || parsed.dateTo || '');
                    onFormDataChange('recordedAtText', entry.studioText || parsed.studioText || '');
                    onFormDataChange('recordedAtCity', entry.city || '');
                    onFormDataChange('recordedAtURL', entry.url || '');
                  }}
                  onSave={() => {
                    const updated = [...formData.recordedAt];
                    const text = buildRecordingText(
                      formData.recordedAtDateFrom,
                      formData.recordedAtDateTo,
                      formData.recordedAtText?.trim(),
                      formData.recordedAtCity?.trim()
                    );
                    updated[index] = {
                      text,
                      url: formData.recordedAtURL?.trim() || undefined,
                      dateFrom: formData.recordedAtDateFrom,
                      dateTo: formData.recordedAtDateTo,
                      studioText: formData.recordedAtText?.trim(),
                      city: formData.recordedAtCity?.trim(),
                    };
                    onFormDataChange('recordedAt', updated);
                    onFormDataChange('recordedAtDateFrom', '');
                    onFormDataChange('recordedAtDateTo', '');
                    onFormDataChange('recordedAtText', '');
                    onFormDataChange('recordedAtCity', '');
                    onFormDataChange('recordedAtURL', '');
                    onFormDataChange('editingRecordedAtIndex', null);
                  }}
                  onCancel={() => {
                    onFormDataChange('recordedAtDateFrom', '');
                    onFormDataChange('recordedAtDateTo', '');
                    onFormDataChange('recordedAtText', '');
                    onFormDataChange('recordedAtCity', '');
                    onFormDataChange('recordedAtURL', '');
                    onFormDataChange('editingRecordedAtIndex', null);
                    onFormDataChange('showAddRecordedAtInputs', false);
                  }}
                  onRemove={() => {
                    const updated = [...formData.recordedAt];
                    updated.splice(index, 1);
                    onFormDataChange('recordedAt', updated);
                  }}
                  ui={ui}
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
                  name="recorded-at-date-from"
                  type="date"
                  className="edit-album-modal__input"
                  placeholder="From"
                  value={formData.recordedAtDateFrom || ''}
                  onChange={(e) => onFormDataChange('recordedAtDateFrom', e.target.value)}
                />
                <input
                  name="recorded-at-date-to"
                  type="date"
                  className="edit-album-modal__input"
                  placeholder="To"
                  value={formData.recordedAtDateTo || ''}
                  onChange={(e) => onFormDataChange('recordedAtDateTo', e.target.value)}
                />
              </div>
              <input
                name="recorded-at-text"
                type="text"
                className="edit-album-modal__input"
                placeholder="Studio info (e.g., Igor Matvienko's recording studio M.A.M.A, Big studio)"
                value={formData.recordedAtText || ''}
                onChange={(e) => onFormDataChange('recordedAtText', e.target.value)}
                onKeyDown={(e) => {
                  if (
                    e.key === 'Enter' &&
                    (formData.recordedAtText?.trim() ||
                      formData.recordedAtCity?.trim() ||
                      formData.recordedAtDateFrom ||
                      formData.recordedAtDateTo)
                  ) {
                    e.preventDefault();
                    const text = buildRecordingText(
                      formData.recordedAtDateFrom,
                      formData.recordedAtDateTo,
                      formData.recordedAtText?.trim(),
                      formData.recordedAtCity?.trim()
                    );
                    const url = formData.recordedAtURL?.trim() || undefined;
                    const newEntry = {
                      text,
                      url,
                      dateFrom: formData.recordedAtDateFrom,
                      dateTo: formData.recordedAtDateTo,
                      studioText: formData.recordedAtText?.trim(),
                      city: formData.recordedAtCity?.trim(),
                    };
                    onFormDataChange('recordedAt', [...formData.recordedAt, newEntry]);
                    onFormDataChange('recordedAtDateFrom', '');
                    onFormDataChange('recordedAtDateTo', '');
                    onFormDataChange('recordedAtText', '');
                    onFormDataChange('recordedAtCity', '');
                    onFormDataChange('recordedAtURL', '');
                    onFormDataChange('showAddRecordedAtInputs', false);
                  }
                  if (e.key === 'Escape') {
                    onFormDataChange('recordedAtDateFrom', '');
                    onFormDataChange('recordedAtDateTo', '');
                    onFormDataChange('recordedAtText', '');
                    onFormDataChange('recordedAtCity', '');
                    onFormDataChange('recordedAtURL', '');
                    onFormDataChange('showAddRecordedAtInputs', false);
                  }
                }}
              />
              <input
                name="recorded-at-city"
                type="text"
                className="edit-album-modal__input"
                placeholder="City (e.g., Moscow)"
                value={formData.recordedAtCity || ''}
                onChange={(e) => onFormDataChange('recordedAtCity', e.target.value)}
                onKeyDown={(e) => {
                  if (
                    e.key === 'Enter' &&
                    (formData.recordedAtText?.trim() ||
                      formData.recordedAtCity?.trim() ||
                      formData.recordedAtDateFrom ||
                      formData.recordedAtDateTo)
                  ) {
                    e.preventDefault();
                    const text = buildRecordingText(
                      formData.recordedAtDateFrom,
                      formData.recordedAtDateTo,
                      formData.recordedAtText?.trim(),
                      formData.recordedAtCity?.trim()
                    );
                    const url = formData.recordedAtURL?.trim() || undefined;
                    const newEntry = {
                      text,
                      url,
                      dateFrom: formData.recordedAtDateFrom,
                      dateTo: formData.recordedAtDateTo,
                      studioText: formData.recordedAtText?.trim(),
                      city: formData.recordedAtCity?.trim(),
                    };
                    onFormDataChange('recordedAt', [...formData.recordedAt, newEntry]);
                    onFormDataChange('recordedAtDateFrom', '');
                    onFormDataChange('recordedAtDateTo', '');
                    onFormDataChange('recordedAtText', '');
                    onFormDataChange('recordedAtCity', '');
                    onFormDataChange('recordedAtURL', '');
                    onFormDataChange('showAddRecordedAtInputs', false);
                  }
                  if (e.key === 'Escape') {
                    onFormDataChange('recordedAtDateFrom', '');
                    onFormDataChange('recordedAtDateTo', '');
                    onFormDataChange('recordedAtText', '');
                    onFormDataChange('recordedAtCity', '');
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
                  if (
                    e.key === 'Enter' &&
                    (formData.recordedAtText?.trim() ||
                      formData.recordedAtDateFrom ||
                      formData.recordedAtDateTo)
                  ) {
                    e.preventDefault();
                    const text = buildRecordingText(
                      formData.recordedAtDateFrom,
                      formData.recordedAtDateTo,
                      formData.recordedAtText?.trim(),
                      formData.recordedAtCity?.trim()
                    );
                    const url = formData.recordedAtURL?.trim() || undefined;
                    const newEntry = {
                      text,
                      url,
                      dateFrom: formData.recordedAtDateFrom,
                      dateTo: formData.recordedAtDateTo,
                      studioText: formData.recordedAtText?.trim(),
                    };
                    onFormDataChange('recordedAt', [...formData.recordedAt, newEntry]);
                    onFormDataChange('recordedAtDateFrom', '');
                    onFormDataChange('recordedAtDateTo', '');
                    onFormDataChange('recordedAtText', '');
                    onFormDataChange('recordedAtURL', '');
                    onFormDataChange('showAddRecordedAtInputs', false);
                  }
                  if (e.key === 'Escape') {
                    onFormDataChange('recordedAtDateFrom', '');
                    onFormDataChange('recordedAtDateTo', '');
                    onFormDataChange('recordedAtText', '');
                    onFormDataChange('recordedAtURL', '');
                    onFormDataChange('showAddRecordedAtInputs', false);
                  }
                }}
              />
              {(formData.recordedAtText?.trim() ||
                formData.recordedAtCity?.trim() ||
                formData.recordedAtDateFrom ||
                formData.recordedAtDateTo) && (
                <button
                  type="button"
                  className="edit-album-modal__add-button"
                  onClick={() => {
                    const text = buildRecordingText(
                      formData.recordedAtDateFrom,
                      formData.recordedAtDateTo,
                      formData.recordedAtText?.trim(),
                      formData.recordedAtCity?.trim()
                    );
                    const url = formData.recordedAtURL?.trim() || undefined;
                    const newEntry = {
                      text,
                      url,
                      dateFrom: formData.recordedAtDateFrom,
                      dateTo: formData.recordedAtDateTo,
                      studioText: formData.recordedAtText?.trim(),
                      city: formData.recordedAtCity?.trim(),
                    };
                    onFormDataChange('recordedAt', [...formData.recordedAt, newEntry]);
                    onFormDataChange('recordedAtDateFrom', '');
                    onFormDataChange('recordedAtDateTo', '');
                    onFormDataChange('recordedAtText', '');
                    onFormDataChange('recordedAtCity', '');
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

      {/* Mixed At */}
      <div className="edit-album-modal__field">
        <label className="edit-album-modal__label">
          {ui?.dashboard?.editAlbumModal?.step3?.mixedAt ?? 'Mixed At'}
        </label>

        {formData.mixedAt.length > 0 && (
          <div className="edit-album-modal__list">
            {formData.mixedAt.map((entry, index) => {
              const isEditing = formData.editingMixedAtIndex === index;
              // Парсим только если нет прямых полей (для обратной совместимости)
              const parsed = entry.dateFrom ? {} : parseRecordingText(entry.text);

              return (
                <RecordingEntryEditor
                  key={index}
                  data={{
                    text: entry.text,
                    url: entry.url,
                  }}
                  isEditing={isEditing}
                  dateFrom={
                    isEditing
                      ? (formData.mixedAtDateFrom ?? '')
                      : formData.mixedAtDateFrom || entry.dateFrom || parsed.dateFrom || ''
                  }
                  dateTo={
                    isEditing
                      ? (formData.mixedAtDateTo ?? '')
                      : formData.mixedAtDateTo || entry.dateTo || parsed.dateTo || ''
                  }
                  studioText={
                    isEditing
                      ? (formData.mixedAtText ?? '')
                      : formData.mixedAtText || entry.studioText || parsed.studioText || ''
                  }
                  city={
                    isEditing
                      ? (formData.mixedAtCity ?? '')
                      : formData.mixedAtCity || entry.city || ''
                  }
                  url={
                    isEditing ? (formData.mixedAtURL ?? '') : formData.mixedAtURL || entry.url || ''
                  }
                  onDateFromChange={(value: string) => onFormDataChange('mixedAtDateFrom', value)}
                  onDateToChange={(value: string) => onFormDataChange('mixedAtDateTo', value)}
                  onStudioTextChange={(value: string) => onFormDataChange('mixedAtText', value)}
                  onCityChange={(value: string) => onFormDataChange('mixedAtCity', value)}
                  onUrlChange={(value: string) => onFormDataChange('mixedAtURL', value)}
                  onEdit={() => {
                    onFormDataChange('editingMixedAtIndex', index);
                    onFormDataChange('mixedAtDateFrom', entry.dateFrom || parsed.dateFrom || '');
                    onFormDataChange('mixedAtDateTo', entry.dateTo || parsed.dateTo || '');
                    onFormDataChange('mixedAtText', entry.studioText || parsed.studioText || '');
                    onFormDataChange('mixedAtCity', entry.city || '');
                    onFormDataChange('mixedAtURL', entry.url || '');
                  }}
                  onSave={() => {
                    const updated = [...formData.mixedAt];
                    const text = buildRecordingText(
                      formData.mixedAtDateFrom,
                      formData.mixedAtDateTo,
                      formData.mixedAtText?.trim(),
                      formData.mixedAtCity?.trim()
                    );
                    updated[index] = {
                      text,
                      url: formData.mixedAtURL?.trim() || undefined,
                      dateFrom: formData.mixedAtDateFrom,
                      dateTo: formData.mixedAtDateTo,
                      studioText: formData.mixedAtText?.trim(),
                      city: formData.mixedAtCity?.trim(),
                    };
                    onFormDataChange('mixedAt', updated);
                    onFormDataChange('mixedAtDateFrom', '');
                    onFormDataChange('mixedAtDateTo', '');
                    onFormDataChange('mixedAtText', '');
                    onFormDataChange('mixedAtCity', '');
                    onFormDataChange('mixedAtURL', '');
                    onFormDataChange('editingMixedAtIndex', null);
                  }}
                  onCancel={() => {
                    onFormDataChange('mixedAtDateFrom', '');
                    onFormDataChange('mixedAtDateTo', '');
                    onFormDataChange('mixedAtText', '');
                    onFormDataChange('mixedAtCity', '');
                    onFormDataChange('mixedAtURL', '');
                    onFormDataChange('editingMixedAtIndex', null);
                    onFormDataChange('showAddMixedAtInputs', false);
                  }}
                  onRemove={() => {
                    const updated = [...formData.mixedAt];
                    updated.splice(index, 1);
                    onFormDataChange('mixedAt', updated);
                  }}
                  ui={ui}
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
                  name="mixed-at-date-from"
                  type="date"
                  className="edit-album-modal__input"
                  placeholder="From"
                  value={formData.mixedAtDateFrom || ''}
                  onChange={(e) => onFormDataChange('mixedAtDateFrom', e.target.value)}
                />
                <input
                  name="mixed-at-date-to"
                  type="date"
                  className="edit-album-modal__input"
                  placeholder="To"
                  value={formData.mixedAtDateTo || ''}
                  onChange={(e) => onFormDataChange('mixedAtDateTo', e.target.value)}
                />
              </div>
              <input
                name="mixed-at-text"
                type="text"
                className="edit-album-modal__input"
                placeholder="Studio info (e.g., DTH Studios, Studio A)"
                value={formData.mixedAtText || ''}
                onChange={(e) => onFormDataChange('mixedAtText', e.target.value)}
                onKeyDown={(e) => {
                  if (
                    e.key === 'Enter' &&
                    (formData.mixedAtText?.trim() ||
                      formData.mixedAtCity?.trim() ||
                      formData.mixedAtDateFrom ||
                      formData.mixedAtDateTo)
                  ) {
                    e.preventDefault();
                    const text = buildRecordingText(
                      formData.mixedAtDateFrom,
                      formData.mixedAtDateTo,
                      formData.mixedAtText?.trim(),
                      formData.mixedAtCity?.trim()
                    );
                    const url = formData.mixedAtURL?.trim() || undefined;
                    const newEntry = {
                      text,
                      url,
                      dateFrom: formData.mixedAtDateFrom,
                      dateTo: formData.mixedAtDateTo,
                      studioText: formData.mixedAtText?.trim(),
                      city: formData.mixedAtCity?.trim(),
                    };
                    onFormDataChange('mixedAt', [...formData.mixedAt, newEntry]);
                    onFormDataChange('mixedAtDateFrom', '');
                    onFormDataChange('mixedAtDateTo', '');
                    onFormDataChange('mixedAtText', '');
                    onFormDataChange('mixedAtCity', '');
                    onFormDataChange('mixedAtURL', '');
                    onFormDataChange('showAddMixedAtInputs', false);
                  }
                  if (e.key === 'Escape') {
                    onFormDataChange('mixedAtDateFrom', '');
                    onFormDataChange('mixedAtDateTo', '');
                    onFormDataChange('mixedAtText', '');
                    onFormDataChange('mixedAtCity', '');
                    onFormDataChange('mixedAtURL', '');
                    onFormDataChange('showAddMixedAtInputs', false);
                  }
                }}
              />
              <input
                name="mixed-at-city"
                type="text"
                className="edit-album-modal__input"
                placeholder="City (e.g., Moscow)"
                value={formData.mixedAtCity || ''}
                onChange={(e) => onFormDataChange('mixedAtCity', e.target.value)}
                onKeyDown={(e) => {
                  if (
                    e.key === 'Enter' &&
                    (formData.mixedAtText?.trim() ||
                      formData.mixedAtCity?.trim() ||
                      formData.mixedAtDateFrom ||
                      formData.mixedAtDateTo)
                  ) {
                    e.preventDefault();
                    const text = buildRecordingText(
                      formData.mixedAtDateFrom,
                      formData.mixedAtDateTo,
                      formData.mixedAtText?.trim(),
                      formData.mixedAtCity?.trim()
                    );
                    const url = formData.mixedAtURL?.trim() || undefined;
                    const newEntry = {
                      text,
                      url,
                      dateFrom: formData.mixedAtDateFrom,
                      dateTo: formData.mixedAtDateTo,
                      studioText: formData.mixedAtText?.trim(),
                      city: formData.mixedAtCity?.trim(),
                    };
                    onFormDataChange('mixedAt', [...formData.mixedAt, newEntry]);
                    onFormDataChange('mixedAtDateFrom', '');
                    onFormDataChange('mixedAtDateTo', '');
                    onFormDataChange('mixedAtText', '');
                    onFormDataChange('mixedAtCity', '');
                    onFormDataChange('mixedAtURL', '');
                    onFormDataChange('showAddMixedAtInputs', false);
                  }
                  if (e.key === 'Escape') {
                    onFormDataChange('mixedAtDateFrom', '');
                    onFormDataChange('mixedAtDateTo', '');
                    onFormDataChange('mixedAtText', '');
                    onFormDataChange('mixedAtCity', '');
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
                  if (
                    e.key === 'Enter' &&
                    (formData.mixedAtText?.trim() ||
                      formData.mixedAtCity?.trim() ||
                      formData.mixedAtDateFrom ||
                      formData.mixedAtDateTo)
                  ) {
                    e.preventDefault();
                    const text = buildRecordingText(
                      formData.mixedAtDateFrom,
                      formData.mixedAtDateTo,
                      formData.mixedAtText?.trim(),
                      formData.mixedAtCity?.trim()
                    );
                    const url = formData.mixedAtURL?.trim() || undefined;
                    const newEntry = {
                      text,
                      url,
                      dateFrom: formData.mixedAtDateFrom,
                      dateTo: formData.mixedAtDateTo,
                      studioText: formData.mixedAtText?.trim(),
                      city: formData.mixedAtCity?.trim(),
                    };
                    onFormDataChange('mixedAt', [...formData.mixedAt, newEntry]);
                    onFormDataChange('mixedAtDateFrom', '');
                    onFormDataChange('mixedAtDateTo', '');
                    onFormDataChange('mixedAtText', '');
                    onFormDataChange('mixedAtCity', '');
                    onFormDataChange('mixedAtURL', '');
                    onFormDataChange('showAddMixedAtInputs', false);
                  }
                  if (e.key === 'Escape') {
                    onFormDataChange('mixedAtDateFrom', '');
                    onFormDataChange('mixedAtDateTo', '');
                    onFormDataChange('mixedAtText', '');
                    onFormDataChange('mixedAtCity', '');
                    onFormDataChange('mixedAtURL', '');
                    onFormDataChange('showAddMixedAtInputs', false);
                  }
                }}
              />
              {(formData.mixedAtText?.trim() ||
                formData.mixedAtCity?.trim() ||
                formData.mixedAtDateFrom ||
                formData.mixedAtDateTo) && (
                <button
                  type="button"
                  className="edit-album-modal__add-button"
                  onClick={() => {
                    const text = buildRecordingText(
                      formData.mixedAtDateFrom,
                      formData.mixedAtDateTo,
                      formData.mixedAtText?.trim(),
                      formData.mixedAtCity?.trim()
                    );
                    const url = formData.mixedAtURL?.trim() || undefined;
                    const newEntry = {
                      text,
                      url,
                      dateFrom: formData.mixedAtDateFrom,
                      dateTo: formData.mixedAtDateTo,
                      studioText: formData.mixedAtText?.trim(),
                      city: formData.mixedAtCity?.trim(),
                    };
                    onFormDataChange('mixedAt', [...formData.mixedAt, newEntry]);
                    onFormDataChange('mixedAtDateFrom', '');
                    onFormDataChange('mixedAtDateTo', '');
                    onFormDataChange('mixedAtText', '');
                    onFormDataChange('mixedAtCity', '');
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

      {/* Mastered By */}
      <div className="edit-album-modal__field">
        <label className="edit-album-modal__label">
          {ui?.dashboard?.editAlbumModal?.step3?.masteredBy ?? 'Mastered By'}
        </label>

        {formData.mastering.length > 0 && (
          <div className="edit-album-modal__list">
            {formData.mastering.map((entry, index) => {
              const isEditing = formData.editingMasteringIndex === index;
              // Парсим только если нет прямых полей (для обратной совместимости)
              const parsed = entry.dateFrom ? {} : parseRecordingText(entry.text);

              return (
                <RecordingEntryEditor
                  key={index}
                  data={{
                    text: entry.text,
                    url: entry.url,
                  }}
                  isEditing={isEditing}
                  dateFrom={
                    isEditing
                      ? (formData.masteringDateFrom ?? '')
                      : formData.masteringDateFrom || entry.dateFrom || parsed.dateFrom || ''
                  }
                  dateTo={
                    isEditing
                      ? (formData.masteringDateTo ?? '')
                      : formData.masteringDateTo || entry.dateTo || parsed.dateTo || ''
                  }
                  studioText={
                    isEditing
                      ? (formData.masteringText ?? '')
                      : formData.masteringText || entry.studioText || parsed.studioText || ''
                  }
                  city={
                    isEditing
                      ? (formData.masteringCity ?? '')
                      : formData.masteringCity || entry.city || ''
                  }
                  url={
                    isEditing
                      ? (formData.masteringURL ?? '')
                      : formData.masteringURL || entry.url || ''
                  }
                  onDateFromChange={(value: string) => onFormDataChange('masteringDateFrom', value)}
                  onDateToChange={(value: string) => onFormDataChange('masteringDateTo', value)}
                  onStudioTextChange={(value: string) => onFormDataChange('masteringText', value)}
                  onCityChange={(value: string) => onFormDataChange('masteringCity', value)}
                  onUrlChange={(value: string) => onFormDataChange('masteringURL', value)}
                  onEdit={() => {
                    onFormDataChange('editingMasteringIndex', index);
                    onFormDataChange('masteringDateFrom', entry.dateFrom || parsed.dateFrom || '');
                    onFormDataChange('masteringDateTo', entry.dateTo || parsed.dateTo || '');
                    onFormDataChange('masteringText', entry.studioText || parsed.studioText || '');
                    onFormDataChange('masteringCity', entry.city || '');
                    onFormDataChange('masteringURL', entry.url || '');
                  }}
                  onSave={() => {
                    const updated = [...formData.mastering];
                    const text = buildRecordingText(
                      formData.masteringDateFrom,
                      formData.masteringDateTo,
                      formData.masteringText?.trim(),
                      formData.masteringCity?.trim()
                    );
                    updated[index] = {
                      text,
                      url: formData.masteringURL?.trim() || undefined,
                      dateFrom: formData.masteringDateFrom,
                      dateTo: formData.masteringDateTo,
                      studioText: formData.masteringText?.trim(),
                      city: formData.masteringCity?.trim(),
                    };
                    onFormDataChange('mastering', updated);
                    onFormDataChange('masteringDateFrom', '');
                    onFormDataChange('masteringDateTo', '');
                    onFormDataChange('masteringText', '');
                    onFormDataChange('masteringCity', '');
                    onFormDataChange('masteringURL', '');
                    onFormDataChange('editingMasteringIndex', null);
                  }}
                  onCancel={() => {
                    onFormDataChange('masteringDateFrom', '');
                    onFormDataChange('masteringDateTo', '');
                    onFormDataChange('masteringText', '');
                    onFormDataChange('masteringCity', '');
                    onFormDataChange('masteringURL', '');
                    onFormDataChange('editingMasteringIndex', null);
                    onFormDataChange('showAddMasteringInputs', false);
                  }}
                  onRemove={() => {
                    const updated = [...formData.mastering];
                    updated.splice(index, 1);
                    onFormDataChange('mastering', updated);
                  }}
                  ui={ui}
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
                  name="mastering-date-from"
                  type="date"
                  className="edit-album-modal__input"
                  placeholder="From"
                  value={formData.masteringDateFrom || ''}
                  onChange={(e) => onFormDataChange('masteringDateFrom', e.target.value)}
                />
                <input
                  name="mastering-date-to"
                  type="date"
                  className="edit-album-modal__input"
                  placeholder="To"
                  value={formData.masteringDateTo || ''}
                  onChange={(e) => onFormDataChange('masteringDateTo', e.target.value)}
                />
              </div>
              <input
                name="mastering-text"
                type="text"
                className="edit-album-modal__input"
                placeholder="Studio info (e.g., Chicago Mastering Service)"
                value={formData.masteringText || ''}
                onChange={(e) => onFormDataChange('masteringText', e.target.value)}
                onKeyDown={(e) => {
                  if (
                    e.key === 'Enter' &&
                    (formData.masteringText?.trim() ||
                      formData.masteringCity?.trim() ||
                      formData.masteringDateFrom ||
                      formData.masteringDateTo)
                  ) {
                    e.preventDefault();
                    const text = buildRecordingText(
                      formData.masteringDateFrom,
                      formData.masteringDateTo,
                      formData.masteringText?.trim(),
                      formData.masteringCity?.trim()
                    );
                    const url = formData.masteringURL?.trim() || undefined;
                    const newEntry = {
                      text,
                      url,
                      dateFrom: formData.masteringDateFrom,
                      dateTo: formData.masteringDateTo,
                      studioText: formData.masteringText?.trim(),
                      city: formData.masteringCity?.trim(),
                    };
                    onFormDataChange('mastering', [...formData.mastering, newEntry]);
                    onFormDataChange('masteringDateFrom', '');
                    onFormDataChange('masteringDateTo', '');
                    onFormDataChange('masteringText', '');
                    onFormDataChange('masteringCity', '');
                    onFormDataChange('masteringURL', '');
                    onFormDataChange('showAddMasteringInputs', false);
                  }
                  if (e.key === 'Escape') {
                    onFormDataChange('masteringDateFrom', '');
                    onFormDataChange('masteringDateTo', '');
                    onFormDataChange('masteringText', '');
                    onFormDataChange('masteringCity', '');
                    onFormDataChange('masteringURL', '');
                    onFormDataChange('showAddMasteringInputs', false);
                  }
                }}
              />
              <input
                name="mastering-city"
                type="text"
                className="edit-album-modal__input"
                placeholder="City (e.g., Chicago, USA)"
                value={formData.masteringCity || ''}
                onChange={(e) => onFormDataChange('masteringCity', e.target.value)}
                onKeyDown={(e) => {
                  if (
                    e.key === 'Enter' &&
                    (formData.masteringText?.trim() ||
                      formData.masteringCity?.trim() ||
                      formData.masteringDateFrom ||
                      formData.masteringDateTo)
                  ) {
                    e.preventDefault();
                    const text = buildRecordingText(
                      formData.masteringDateFrom,
                      formData.masteringDateTo,
                      formData.masteringText?.trim(),
                      formData.masteringCity?.trim()
                    );
                    const url = formData.masteringURL?.trim() || undefined;
                    const newEntry = {
                      text,
                      url,
                      dateFrom: formData.masteringDateFrom,
                      dateTo: formData.masteringDateTo,
                      studioText: formData.masteringText?.trim(),
                      city: formData.masteringCity?.trim(),
                    };
                    onFormDataChange('mastering', [...formData.mastering, newEntry]);
                    onFormDataChange('masteringDateFrom', '');
                    onFormDataChange('masteringDateTo', '');
                    onFormDataChange('masteringText', '');
                    onFormDataChange('masteringCity', '');
                    onFormDataChange('masteringURL', '');
                    onFormDataChange('showAddMasteringInputs', false);
                  }
                  if (e.key === 'Escape') {
                    onFormDataChange('masteringDateFrom', '');
                    onFormDataChange('masteringDateTo', '');
                    onFormDataChange('masteringText', '');
                    onFormDataChange('masteringCity', '');
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
                  if (
                    e.key === 'Enter' &&
                    (formData.masteringText?.trim() ||
                      formData.masteringCity?.trim() ||
                      formData.masteringDateFrom ||
                      formData.masteringDateTo)
                  ) {
                    e.preventDefault();
                    const text = buildRecordingText(
                      formData.masteringDateFrom,
                      formData.masteringDateTo,
                      formData.masteringText?.trim(),
                      formData.masteringCity?.trim()
                    );
                    const url = formData.masteringURL?.trim() || undefined;
                    const newEntry = {
                      text,
                      url,
                      dateFrom: formData.masteringDateFrom,
                      dateTo: formData.masteringDateTo,
                      studioText: formData.masteringText?.trim(),
                      city: formData.masteringCity?.trim(),
                    };
                    onFormDataChange('mastering', [...formData.mastering, newEntry]);
                    onFormDataChange('masteringDateFrom', '');
                    onFormDataChange('masteringDateTo', '');
                    onFormDataChange('masteringText', '');
                    onFormDataChange('masteringCity', '');
                    onFormDataChange('masteringURL', '');
                    onFormDataChange('showAddMasteringInputs', false);
                  }
                  if (e.key === 'Escape') {
                    onFormDataChange('masteringDateFrom', '');
                    onFormDataChange('masteringDateTo', '');
                    onFormDataChange('masteringText', '');
                    onFormDataChange('masteringCity', '');
                    onFormDataChange('masteringURL', '');
                    onFormDataChange('showAddMasteringInputs', false);
                  }
                }}
              />
              {(formData.masteringText?.trim() ||
                formData.masteringCity?.trim() ||
                formData.masteringDateFrom ||
                formData.masteringDateTo) && (
                <button
                  type="button"
                  className="edit-album-modal__add-button"
                  onClick={() => {
                    const text = buildRecordingText(
                      formData.masteringDateFrom,
                      formData.masteringDateTo,
                      formData.masteringText?.trim(),
                      formData.masteringCity?.trim()
                    );
                    const url = formData.masteringURL?.trim() || undefined;
                    const newEntry = {
                      text,
                      url,
                      dateFrom: formData.masteringDateFrom,
                      dateTo: formData.masteringDateTo,
                      studioText: formData.masteringText?.trim(),
                      city: formData.masteringCity?.trim(),
                    };
                    onFormDataChange('mastering', [...formData.mastering, newEntry]);
                    onFormDataChange('masteringDateFrom', '');
                    onFormDataChange('masteringDateTo', '');
                    onFormDataChange('masteringText', '');
                    onFormDataChange('masteringCity', '');
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
