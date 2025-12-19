// src/shared/lib/hooks/useAvatar.ts
/**
 * Хук для работы с аватаром пользователя
 */

import { useState, useRef, useCallback } from 'react';
import { uploadFile } from '@shared/api/storage';

const AVATAR_URL_KEY = 'user-avatar-url';
const DEFAULT_AVATAR = '/images/avatar.png';

/**
 * Хук для управления аватаром пользователя
 * @returns Объект с состоянием и функциями для работы с аватаром
 */
export function useAvatar() {
  const [avatarSrc, setAvatarSrc] = useState<string>(() => {
    try {
      const savedUrl = localStorage.getItem(AVATAR_URL_KEY);
      if (savedUrl) {
        // Добавляем cache-bust при загрузке из localStorage для принудительного обновления
        const bust = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        return `${savedUrl}?t=${bust}`;
      }
    } catch (error) {
      console.warn('Failed to load avatar URL from localStorage:', error);
    }
    return DEFAULT_AVATAR;
  });

  const [isUploadingAvatar, setIsUploadingAvatar] = useState<boolean>(false);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  const handleAvatarClick = useCallback(() => {
    if (isUploadingAvatar) return;
    avatarInputRef.current?.click();
  }, [isUploadingAvatar]);

  const handleAvatarChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingAvatar(true);
    try {
      // Определяем расширение файла из MIME типа или имени файла
      let fileExtension = '.jpg'; // По умолчанию
      if (file.type) {
        if (file.type === 'image/png') {
          fileExtension = '.png';
        } else if (file.type === 'image/jpeg' || file.type === 'image/jpg') {
          fileExtension = '.jpg';
        } else if (file.type === 'image/webp') {
          fileExtension = '.webp';
        } else {
          // Пытаемся определить из имени файла
          const nameMatch = file.name.match(/\.([a-z0-9]+)$/i);
          if (nameMatch) {
            fileExtension = `.${nameMatch[1].toLowerCase()}`;
          }
        }
      }

      const fileName = `profile${fileExtension}`;

      const result = await uploadFile({
        category: 'profile',
        file,
        fileName,
        upsert: true,
      });

      if (!result) {
        console.error('Upload failed: result is null');
        alert('Не удалось загрузить аватар. Проверьте консоль для деталей и повторите.');
        return;
      }

      // Проверяем, что URL валидный
      if (!result.startsWith('http')) {
        console.error('Invalid URL returned:', result);
        alert('Получен невалидный URL аватара. Проверьте консоль для деталей.');
        return;
      }

      // Используем URL, который вернула функцию uploadFile (публичный URL из Supabase Storage)
      // Добавляем агрессивный cache-bust для принудительного обновления изображения
      const bust = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const avatarUrl = `${result}?t=${bust}`;

      // Предзагружаем новое изображение перед обновлением состояния
      const preloadImg = new Image();

      await new Promise<void>((resolve) => {
        preloadImg.onload = () => {
          resolve();
        };
        preloadImg.onerror = () => {
          console.warn('⚠️ Failed to preload new avatar, but will try to display it anyway');
          resolve();
        };
        preloadImg.src = avatarUrl;
      });

      // Сохраняем URL в localStorage (без cache-bust)
      try {
        localStorage.setItem(AVATAR_URL_KEY, result);
      } catch (error) {
        console.warn('Failed to save avatar URL to localStorage:', error);
      }

      // Обновляем состояние только после предзагрузки
      setAvatarSrc(avatarUrl);
    } catch (error) {
      console.error('❌ Error uploading avatar:', error);
      alert(
        `Ошибка загрузки аватара: ${error instanceof Error ? error.message : 'Unknown error'}. Проверьте консоль для деталей.`
      );
    } finally {
      setIsUploadingAvatar(false);
      if (avatarInputRef.current) {
        avatarInputRef.current.value = '';
      }
    }
  }, []);

  return {
    avatarSrc,
    isUploadingAvatar,
    avatarInputRef,
    handleAvatarClick,
    handleAvatarChange,
  };
}
