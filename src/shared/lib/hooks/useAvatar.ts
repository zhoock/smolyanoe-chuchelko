// src/shared/lib/hooks/useAvatar.ts
/**
 * Хук для работы с аватаром пользователя
 */

import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  AVATAR_MAX_FILE_SIZE_BYTES,
  appendUrlCacheBustParam,
  profileAvatarRetinaUrlFrom1x,
} from '@shared/lib/avatarUpload';
import {
  buildProxyImageUrlFromStoragePath,
  deleteProfileAvatarFromServer,
  uploadFile,
} from '@shared/api/storage';

export const PROFILE_AVATAR_LOCALSTORAGE_KEY = 'user-avatar-url';
const AVATAR_URL_KEY = PROFILE_AVATAR_LOCALSTORAGE_KEY;
const DEFAULT_AVATAR = '/images/avatar.png';

/** Событие после смены URL аватара в localStorage (для синхронизации шапки и т.п.) */
export const PROFILE_AVATAR_CHANGED_EVENT = 'profile-avatar-changed';

function dispatchProfileAvatarChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(PROFILE_AVATAR_CHANGED_EVENT));
}

/** Публичный URL аватара из localStorage (без cache-bust), иначе placeholder */
export function getStoredProfileAvatarUrl(): string {
  try {
    const savedUrl = localStorage.getItem(AVATAR_URL_KEY);
    if (savedUrl) return savedUrl;
  } catch (error) {
    console.warn('Failed to read avatar URL from localStorage:', error);
  }
  return DEFAULT_AVATAR;
}

/**
 * URL аватара из localStorage с подпиской на смену (шапка, главная сцена и т.д.).
 */
export function useStoredProfileAvatarUrl(): string {
  const location = useLocation();
  const [src, setSrc] = useState(getStoredProfileAvatarUrl);
  const sync = useCallback(() => {
    setSrc(getStoredProfileAvatarUrl());
  }, []);

  useEffect(() => {
    sync();
  }, [location.pathname, location.key, sync]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === PROFILE_AVATAR_LOCALSTORAGE_KEY || e.key === null) {
        sync();
      }
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener(PROFILE_AVATAR_CHANGED_EVENT, sync);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(PROFILE_AVATAR_CHANGED_EVENT, sync);
    };
  }, [sync]);

  return src;
}

const DEFAULT_FILE_TOO_LARGE_MSG =
  'The image is too large. Maximum file size is 2 MB. Choose a smaller file.';

export type UseAvatarOptions = {
  /** Сообщение при превышении лимита (из UI-словаря) */
  avatarFileTooLargeMessage?: string;
  /**
   * Показать уведомление вместо window.alert (например AlertModal в дашборде).
   * Если не передан — для обратной совместимости остаётся alert().
   */
  onAvatarFileTooLarge?: (message: string) => void;
};

/**
 * Хук для управления аватаром пользователя
 * @returns Объект с состоянием и функциями для работы с аватаром
 */
export function useAvatar(options?: UseAvatarOptions) {
  const { onAvatarFileTooLarge } = options ?? {};
  const fileTooLargeMessage = options?.avatarFileTooLargeMessage ?? DEFAULT_FILE_TOO_LARGE_MSG;

  const [avatarSrc, setAvatarSrc] = useState<string>(() => {
    try {
      const savedUrl = localStorage.getItem(AVATAR_URL_KEY);
      if (savedUrl) {
        // Добавляем cache-bust при загрузке из localStorage для принудительного обновления
        const bust = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        return appendUrlCacheBustParam(savedUrl, bust);
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

  const handleAvatarRemove = useCallback(async () => {
    if (isUploadingAvatar) return;
    setIsUploadingAvatar(true);
    try {
      const ok = await deleteProfileAvatarFromServer();
      if (!ok) {
        alert(
          'Не удалось удалить фото в хранилище. Проверьте авторизацию и сеть, затем повторите.'
        );
        return;
      }
      try {
        localStorage.removeItem(AVATAR_URL_KEY);
      } catch (error) {
        console.warn('Failed to clear avatar from localStorage:', error);
      }
      const bust = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      setAvatarSrc(appendUrlCacheBustParam(DEFAULT_AVATAR, bust));
      dispatchProfileAvatarChanged();
    } catch (error) {
      console.error('Failed to remove avatar:', error);
      alert(
        `Ошибка: ${error instanceof Error ? error.message : 'Unknown error'}. Проверьте консоль.`
      );
    } finally {
      setIsUploadingAvatar(false);
    }
  }, [isUploadingAvatar]);

  const handleAvatarChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (file.size > AVATAR_MAX_FILE_SIZE_BYTES) {
        if (onAvatarFileTooLarge) {
          onAvatarFileTooLarge(fileTooLargeMessage);
        } else {
          alert(fileTooLargeMessage);
        }
        e.target.value = '';
        return;
      }

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

        // API может вернуть storagePath `users/.../profile/...` — в браузер нужен proxy URL
        let displayUrl = result;
        if (
          !displayUrl.startsWith('http') &&
          displayUrl.startsWith('users/') &&
          displayUrl.includes('/profile/')
        ) {
          displayUrl = buildProxyImageUrlFromStoragePath(displayUrl);
        }
        if (!displayUrl.startsWith('http')) {
          console.error('Invalid URL returned:', result, '->', displayUrl);
          alert('Получен невалидный URL аватара. Проверьте консоль для деталей.');
          return;
        }

        // Используем URL, который вернула функция uploadFile (публичный URL из Supabase Storage)
        // Добавляем агрессивный cache-bust для принудительного обновления изображения
        const bust = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        const avatarUrl = appendUrlCacheBustParam(displayUrl, bust);

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
          localStorage.setItem(AVATAR_URL_KEY, displayUrl);
        } catch (error) {
          console.warn('Failed to save avatar URL to localStorage:', error);
        }

        // Обновляем состояние только после предзагрузки
        setAvatarSrc(avatarUrl);
        dispatchProfileAvatarChanged();
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
    },
    [fileTooLargeMessage, onAvatarFileTooLarge]
  );

  const avatarRetinaSrc = useMemo(() => profileAvatarRetinaUrlFrom1x(avatarSrc), [avatarSrc]);

  return {
    avatarSrc,
    avatarRetinaSrc,
    isUploadingAvatar,
    avatarInputRef,
    handleAvatarClick,
    handleAvatarChange,
    handleAvatarRemove,
  };
}
