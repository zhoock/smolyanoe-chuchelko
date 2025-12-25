// src/pages/UserDashboard/components/ArticleBlockEditor.tsx
import React, { useState } from 'react';
import type { ArticleBlockData } from './EditArticleModal.types';
import { getUserImageUrl } from '@shared/api/albums';
import './ArticleBlockEditor.style.scss';

interface ArticleBlockEditorProps {
  block: ArticleBlockData;
  index: number;
  onUpdate: (updatedBlock: ArticleBlockData) => void;
  onDelete: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  lang: 'ru' | 'en';
}

export function ArticleBlockEditor({
  block,
  index,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  lang,
}: ArticleBlockEditorProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [contentType, setContentType] = useState<'text' | 'list'>(
    Array.isArray(block.content) ? 'list' : 'text'
  );

  const handleContentTypeChange = (type: 'text' | 'list') => {
    setContentType(type);
    if (type === 'text') {
      const currentContent = Array.isArray(block.content)
        ? block.content.join('\n')
        : block.content || '';
      onUpdate({ ...block, content: currentContent });
    } else {
      const currentContent =
        typeof block.content === 'string' && block.content
          ? block.content.split('\n').filter((line) => line.trim())
          : [''];
      onUpdate({ ...block, content: currentContent });
    }
  };

  const handleTextContentChange = (value: string) => {
    onUpdate({ ...block, content: value });
  };

  const handleListContentChange = (index: number, value: string) => {
    if (!Array.isArray(block.content)) return;
    const newContent = [...block.content];
    newContent[index] = value;
    onUpdate({ ...block, content: newContent });
  };

  const handleAddListItem = () => {
    if (!Array.isArray(block.content)) return;
    onUpdate({ ...block, content: [...block.content, ''] });
  };

  const handleRemoveListItem = (index: number) => {
    if (!Array.isArray(block.content) || block.content.length <= 1) return;
    const newContent = block.content.filter((_, i) => i !== index);
    onUpdate({ ...block, content: newContent });
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Здесь будет логика загрузки изображения
      // Пока просто обновляем preview
      const reader = new FileReader();
      reader.onload = (event) => {
        // В реальной реализации здесь будет загрузка в Supabase Storage
        // Пока используем data URL для предпросмотра
        console.log('Image selected:', file.name);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="article-block-editor">
      <div className="article-block-editor__header">
        <div className="article-block-editor__header-left">
          <button
            type="button"
            className="article-block-editor__toggle"
            onClick={() => setIsExpanded(!isExpanded)}
            aria-label={isExpanded ? 'Collapse block' : 'Expand block'}
          >
            {isExpanded ? '⌃' : '›'}
          </button>
          <span className="article-block-editor__number">Block {index + 1}</span>
        </div>
        <div className="article-block-editor__header-right">
          {canMoveUp && (
            <button
              type="button"
              className="article-block-editor__move-button"
              onClick={onMoveUp}
              title="Move up"
            >
              ↑
            </button>
          )}
          {canMoveDown && (
            <button
              type="button"
              className="article-block-editor__move-button"
              onClick={onMoveDown}
              title="Move down"
            >
              ↓
            </button>
          )}
          <button
            type="button"
            className="article-block-editor__delete-button"
            onClick={onDelete}
            title="Delete block"
          >
            ×
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="article-block-editor__content">
          {/* Title */}
          <div className="article-block-editor__field">
            <label className="article-block-editor__label">Title (optional)</label>
            <input
              type="text"
              className="article-block-editor__input"
              value={block.title || ''}
              onChange={(e) => onUpdate({ ...block, title: e.target.value || undefined })}
              placeholder="Block title"
            />
          </div>

          {/* Subtitle */}
          <div className="article-block-editor__field">
            <label className="article-block-editor__label">Subtitle (optional)</label>
            <input
              type="text"
              className="article-block-editor__input"
              value={block.subtitle || ''}
              onChange={(e) => onUpdate({ ...block, subtitle: e.target.value || undefined })}
              placeholder="Block subtitle"
            />
          </div>

          {/* Strong text */}
          <div className="article-block-editor__field">
            <label className="article-block-editor__label">Strong text (optional)</label>
            <input
              type="text"
              className="article-block-editor__input"
              value={block.strong || ''}
              onChange={(e) => onUpdate({ ...block, strong: e.target.value || undefined })}
              placeholder="Bold text at the beginning"
            />
          </div>

          {/* Content type selector */}
          <div className="article-block-editor__field">
            <label className="article-block-editor__label">Content type</label>
            <div className="article-block-editor__radio-group">
              <label className="article-block-editor__radio-label">
                <input
                  type="radio"
                  name={`content-type-${block.id}`}
                  checked={contentType === 'text'}
                  onChange={() => handleContentTypeChange('text')}
                />
                <span>Text</span>
              </label>
              <label className="article-block-editor__radio-label">
                <input
                  type="radio"
                  name={`content-type-${block.id}`}
                  checked={contentType === 'list'}
                  onChange={() => handleContentTypeChange('list')}
                />
                <span>List</span>
              </label>
            </div>
          </div>

          {/* Content editor */}
          <div className="article-block-editor__field">
            <label className="article-block-editor__label">
              Content {contentType === 'text' ? '(text)' : '(list items)'}
            </label>
            {contentType === 'text' ? (
              <textarea
                className="article-block-editor__textarea"
                value={typeof block.content === 'string' ? block.content : ''}
                onChange={(e) => handleTextContentChange(e.target.value)}
                placeholder="Enter text content"
                rows={6}
              />
            ) : (
              <div className="article-block-editor__list-editor">
                {Array.isArray(block.content) &&
                  block.content.map((item, idx) => (
                    <div key={idx} className="article-block-editor__list-item">
                      <input
                        type="text"
                        className="article-block-editor__input"
                        value={item}
                        onChange={(e) => handleListContentChange(idx, e.target.value)}
                        placeholder={`List item ${idx + 1}`}
                      />
                      {block.content &&
                        Array.isArray(block.content) &&
                        block.content.length > 1 && (
                          <button
                            type="button"
                            className="article-block-editor__remove-item-button"
                            onClick={() => handleRemoveListItem(idx)}
                            title="Remove item"
                          >
                            ×
                          </button>
                        )}
                    </div>
                  ))}
                <button
                  type="button"
                  className="article-block-editor__add-item-button"
                  onClick={handleAddListItem}
                >
                  + Add item
                </button>
              </div>
            )}
          </div>

          {/* Image */}
          <div className="article-block-editor__field">
            <label className="article-block-editor__label">Image (optional)</label>
            {block.img && (
              <div className="article-block-editor__image-preview">
                {Array.isArray(block.img) ? (
                  <div className="article-block-editor__image-carousel-preview">
                    {block.img.map((img, idx) => (
                      <img
                        key={idx}
                        src={getUserImageUrl(img, 'articles')}
                        alt={block.alt || `Image ${idx + 1}`}
                        className="article-block-editor__preview-image"
                      />
                    ))}
                    <span className="article-block-editor__carousel-badge">
                      {block.img.length} images
                    </span>
                  </div>
                ) : (
                  <img
                    src={getUserImageUrl(block.img, 'articles')}
                    alt={block.alt || 'Block image'}
                    className="article-block-editor__preview-image"
                  />
                )}
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="article-block-editor__file-input"
            />
            {block.img && (
              <button
                type="button"
                className="article-block-editor__remove-image-button"
                onClick={() => onUpdate({ ...block, img: undefined, alt: undefined })}
              >
                Remove image
              </button>
            )}
          </div>

          {/* Alt text */}
          {block.img && (
            <div className="article-block-editor__field">
              <label className="article-block-editor__label">Alt text (optional)</label>
              <input
                type="text"
                className="article-block-editor__input"
                value={block.alt || ''}
                onChange={(e) => onUpdate({ ...block, alt: e.target.value || undefined })}
                placeholder="Image alt text"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
