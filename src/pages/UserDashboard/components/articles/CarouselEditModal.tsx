// src/pages/UserDashboard/components/CarouselEditModal.tsx
import React, { useState, useRef, useEffect } from 'react';
import { getUserImageUrl } from '@shared/api/albums';
import { uploadFile } from '@shared/api/storage';
import { CURRENT_USER_CONFIG } from '@config/user';
import { Popup } from '@shared/ui/popup';

interface CarouselEditModalProps {
  blockId: string;
  initialImageKeys: string[];
  initialCaption?: string;
  onSave: (imageKeys: string[], caption?: string) => void;
  onCancel: () => void;
}

export function CarouselEditModal({
  blockId,
  initialImageKeys,
  initialCaption,
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
      const newImageKeys: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileExtension = file.name.split('.').pop() || 'jpg';
        const baseFileName = file.name.replace(/\.[^/.]+$/, '');
        const timestamp = Date.now() + i;
        const fileName = `article_${timestamp}_${baseFileName}.${fileExtension}`;
        const imageKey = `article_${timestamp}_${baseFileName}`;

        const url = await uploadFile({
          userId: CURRENT_USER_CONFIG.userId,
          file,
          category: 'articles',
          fileName,
        });

        if (url) {
          newImageKeys.push(imageKey);
        }
      }
      setImageKeys([...imageKeys, ...newImageKeys]);
    } catch (error) {
      console.error('Error uploading images:', error);
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
            {imageKeys.map((imageKey, index) => (
              <div key={imageKey} className="edit-article-v2__carousel-edit-thumbnail">
                <img src={getUserImageUrl(imageKey, 'articles')} alt={`Image ${index + 1}`} />
                <button
                  type="button"
                  className="edit-article-v2__carousel-edit-remove"
                  onClick={() => handleRemoveImage(index)}
                  aria-label="Удалить изображение"
                >
                  ×
                </button>
              </div>
            ))}
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
