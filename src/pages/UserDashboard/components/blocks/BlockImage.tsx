// src/pages/UserDashboard/components/blocks/BlockImage.tsx
import React, { useRef, useState } from 'react';
import { getUserImageUrl } from '@shared/api/albums';
import { uploadFile } from '@shared/api/storage';
import { CURRENT_USER_CONFIG } from '@config/user';

interface BlockImageProps {
  imageKey?: string;
  caption?: string;
  onChange: (imageKey: string, caption?: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  isSelected?: boolean;
  onSelect?: () => void;
  onConvertToCarousel?: () => void;
}

export function BlockImage({
  imageKey,
  caption,
  onChange,
  onFocus,
  onBlur,
  isSelected,
  onSelect,
  onConvertToCarousel,
}: BlockImageProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [captionValue, setCaptionValue] = useState(caption || '');
  const [showCarouselButton, setShowCarouselButton] = useState(false);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      // Генерируем имя файла без расширения для использования как imageKey
      const fileExtension = file.name.split('.').pop() || 'jpg';
      const baseFileName = file.name.replace(/\.[^/.]+$/, '');
      const timestamp = Date.now();
      const fileName = `article_${timestamp}_${baseFileName}.${fileExtension}`;
      const imageKey = `article_${timestamp}_${baseFileName}`;
      
      const url = await uploadFile({
        userId: CURRENT_USER_CONFIG.userId,
        file,
        category: 'articles',
        fileName,
      });

      if (url) {
        onChange(imageKey, captionValue);
      }
    } catch (error) {
      console.error('Error uploading image:', error);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleCaptionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newCaption = e.target.value;
    setCaptionValue(newCaption);
    onChange(imageKey || '', newCaption || undefined);
  };

  const imageUrl = imageKey ? getUserImageUrl(imageKey, 'articles') : '';

  const handleImageClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect?.();
  };

  return (
    <div
      className="edit-article-v2__block edit-article-v2__block--image"
      onFocus={onFocus}
      onBlur={onBlur}
      tabIndex={0}
    >
      {imageKey && imageUrl ? (
        <div
          className="uncollapse edit-article-v2__image-container"
          onClick={handleImageClick}
          onMouseEnter={() => setShowCarouselButton(true)}
          onMouseLeave={() => setShowCarouselButton(false)}
        >
          <img src={imageUrl} alt={caption || ''} />
          {(showCarouselButton || isSelected) && onConvertToCarousel && (
            <button
              type="button"
              className="edit-article-v2__image-convert-to-carousel"
              onClick={(e) => {
                e.stopPropagation();
                onConvertToCarousel();
              }}
            >
              Создать карусель
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          className="edit-article-v2__image-upload"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
        >
          {isUploading ? 'Загрузка...' : '+ Загрузить изображение'}
        </button>
      )}
      {imageKey && (
        <input
          type="text"
          className="edit-article-v2__image-caption"
          value={captionValue}
          onChange={handleCaptionChange}
          placeholder="Подпись к изображению (необязательно)"
        />
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />
    </div>
  );
}

