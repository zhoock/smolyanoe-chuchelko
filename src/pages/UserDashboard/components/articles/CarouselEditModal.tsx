// src/pages/UserDashboard/components/CarouselEditModal.tsx
import React, { useState, useRef, useEffect } from 'react';
import { getUserImageUrl, getImageUrl, shouldUseSupabaseStorage } from '@shared/api/albums';
import { uploadFile } from '@shared/api/storage';
import { getUser } from '@shared/lib/auth';
import { Popup } from '@shared/ui/popup';

interface CarouselEditModalProps {
  blockId: string;
  initialImageKeys: string[];
  initialCaption?: string;
  userId?: string; // UUID владельца статьи для правильной загрузки изображений
  onSave: (imageKeys: string[], caption?: string) => void;
  onCancel: () => void;
}

export function CarouselEditModal({
  blockId,
  initialImageKeys,
  initialCaption,
  userId,
  onSave,
  onCancel,
}: CarouselEditModalProps) {
  const [imageKeys, setImageKeys] = useState<string[]>(initialImageKeys);
  const [caption, setCaption] = useState<string>(initialCaption || '');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setIsUploading(true);
    try {
      // Получаем userId из пропсов или из авторизованного пользователя
      const currentUser = getUser();
      const targetUserId = userId || currentUser?.id;

      if (!targetUserId) {
        console.error('❌ [CarouselEditModal] User ID not found. Cannot upload images.');
        setIsUploading(false);
        return;
      }

      const newImageKeys: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        // Нормализуем имя файла
        const fileExtension = file.name.split('.').pop() || 'jpg';
        const baseFileName = file.name.replace(/\.[^/.]+$/, '');
        const normalizedBaseName =
          baseFileName
            .replace(/\s+/g, '_')
            .replace(/[^a-zA-Z0-9._-]/g, '')
            .replace(/_{2,}/g, '_')
            .replace(/^_+|_+$/g, '') || 'article_image';

        const timestamp = Date.now() + i;
        const fileName = `article_${timestamp}_${normalizedBaseName}.${fileExtension}`;

        console.log('📤 [CarouselEditModal] Загрузка изображения:', {
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
          // Извлекаем imageKey из URL или storagePath
          let imageKey: string;
          if (url.startsWith('users/')) {
            // Если это storagePath, извлекаем имя файла с расширением
            const pathParts = url.split('/');
            imageKey = pathParts[pathParts.length - 1] || fileName;
          } else {
            // Если это полный URL, извлекаем имя файла
            const urlParts = url.split('/');
            const fileNameFromUrl = urlParts[urlParts.length - 1]?.split('?')[0] || '';
            imageKey = fileNameFromUrl || fileName;
          }

          console.log('✅ [CarouselEditModal] Изображение загружено:', { imageKey });
          newImageKeys.push(imageKey);
        }
      }
      setImageKeys([...imageKeys, ...newImageKeys]);
    } catch (error) {
      console.error('❌ [CarouselEditModal] Error uploading images:', error);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveImage = (index: number) => {
    setImageKeys(imageKeys.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    onSave(imageKeys, caption || undefined);
  };

  return (
    <Popup isActive={true} onClose={onCancel}>
      <div className="edit-article-v2__carousel-edit-modal">
        <div className="edit-article-v2__carousel-edit-header">
          <h2 className="edit-article-v2__carousel-edit-title">Редактирование карусели</h2>
          <div className="edit-article-v2__carousel-edit-count">
            {imageKeys.length} {imageKeys.length === 1 ? 'фотография' : 'фотографий'}
          </div>
          <div className="edit-article-v2__carousel-edit-actions">
            <button
              type="button"
              className="edit-article-v2__carousel-edit-cancel"
              onClick={onCancel}
            >
              Отмена
            </button>
            <button
              type="button"
              className="edit-article-v2__carousel-edit-save"
              onClick={handleSave}
            >
              Сохранить
            </button>
          </div>
        </div>

        <div className="edit-article-v2__carousel-edit-content">
          <div className="edit-article-v2__carousel-edit-thumbnails">
            {imageKeys.map((imageKey, index) => {
              // Формируем URL изображения с учетом userId
              const imageUrl = userId
                ? getImageUrl(imageKey, '.jpg', {
                    userId,
                    category: 'articles',
                    useSupabaseStorage: shouldUseSupabaseStorage(),
                  })
                : getUserImageUrl(imageKey, 'articles');

              return (
                <div key={imageKey} className="edit-article-v2__carousel-edit-thumbnail">
                  <img src={imageUrl} alt={`Image ${index + 1}`} />
                  <button
                    type="button"
                    className="edit-article-v2__carousel-edit-remove"
                    onClick={() => handleRemoveImage(index)}
                    aria-label="Удалить изображение"
                  >
                    ×
                  </button>
                </div>
              );
            })}
            <button
              type="button"
              className="edit-article-v2__carousel-edit-add"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              {isUploading ? 'Загрузка...' : '+'}
            </button>
          </div>

          <input
            type="text"
            className="edit-article-v2__carousel-edit-caption-input"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Подпись к карусели (необязательно)"
          />
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={handleFileSelect}
        />
      </div>
    </Popup>
  );
}
