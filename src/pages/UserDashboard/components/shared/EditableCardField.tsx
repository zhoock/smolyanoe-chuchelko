// src/pages/UserDashboard/components/shared/EditableCardField.tsx
import React from 'react';
import './EditableCardField.style.scss';

export interface EditableCardFieldData {
  title: string; // Заголовок (жирный, сверху слева)
  description?: string; // 1-2 строки описания (мелкий текст под заголовком)
  url?: string; // Нижняя строка для URL/доп. значения
}

export interface EditableCardFieldProps {
  data: EditableCardFieldData;
  isEditing: boolean;
  editTitle: string;
  editDescription: string;
  editUrl: string;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onUrlChange: (value: string) => void;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onRemove: () => void;
  titlePlaceholder?: string;
  descriptionPlaceholder?: string;
  urlPlaceholder?: string;
  showCancel?: boolean; // Если false, только save + remove
}

export function EditableCardField({
  data,
  isEditing,
  editTitle,
  editDescription,
  editUrl,
  onTitleChange,
  onDescriptionChange,
  onUrlChange,
  onEdit,
  onSave,
  onCancel,
  onRemove,
  titlePlaceholder = 'Title',
  descriptionPlaceholder = 'Description (optional)',
  urlPlaceholder = 'URL (optional)',
  showCancel = true,
}: EditableCardFieldProps) {
  if (isEditing) {
    return (
      <div className="edit-album-modal__list-item edit-album-modal__list-item--editing">
        <div className="edit-album-modal__list-item-content">
          <input
            type="text"
            className="edit-album-modal__list-item-input edit-album-modal__list-item-input--title"
            placeholder={titlePlaceholder}
            value={editTitle}
            onChange={(e) => onTitleChange(e.target.value)}
            autoFocus
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
          {descriptionPlaceholder && descriptionPlaceholder.trim() !== '' && (
            <input
              type="text"
              className="edit-album-modal__list-item-input edit-album-modal__list-item-input--description"
              placeholder={descriptionPlaceholder}
              value={editDescription}
              onChange={(e) => onDescriptionChange(e.target.value)}
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
          )}
          <input
            type="url"
            className="edit-album-modal__list-item-input edit-album-modal__list-item-input--url"
            placeholder={urlPlaceholder}
            value={editUrl}
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
        </div>
        <div className="edit-album-modal__list-item-actions">
          <button
            type="button"
            className="edit-album-modal__list-item-save"
            onClick={onSave}
            aria-label="Save"
          >
            ✔
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

  return (
    <div className="edit-album-modal__list-item">
      <div className="edit-album-modal__list-item-content">
        <span className="edit-album-modal__list-item-name">{data.title}</span>
        {data.description && (
          <span className="edit-album-modal__list-item-role">{data.description}</span>
        )}
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
