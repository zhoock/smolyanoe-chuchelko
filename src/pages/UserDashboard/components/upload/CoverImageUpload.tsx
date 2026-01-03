// src/pages/UserDashboard/components/CoverImageUpload.tsx
import React, { useState, useRef } from 'react';
import { useAppSelector } from '@shared/lib/hooks/useAppSelector';
import { selectUiDictionaryFirst } from '@shared/model/uiDictionary';
import { useLang } from '@app/providers/lang';
import { CoverImageCropModal } from '../modals/cover/CoverImageCropModal';
import { uploadFile } from '@shared/api/storage';
import { getUser } from '@shared/lib/auth';
import './CoverImageUpload.style.scss';

interface CoverImageUploadProps {
  currentCoverUrl?: string | null;
  onCoverUpdated?: (url: string) => void;
}

// Валидация файла
const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15 MB
const MIN_WIDTH = 1920;
const MIN_HEIGHT = 1140;
const ALLOWED_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
  'image/heic',
  'image/heif',
];

function validateImageFile(file: File): Promise<{ valid: boolean; error?: string }> {
  return new Promise((resolve) => {
    // Проверка типа файла
    if (!ALLOWED_TYPES.includes(file.type.toLowerCase())) {
      resolve({
        valid: false,
        error: 'invalidFileType',
      });
      return;
    }

    // Проверка размера файла
    if (file.size > MAX_FILE_SIZE) {
      resolve({
        valid: false,
        error: 'fileTooLarge',
      });
      return;
    }

    // Проверка размеров изображения
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl); // Освобождаем память
      if (img.width < MIN_WIDTH || img.height < MIN_HEIGHT) {
        resolve({
          valid: false,
          error: 'imageTooSmall',
        });
      } else {
        resolve({ valid: true });
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl); // Освобождаем память даже при ошибке
      resolve({
        valid: false,
        error: 'uploadError',
      });
    };
    img.src = objectUrl;
  });
}

export function CoverImageUpload({ currentCoverUrl, onCoverUpdated }: CoverImageUploadProps) {
  const { lang } = useLang();
  const ui = useAppSelector((state) => selectUiDictionaryFirst(state, lang));

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (file: File) => {
    setError(null);

    const validation = await validateImageFile(file);
    if (!validation.valid) {
      let errorMessage = '';
      switch (validation.error) {
        case 'invalidFileType':
          errorMessage =
            ui?.dashboard?.profileSettingsModal?.validation?.invalidFileType ??
            'Неподдерживаемый формат файла';
          break;
        case 'fileTooLarge':
          errorMessage = (
            ui?.dashboard?.profileSettingsModal?.validation?.fileTooLarge ?? 'Файл слишком большой'
          ).replace('{size}', '15');
          break;
        case 'imageTooSmall':
          errorMessage = (
            ui?.dashboard?.profileSettingsModal?.validation?.imageTooSmall ??
            'Изображение слишком маленькое'
          )
            .replace('{width}', String(MIN_WIDTH))
            .replace('{height}', String(MIN_HEIGHT));
          break;
        default:
          errorMessage =
            ui?.dashboard?.profileSettingsModal?.validation?.uploadError ?? 'Ошибка загрузки файла';
      }
      setError(errorMessage);
      return;
    }

    console.log('📁 File validated and selected:', file.name, file.size, file.type);
    setSelectedFile(file);
    setIsCropModalOpen(true);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
    // Сбрасываем input, чтобы можно было выбрать тот же файл снова
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleSave = async (croppedBlob: Blob) => {
    try {
      setIsUploading(true);
      setError(null);

      const user = getUser();
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      const fileName = `cover-${Date.now()}.jpg`;
      const url = await uploadFile({
        userId: user.id,
        category: 'profile',
        file: croppedBlob,
        fileName,
        contentType: 'image/jpeg',
        upsert: true,
      });

      if (!url) {
        throw new Error('Failed to upload cover');
      }

      // Создаем preview URL для отображения
      const previewBlobUrl = URL.createObjectURL(croppedBlob);
      setPreviewUrl(previewBlobUrl);

      if (onCoverUpdated) {
        onCoverUpdated(url);
      }

      setIsCropModalOpen(false);
      setSelectedFile(null);
    } catch (err) {
      console.error('Error uploading cover:', err);
      setError(
        ui?.dashboard?.profileSettingsModal?.messages?.coverUploadError ?? 'Ошибка загрузки обложки'
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handlePreview = (croppedBlob: Blob) => {
    const previewUrl = URL.createObjectURL(croppedBlob);
    setPreviewUrl(previewUrl);
    // Можно открыть в новом окне или показать в модалке
    window.open(previewUrl, '_blank');
  };

  const displayUrl = previewUrl || currentCoverUrl;

  return (
    <>
      <div className="cover-image-upload">
        <label className="cover-image-upload__label">
          {ui?.dashboard?.profileSettingsModal?.fields?.headerImages ??
            'Изображения для шапки сайта'}
        </label>

        {displayUrl ? (
          <div className="cover-image-upload__preview">
            <img
              src={displayUrl}
              alt="Cover preview"
              className="cover-image-upload__preview-image"
            />
            <button
              type="button"
              className="cover-image-upload__replace-button"
              onClick={() => fileInputRef.current?.click()}
            >
              {lang === 'ru' ? 'Заменить обложку' : 'Replace cover'}
            </button>
          </div>
        ) : (
          <div
            className="cover-image-upload__dropzone"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="cover-image-upload__dropzone-icon">+</div>
            <div className="cover-image-upload__dropzone-text">
              {ui?.dashboard?.profileSettingsModal?.buttons?.uploadCover ?? 'Загрузить обложку'}
            </div>
            <div className="cover-image-upload__dropzone-hint">
              {ui?.dashboard?.profileSettingsModal?.hints?.coverImage ??
                'Рекомендуемое разрешение: 2560 × 1522'}
            </div>
          </div>
        )}

        {error && <div className="cover-image-upload__error">{error}</div>}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp,image/gif,image/avif,image/heic,image/heif"
          className="cover-image-upload__input"
          onChange={handleFileInput}
        />
      </div>

      <CoverImageCropModal
        isOpen={isCropModalOpen}
        imageFile={selectedFile}
        onClose={() => {
          setIsCropModalOpen(false);
          setSelectedFile(null);
        }}
        onSave={handleSave}
        onPreview={handlePreview}
      />
    </>
  );
}
