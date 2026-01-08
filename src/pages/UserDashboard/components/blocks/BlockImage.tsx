// src/pages/UserDashboard/components/blocks/BlockImage.tsx
import React, { useRef, useState } from 'react';
import { getUserImageUrl, getImageUrl, shouldUseSupabaseStorage } from '@shared/api/albums';
import { uploadFile } from '@shared/api/storage';
import { getUser } from '@shared/lib/auth';

interface BlockImageProps {
  imageKey?: string;
  caption?: string;
  onChange: (imageKey: string, caption?: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  isSelected?: boolean;
  onSelect?: () => void;
  onConvertToCarousel?: () => void;
  onEnter?: (atEnd: boolean) => void;
  userId?: string; // UUID владельца статьи для правильной загрузки изображений
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
  onEnter,
  userId,
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
      // Получаем userId из пропсов или из авторизованного пользователя
      const currentUser = getUser();
      const targetUserId = userId || currentUser?.id;

      if (!targetUserId) {
        console.error('❌ [BlockImage] User ID not found. Cannot upload image.');
        setIsUploading(false);
        return;
      }

      // Нормализуем имя файла: убираем пробелы и небезопасные символы
      const fileExtension = file.name.split('.').pop() || 'jpg';
      const baseFileName = file.name.replace(/\.[^/.]+$/, '');
      const normalizedBaseName =
        baseFileName
          .replace(/\s+/g, '_')
          .replace(/[^a-zA-Z0-9._-]/g, '')
          .replace(/_{2,}/g, '_')
          .replace(/^_+|_+$/g, '') || 'article_image';

      const timestamp = Date.now();
      const fileName = `article_${timestamp}_${normalizedBaseName}.${fileExtension}`;

      console.log('📤 [BlockImage] Загрузка изображения:', {
        fileName,
        userId: targetUserId,
        category: 'articles',
      });

      const url = await uploadFile({
        userId: targetUserId,
        file,
        category: 'articles',
        fileName,
      });

      if (url) {
        console.log('✅ [BlockImage] Изображение загружено:', { url });

        // Извлекаем imageKey из URL или storagePath
        let finalImageKey: string;
        if (url.startsWith('users/')) {
          // Если это storagePath, извлекаем имя файла с расширением
          const pathParts = url.split('/');
          finalImageKey = pathParts[pathParts.length - 1] || fileName;
        } else {
          // Если это полный URL, извлекаем имя файла
          const urlParts = url.split('/');
          const fileNameFromUrl = urlParts[urlParts.length - 1]?.split('?')[0] || '';
          finalImageKey = fileNameFromUrl || fileName;
        }

        console.log('📝 [BlockImage] Сохранение imageKey:', { finalImageKey });
        onChange(finalImageKey, captionValue);
      } else {
        console.error('❌ [BlockImage] Failed to upload image: url is null');
      }
    } catch (error) {
      console.error('❌ [BlockImage] Error uploading image:', error);
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

  const handleCaptionKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onEnter?.(true); // Создаем новый блок при Enter в caption
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Обработка Enter только если фокус на самом блоке (не на input caption)
    if (e.key === 'Enter' && !(e.target instanceof HTMLInputElement)) {
      e.preventDefault();
      onEnter?.(true); // Всегда считаем, что Enter нажато в конце
    }
  };

  // Формируем URL изображения с учетом userId
  const imageUrl = imageKey
    ? userId
      ? getImageUrl(imageKey, '.jpg', {
          userId,
          category: 'articles',
          useSupabaseStorage: shouldUseSupabaseStorage(),
        })
      : getUserImageUrl(imageKey, 'articles')
    : '';

  const handleImageClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect?.();
  };

  return (
    <div
      className="edit-article-v2__block edit-article-v2__block--image"
      onFocus={onFocus}
      onBlur={onBlur}
      onKeyDown={handleKeyDown}
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
          onKeyDown={handleCaptionKeyDown}
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
