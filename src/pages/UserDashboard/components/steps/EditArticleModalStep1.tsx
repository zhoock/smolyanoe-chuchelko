// src/pages/UserDashboard/components/steps/EditArticleModalStep1.tsx
import React from 'react';
import type { ArticleFormData } from '../EditArticleModal.types';
import { getUserImageUrl } from '@shared/api/albums';
import type { IInterface } from '@models';

interface EditArticleModalStep1Props {
  formData: ArticleFormData;
  onFormDataChange: (field: keyof ArticleFormData, value: any) => void;
  coverPreview: string | null;
  dragActive: boolean;
  onFileInput: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDrag: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  lang: 'ru' | 'en';
  ui?: IInterface;
}

export function EditArticleModalStep1({
  formData,
  onFormDataChange,
  coverPreview,
  dragActive,
  onFileInput,
  onDrag,
  onDrop,
  lang,
  ui,
}: EditArticleModalStep1Props) {
  return (
    <>
      <div className="edit-article-modal__divider" />

      <div className="edit-article-modal__field">
        <label htmlFor="article-id" className="edit-article-modal__label">
          {ui?.dashboard?.articleId ?? 'Article ID'}
        </label>
        <input
          id="article-id"
          name="article-id"
          type="text"
          autoComplete="off"
          className="edit-article-modal__input"
          required
          value={formData.articleId}
          onChange={(e) => onFormDataChange('articleId', e.target.value)}
          placeholder={lang === 'ru' ? 'article-1' : 'article-1'}
        />
        <small className="edit-article-modal__hint">
          {lang === 'ru'
            ? 'Уникальный идентификатор статьи (используется в URL)'
            : 'Unique article identifier (used in URL)'}
        </small>
      </div>

      <div className="edit-article-modal__field">
        <label htmlFor="article-title" className="edit-article-modal__label">
          {ui?.dashboard?.articleTitle ?? 'Article Title'}
        </label>
        <input
          id="article-title"
          name="article-title"
          type="text"
          autoComplete="off"
          className="edit-article-modal__input"
          required
          value={formData.nameArticle}
          onChange={(e) => onFormDataChange('nameArticle', e.target.value)}
          placeholder={ui?.dashboard?.enterArticleTitle ?? 'Enter article title'}
        />
      </div>

      <div className="edit-article-modal__field">
        <label htmlFor="article-description" className="edit-article-modal__label">
          {ui?.dashboard?.description ?? 'Description'}
        </label>
        <textarea
          id="article-description"
          name="article-description"
          className="edit-article-modal__textarea"
          value={formData.description}
          onChange={(e) => onFormDataChange('description', e.target.value)}
          placeholder={
            lang === 'ru'
              ? 'Краткое описание статьи (отображается в списке статей)'
              : 'Brief article description (shown in article list)'
          }
          rows={3}
        />
      </div>

      <div className="edit-article-modal__field">
        <label htmlFor="article-date" className="edit-article-modal__label">
          {ui?.dashboard?.publicationDate ?? 'Publication Date'}
        </label>
        <input
          id="article-date"
          name="article-date"
          type="date"
          className="edit-article-modal__input"
          required
          value={formData.date}
          onChange={(e) => onFormDataChange('date', e.target.value)}
        />
      </div>

      <div className="edit-article-modal__field">
        <label className="edit-article-modal__label">
          {ui?.dashboard?.articleCover ?? 'Article Cover'}
        </label>

        <input
          type="file"
          id="article-cover-input"
          accept="image/*"
          className="edit-article-modal__file-input"
          onChange={onFileInput}
          style={{ display: 'none' }}
        />

        <div
          className={`edit-article-modal__drop-zone ${dragActive ? 'edit-article-modal__drop-zone--active' : ''}`}
          onDragOver={onDrag}
          onDragEnter={onDrag}
          onDragLeave={onDrag}
          onDrop={onDrop}
          onClick={() => {
            const input = document.getElementById('article-cover-input');
            if (input) input.click();
          }}
        >
          {coverPreview ? (
            <div className="edit-article-modal__cover-preview">
              <img
                src={coverPreview}
                alt="Article cover preview"
                className="edit-article-modal__cover-image"
              />
              <button
                type="button"
                className="edit-article-modal__remove-cover-button"
                onClick={(e) => {
                  e.stopPropagation();
                  onFormDataChange('img', null);
                  onFormDataChange('imgPreview', undefined);
                }}
              >
                ×
              </button>
            </div>
          ) : (
            <div className="edit-article-modal__drop-zone-content">
              <span className="edit-article-modal__drop-zone-icon">📷</span>
              <span className="edit-article-modal__drop-zone-text">
                {lang === 'ru'
                  ? 'Перетащите изображение сюда или нажмите для выбора'
                  : 'Drag image here or click to select'}
              </span>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
