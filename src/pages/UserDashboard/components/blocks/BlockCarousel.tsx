// src/pages/UserDashboard/components/blocks/BlockCarousel.tsx
import React, { useState } from 'react';
import { getUserImageUrl, getImageUrl, shouldUseSupabaseStorage } from '@shared/api/albums';

interface BlockCarouselProps {
  imageKeys: string[];
  caption?: string;
  userId?: string; // UUID владельца статьи для правильной загрузки изображений
  onChange: (imageKeys: string[], caption?: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  onDelete?: () => void;
  isSelected?: boolean;
  onSelect?: () => void;
  onEdit?: () => void;
  onEnter?: (atEnd: boolean) => void;
}

export function BlockCarousel({
  imageKeys,
  caption,
  userId,
  onChange,
  onFocus,
  onBlur,
  onDelete,
  isSelected,
  onSelect,
  onEdit,
  onEnter,
}: BlockCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showEditButton, setShowEditButton] = useState(false);
  const [showNav, setShowNav] = useState(false);
  const captionValue = caption || '';

  const handleCarouselClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect?.();
  };

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : imageKeys.length - 1));
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev < imageKeys.length - 1 ? prev + 1 : 0));
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit?.();
  };

  // Сбрасываем индекс при изменении количества изображений
  React.useEffect(() => {
    if (currentIndex >= imageKeys.length && imageKeys.length > 0) {
      setCurrentIndex(imageKeys.length - 1);
    }
  }, [imageKeys.length, currentIndex]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onEnter?.(true); // Всегда считаем, что Enter нажато в конце
    }
  };

  if (imageKeys.length === 0) {
    return (
      <div
        className="edit-article-v2__block edit-article-v2__block--carousel"
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyDown={handleKeyDown}
        tabIndex={0}
      >
        <div className="edit-article-v2__carousel-empty">
          <button
            type="button"
            className="edit-article-v2__carousel-add-empty"
            onClick={handleEditClick}
          >
            + Добавить фотографии в карусель
          </button>
        </div>
      </div>
    );
  }

  // Формируем URL изображения с учетом userId
  const currentImageUrl = imageKeys[currentIndex]
    ? userId
      ? getImageUrl(imageKeys[currentIndex], '.jpg', {
          userId,
          category: 'articles',
          useSupabaseStorage: shouldUseSupabaseStorage(),
        })
      : getUserImageUrl(imageKeys[currentIndex], 'articles')
    : '';
  const totalImages = imageKeys.length;

  return (
    <div
      className="edit-article-v2__block edit-article-v2__block--carousel"
      onFocus={onFocus}
      onBlur={onBlur}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      onClick={handleCarouselClick}
      onMouseEnter={() => {
        setShowEditButton(true);
        setShowNav(true);
      }}
      onMouseLeave={() => {
        setShowEditButton(false);
        setShowNav(false);
      }}
    >
      <div className="uncollapse edit-article-v2__carousel-view">
        <div className="edit-article-v2__carousel-image-wrapper">
          <img src={currentImageUrl} alt={`Image ${currentIndex + 1} of ${totalImages}`} />

          {/* Кнопка "Редактировать карусель" и бейдж "1 из N" в правом верхнем углу */}
          <div className="edit-article-v2__carousel-top-right">
            {(showEditButton || isSelected) && onEdit && (
              <button
                type="button"
                className="edit-article-v2__carousel-edit"
                onClick={handleEditClick}
              >
                Редактировать карусель
              </button>
            )}
            <div className="edit-article-v2__carousel-badge">
              {currentIndex + 1} из {totalImages}
            </div>
          </div>

          {/* Стрелки навигации */}
          {totalImages > 1 && showNav && (
            <>
              <button
                type="button"
                className="edit-article-v2__carousel-nav edit-article-v2__carousel-nav--prev"
                onClick={handlePrev}
                aria-label="Предыдущее изображение"
              >
                ‹
              </button>
              <button
                type="button"
                className="edit-article-v2__carousel-nav edit-article-v2__carousel-nav--next"
                onClick={handleNext}
                aria-label="Следующее изображение"
              >
                ›
              </button>
            </>
          )}
        </div>
      </div>
      {captionValue && (
        <div className="edit-article-v2__carousel-caption-display">{captionValue}</div>
      )}
    </div>
  );
}
