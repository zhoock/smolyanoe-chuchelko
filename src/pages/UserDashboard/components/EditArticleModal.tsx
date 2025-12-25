// src/pages/UserDashboard/components/EditArticleModal.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Popup } from '@shared/ui/popup';
import { AlertModal } from '@shared/ui/alertModal';
import { ImageCarousel } from '@shared/ui/image-carousel';
import { useAppDispatch } from '@shared/lib/hooks/useAppDispatch';
import { useAppSelector } from '@shared/lib/hooks/useAppSelector';
import { useLang } from '@app/providers/lang';
import { selectArticleById } from '@entities/article';
import { getToken } from '@shared/lib/auth';
import { getUserImageUrl } from '@shared/api/albums';
import { CURRENT_USER_CONFIG } from '@config/user';
import { uploadFile } from '@shared/api/storage';
import { fetchArticles } from '@entities/article';
import type { IArticles } from '@models';
import type { SimplifiedBlock } from './EditArticleModal.utils';
import { normalizeDetailsToSimplified, simplifiedToDetails } from './EditArticleModal.utils';
import '@entities/article/ui/style.scss';
import './EditArticleModal.style.scss';

interface EditArticleModalProps {
  isOpen: boolean;
  article: IArticles;
  onClose: () => void;
}

type AlertModalState = {
  isOpen: boolean;
  title?: string;
  message: string;
  variant?: 'success' | 'error' | 'warning' | 'info';
};

const LANG_TEXTS = {
  ru: {
    editArticle: 'Редактирование статьи',
    close: 'Закрыть',
    error: 'Ошибка',
    success: 'Успешно',
    pleaseSelectImage: 'Пожалуйста, выберите изображение',
    errorUploadingImage: 'Ошибка при загрузке изображения',
    articleNotFound: 'Статья не найдена. Пожалуйста, обновите страницу.',
    titleEmpty: 'Название статьи не может быть пустым',
    notAuthorized: 'Вы не авторизованы',
    failedToGetId:
      'Не удалось получить ID статьи. Пожалуйста, обновите страницу и попробуйте снова.',
    articleSaved: 'Статья успешно сохранена',
    articlePublished: 'Статья успешно опубликована',
    savingError: 'Ошибка при сохранении статьи',
    publishingError: 'Ошибка при публикации статьи',
    uploading: 'Загрузка...',
    replace: 'Заменить',
    delete: 'Удалить',
    addPhoto: '+ Добавить фото',
    addText: '+ Добавить текст',
    save: 'Сохранить',
    saving: 'Сохранение...',
    publish: 'Опубликовать',
    publishing: 'Публикация...',
    cancel: 'Отмена',
    editCarousel: 'Редактировать карусель',
    autoSaving: 'Сохранение...',
    saved: 'Сохранено',
    draft: 'Черновик',
  },
  en: {
    editArticle: 'Edit Article',
    close: 'Close',
    error: 'Error',
    success: 'Success',
    pleaseSelectImage: 'Please select an image',
    errorUploadingImage: 'Error uploading image',
    articleNotFound: 'Article not found. Please refresh the page.',
    titleEmpty: 'Article title cannot be empty',
    notAuthorized: 'You are not authorized',
    failedToGetId: 'Failed to get article ID. Please refresh the page and try again.',
    articleSaved: 'Article saved successfully',
    articlePublished: 'Article published successfully',
    savingError: 'Error saving article',
    publishingError: 'Error publishing article',
    uploading: 'Uploading...',
    replace: 'Replace',
    delete: 'Delete',
    addPhoto: '+ Add photo',
    addText: '+ Add text',
    save: 'Save',
    saving: 'Saving...',
    publish: 'Publish',
    publishing: 'Publishing...',
    cancel: 'Cancel',
    editCarousel: 'Edit carousel',
    autoSaving: 'Saving...',
    saved: 'Saved',
    draft: 'Draft',
  },
};

export function EditArticleModal({ isOpen, article, onClose }: EditArticleModalProps) {
  const { lang } = useLang();
  const dispatch = useAppDispatch();
  const texts = LANG_TEXTS[lang];

  // Получаем актуальную статью из Redux store после сохранения
  const updatedArticle = useAppSelector((state) =>
    article?.articleId ? selectArticleById(state, lang, article.articleId) : undefined
  );
  const currentArticle = updatedArticle || article;

  const [isPublishing, setIsPublishing] = useState(false);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  // Сохраняем исходный статус статьи (опубликована или черновик)
  const [originalIsDraft, setOriginalIsDraft] = useState<boolean | undefined>(
    currentArticle?.isDraft
  );
  const [editingData, setEditingData] = useState({
    nameArticle: currentArticle?.nameArticle || '',
    description: currentArticle?.description || '',
  });

  const [blocks, setBlocks] = useState<SimplifiedBlock[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingImageIndex, setUploadingImageIndex] = useState<number | null>(null);
  const [editingCarouselIndex, setEditingCarouselIndex] = useState<number | null>(null);
  const [alertModal, setAlertModal] = useState<AlertModalState | null>(null);

  // Контроль инициализации - чтобы не перетирать ввод пользователя
  const didInitRef = useRef(false);
  // Флаг для отслеживания размонтирования компонента
  const isMountedRef = useRef(true);
  // Ref для debounce таймера автосохранения
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Устанавливаем флаг при размонтировании и сбрасываем при открытии модалки
  useEffect(() => {
    if (isOpen) {
      isMountedRef.current = true;
    }
    return () => {
      isMountedRef.current = false;
    };
  }, [isOpen]);

  // Вспомогательная функция для показа алерта
  const showAlert = useCallback(
    (message: string, variant: AlertModalState['variant'] = 'error', title?: string) => {
      if (isMountedRef.current) {
        setAlertModal({
          isOpen: true,
          title: title || texts.error,
          message,
          variant,
        });
      }
    },
    [texts.error]
  );

  // Получаем статью для редактирования (включая черновики)
  const fetchArticleForEditing = useCallback(async () => {
    if (!currentArticle?.articleId && !article?.articleId) return null;

    try {
      const token = getToken();
      if (!token) return null;

      // Получаем статью со статусом (включая черновики)
      const response = await fetch(`/api/articles-api?lang=${lang}&includeDrafts=true`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const articlesList = Array.isArray(data) ? data : (data.data ?? data.articles ?? []);
        const articleForEdit = articlesList.find(
          (a: IArticles) => a.articleId === (currentArticle?.articleId || article.articleId)
        );
        return articleForEdit || null;
      }
    } catch (error) {
      console.error('Error fetching article for editing:', error);
    }
    return null;
  }, [currentArticle, article, lang]);

  // Инициализируем данные только при первом открытии модалки
  useEffect(() => {
    if (!isOpen) {
      didInitRef.current = false;
      return;
    }

    if (didInitRef.current) {
      return;
    }

    const articleToUse = currentArticle || article;
    if (!articleToUse?.articleId) {
      return;
    }

    didInitRef.current = true;

    // Загружаем статью со статусом для редактирования
    fetchArticleForEditing().then((articleWithStatus) => {
      const articleToInit = articleWithStatus || articleToUse;
      const simplified = normalizeDetailsToSimplified(articleToInit.details || []);
      setEditingData({
        nameArticle: articleToInit.nameArticle,
        description: articleToInit.description || '',
      });
      setBlocks(simplified);

      // Сохраняем исходный статус статьи
      // Если статья не имеет isDraft:
      //   - для существующих статей (есть id) = опубликована (false)
      //   - для новых статей (нет id) = черновик (true)
      if (articleWithStatus) {
        // Статья существует в БД - используем её статус
        setOriginalIsDraft(articleWithStatus.isDraft ?? false);
      } else if (articleToUse.id) {
        // Статья существует, но не загружена со статусом - считаем опубликованной
        setOriginalIsDraft(false);
      } else {
        // Новая статья - по умолчанию черновик
        setOriginalIsDraft(true);
      }
    });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, article.articleId, lang]);

  // Извлечение имени файла из URL
  const extractFileNameFromUrl = (url: string, fallback: string): string => {
    try {
      if (url.startsWith('http://') || url.startsWith('https://')) {
        const urlParts = url.split('/');
        const fileName = urlParts[urlParts.length - 1].split('?')[0];
        return fileName || fallback;
      }
      return url.split('/').pop() || fallback;
    } catch {
      return fallback;
    }
  };

  // Обработка загрузки изображения
  const handleImageUpload = async (file: File, blockIndex?: number) => {
    if (!file.type.startsWith('image/')) {
      showAlert(texts.pleaseSelectImage);
      return;
    }

    if (blockIndex !== undefined) {
      setUploadingImageIndex(blockIndex);
    }

    try {
      const userId = CURRENT_USER_CONFIG.userId;
      if (!userId) {
        throw new Error('User ID is not available');
      }

      const timestamp = Date.now();
      const fileExtension = file.name.split('.').pop() || 'jpg';
      const fileName = `article-${timestamp}-${Math.random().toString(36).substring(2, 15)}.${fileExtension}`;

      const imageUrl = await uploadFile({
        userId,
        file,
        fileName,
        category: 'articles',
        contentType: file.type,
      });

      if (!imageUrl) {
        throw new Error('Failed to upload image');
      }

      const imageFileName = extractFileNameFromUrl(imageUrl, fileName);

      if (blockIndex !== undefined) {
        setBlocks((prev) => {
          const newBlocks = [...prev];
          const block = newBlocks[blockIndex];
          if (block.type === 'carousel' && Array.isArray(block.img)) {
            newBlocks[blockIndex] = {
              ...block,
              img: [...block.img, imageFileName],
            };
          } else {
            newBlocks[blockIndex] = {
              ...block,
              type: 'image',
              img: imageFileName,
            };
          }
          return newBlocks;
        });
        scheduleAutoSave();
      } else {
        const newBlock: SimplifiedBlock = {
          type: 'image',
          id: blocks.length + 1,
          img: imageFileName,
        };
        setBlocks((prev) => [...prev, newBlock]);
        scheduleAutoSave();
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      showAlert(texts.errorUploadingImage);
    } finally {
      if (isMountedRef.current) {
        setUploadingImageIndex(null);
      }
    }
  };

  // Обновление блока
  const updateBlock = (index: number, updates: Partial<SimplifiedBlock>) => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0d98fd1d-24ff-4297-901e-115ee9f70125', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'EditArticleModal.tsx:323',
        message: 'updateBlock called',
        data: { index, updates, blocksCount: blocks.length },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        runId: 'run1',
        hypothesisId: 'D',
      }),
    }).catch(() => {});
    // #endregion
    setBlocks((prev) => {
      const newBlocks = [...prev];
      newBlocks[index] = { ...newBlocks[index], ...updates };
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0d98fd1d-24ff-4297-901e-115ee9f70125', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: 'EditArticleModal.tsx:327',
          message: 'updateBlock state updated',
          data: { index, updatedBlock: newBlocks[index], blocksCount: newBlocks.length },
          timestamp: Date.now(),
          sessionId: 'debug-session',
          runId: 'run1',
          hypothesisId: 'D',
        }),
      }).catch(() => {});
      // #endregion
      return newBlocks;
    });
    // Автосохранение будет вызвано из onBlur, но на всякий случай планируем его здесь тоже
  };

  // Удаление блока
  const deleteBlock = (index: number) => {
    setBlocks((prev) => prev.filter((_, i) => i !== index));
    scheduleAutoSave();
  };

  // Добавление нового текстового блока
  const addTextBlock = () => {
    const newBlock: SimplifiedBlock = {
      type: 'text',
      id: blocks.length + 1,
      content: '',
    };
    setBlocks((prev) => [...prev, newBlock]);
    scheduleAutoSave();
  };

  // Удаление изображения из карусели
  const removeImageFromCarousel = (blockIndex: number, imageIndex: number) => {
    setBlocks((prev) => {
      const newBlocks = [...prev];
      const block = newBlocks[blockIndex];
      if (block.type === 'carousel' && Array.isArray(block.img)) {
        const newImages = block.img.filter((_, i) => i !== imageIndex);
        if (newImages.length === 0) {
          return newBlocks.filter((_, i) => i !== blockIndex);
        }
        newBlocks[blockIndex] = {
          ...block,
          img: newImages,
        };
      }
      return newBlocks;
    });
    // Закрываем режим редактирования, если осталось одно изображение
    if (editingCarouselIndex === blockIndex) {
      const block = blocks[blockIndex];
      if (block?.type === 'carousel' && Array.isArray(block.img) && block.img.length <= 1) {
        setEditingCarouselIndex(null);
      }
    }
    scheduleAutoSave();
  };

  // Автосохранение (сохраняет изменения без изменения статуса)
  const autoSaveDraft = useCallback(async () => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0d98fd1d-24ff-4297-901e-115ee9f70125', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'EditArticleModal.tsx:377',
        message: 'autoSaveDraft called',
        data: {
          hasCurrentArticle: !!currentArticle,
          isPublishing,
          isMounted: isMountedRef.current,
          articleId: currentArticle?.id || currentArticle?.articleId,
        },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        runId: 'run1',
        hypothesisId: 'B',
      }),
    }).catch(() => {});
    // #endregion
    if (!currentArticle || isPublishing) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0d98fd1d-24ff-4297-901e-115ee9f70125', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: 'EditArticleModal.tsx:378',
          message: 'autoSaveDraft blocked by condition',
          data: { hasCurrentArticle: !!currentArticle, isPublishing },
          timestamp: Date.now(),
          sessionId: 'debug-session',
          runId: 'run1',
          hypothesisId: 'B',
        }),
      }).catch(() => {});
      // #endregion
      return;
    }

    const articleIdToUse = currentArticle?.id || currentArticle?.articleId;
    if (!articleIdToUse) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0d98fd1d-24ff-4297-901e-115ee9f70125', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: 'EditArticleModal.tsx:381',
          message: 'autoSaveDraft blocked: no articleId',
          data: {},
          timestamp: Date.now(),
          sessionId: 'debug-session',
          runId: 'run1',
          hypothesisId: 'B',
        }),
      }).catch(() => {});
      // #endregion
      return;
    }

    if (!isMountedRef.current) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0d98fd1d-24ff-4297-901e-115ee9f70125', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: 'EditArticleModal.tsx:383',
          message: 'autoSaveDraft blocked: not mounted',
          data: {},
          timestamp: Date.now(),
          sessionId: 'debug-session',
          runId: 'run1',
          hypothesisId: 'B',
        }),
      }).catch(() => {});
      // #endregion
      return;
    }

    setIsAutoSaving(true);
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0d98fd1d-24ff-4297-901e-115ee9f70125', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'EditArticleModal.tsx:385',
        message: 'autoSaveDraft starting',
        data: { articleIdToUse, blocksCount: blocks.length, editingData },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        runId: 'run1',
        hypothesisId: 'B',
      }),
    }).catch(() => {});
    // #endregion

    try {
      const token = getToken();
      if (!token) return;

      // Принудительно обновляем все contentEditable элементы
      document.querySelectorAll('[contenteditable="true"]').forEach((el) => {
        if (el instanceof HTMLElement) {
          el.blur();
        }
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      const details = simplifiedToDetails(blocks);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0d98fd1d-24ff-4297-901e-115ee9f70125', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: 'EditArticleModal.tsx:400',
          message: 'Before API call',
          data: {
            detailsCount: details.length,
            blocksCount: blocks.length,
            originalIsDraft,
            shouldBeDraft: originalIsDraft ?? true,
            editingData,
          },
          timestamp: Date.now(),
          sessionId: 'debug-session',
          runId: 'run1',
          hypothesisId: 'C',
        }),
      }).catch(() => {});
      // #endregion

      // Определяем, нужно ли менять статус
      // Если статья была опубликована (isDraft = false), сохраняем её статус
      // Если статья была черновиком или новая, сохраняем как черновик
      const shouldBeDraft = originalIsDraft ?? true; // По умолчанию черновик для новых статей

      const requestBody = {
        articleId: currentArticle?.articleId || article.articleId,
        nameArticle: editingData.nameArticle,
        description: editingData.description,
        img: currentArticle?.img || article.img,
        date: currentArticle?.date || article.date,
        details: details,
        lang: lang,
        isDraft: shouldBeDraft,
      };
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0d98fd1d-24ff-4297-901e-115ee9f70125', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: 'EditArticleModal.tsx:413',
          message: 'Sending PUT request',
          data: { articleIdToUse, requestBody: JSON.stringify(requestBody).substring(0, 200) },
          timestamp: Date.now(),
          sessionId: 'debug-session',
          runId: 'run1',
          hypothesisId: 'C',
        }),
      }).catch(() => {});
      // #endregion
      const response = await fetch(`/api/articles-api?id=${encodeURIComponent(articleIdToUse)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      });
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0d98fd1d-24ff-4297-901e-115ee9f70125', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: 'EditArticleModal.tsx:425',
          message: 'API response received',
          data: { status: response.status, ok: response.ok, statusText: response.statusText },
          timestamp: Date.now(),
          sessionId: 'debug-session',
          runId: 'run1',
          hypothesisId: 'C',
        }),
      }).catch(() => {});
      // #endregion

      if (response.ok) {
        // Получаем ответ от API для проверки сохраненных данных
        const responseData = await response.json().catch(() => null);
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/0d98fd1d-24ff-4297-901e-115ee9f70125', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            location: 'EditArticleModal.tsx:427',
            message: 'API response data',
            data: {
              hasResponseData: !!responseData,
              responseDataKeys: responseData ? Object.keys(responseData) : [],
              responseDataPreview: responseData
                ? JSON.stringify(responseData).substring(0, 500)
                : null,
            },
            timestamp: Date.now(),
            sessionId: 'debug-session',
            runId: 'run1',
            hypothesisId: 'C',
          }),
        }).catch(() => {});
        // #endregion
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/0d98fd1d-24ff-4297-901e-115ee9f70125', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            location: 'EditArticleModal.tsx:427',
            message: 'Auto-save successful',
            data: {},
            timestamp: Date.now(),
            sessionId: 'debug-session',
            runId: 'run1',
            hypothesisId: 'C',
          }),
        }).catch(() => {});
        // #endregion
        setLastSaved(new Date());
        // Обновляем Redux store (только опубликованные статьи) с принудительным обновлением
        try {
          await dispatch(fetchArticles({ lang, force: true })).unwrap();
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/0d98fd1d-24ff-4297-901e-115ee9f70125', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              location: 'EditArticleModal.tsx:431',
              message: 'Redux store updated',
              data: {},
              timestamp: Date.now(),
              sessionId: 'debug-session',
              runId: 'run1',
              hypothesisId: 'E',
            }),
          }).catch(() => {});
          // #endregion
        } catch (error) {
          console.warn('⚠️ Не удалось обновить статьи из Redux:', error);
          // #region agent log
          const errorDetails =
            error instanceof Error
              ? {
                  name: error.name,
                  message: error.message,
                  stack: error.stack?.substring(0, 500),
                }
              : typeof error === 'object' && error !== null
                ? {
                    type: typeof error,
                    keys: Object.keys(error),
                    stringified: JSON.stringify(error).substring(0, 500),
                  }
                : { type: typeof error, value: String(error) };
          fetch('http://127.0.0.1:7242/ingest/0d98fd1d-24ff-4297-901e-115ee9f70125', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              location: 'EditArticleModal.tsx:432',
              message: 'Redux update failed',
              data: { errorDetails },
              timestamp: Date.now(),
              sessionId: 'debug-session',
              runId: 'run1',
              hypothesisId: 'E',
            }),
          }).catch(() => {});
          // #endregion
        }
      } else {
        // #region agent log
        const errorText = await response.text().catch(() => '');
        fetch('http://127.0.0.1:7242/ingest/0d98fd1d-24ff-4297-901e-115ee9f70125', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            location: 'EditArticleModal.tsx:435',
            message: 'API response not OK',
            data: {
              status: response.status,
              statusText: response.statusText,
              errorText: errorText.substring(0, 200),
            },
            timestamp: Date.now(),
            sessionId: 'debug-session',
            runId: 'run1',
            hypothesisId: 'C',
          }),
        }).catch(() => {});
        // #endregion
      }
    } catch (error) {
      console.error('Auto-save error:', error);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0d98fd1d-24ff-4297-901e-115ee9f70125', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: 'EditArticleModal.tsx:436',
          message: 'Auto-save exception',
          data: {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          },
          timestamp: Date.now(),
          sessionId: 'debug-session',
          runId: 'run1',
          hypothesisId: 'C',
        }),
      }).catch(() => {});
      // #endregion
    } finally {
      if (isMountedRef.current) {
        setIsAutoSaving(false);
      }
    }
  }, [currentArticle, blocks, editingData, lang, dispatch, article, isPublishing, originalIsDraft]);

  // Планирование автосохранения с debounce
  const scheduleAutoSave = useCallback(() => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0d98fd1d-24ff-4297-901e-115ee9f70125', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'EditArticleModal.tsx:445',
        message: 'scheduleAutoSave called',
        data: { hasTimeout: !!autoSaveTimeoutRef.current },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        runId: 'run1',
        hypothesisId: 'A',
      }),
    }).catch(() => {});
    // #endregion
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    autoSaveTimeoutRef.current = setTimeout(() => {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0d98fd1d-24ff-4297-901e-115ee9f70125', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: 'EditArticleModal.tsx:451',
          message: 'Auto-save timer fired, calling autoSaveDraft',
          data: {},
          timestamp: Date.now(),
          sessionId: 'debug-session',
          runId: 'run1',
          hypothesisId: 'A',
        }),
      }).catch(() => {});
      // #endregion
      autoSaveDraft();
    }, 2000); // Сохранять через 2 секунды после последнего изменения
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0d98fd1d-24ff-4297-901e-115ee9f70125', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'EditArticleModal.tsx:453',
        message: 'Auto-save timer scheduled',
        data: { timeoutId: autoSaveTimeoutRef.current },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        runId: 'run1',
        hypothesisId: 'A',
      }),
    }).catch(() => {});
    // #endregion
  }, [autoSaveDraft]);

  // Очистка таймера при размонтировании
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, []);

  // Публикация статьи (убираем из черновика)
  const handlePublish = async () => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0d98fd1d-24ff-4297-901e-115ee9f70125', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'EditArticleModal.tsx:465',
        message: 'handlePublish called',
        data: { hasCurrentArticle: !!currentArticle, editingData, blocksCount: blocks.length },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        runId: 'run1',
        hypothesisId: 'F',
      }),
    }).catch(() => {});
    // #endregion
    if (!currentArticle) {
      showAlert(texts.articleNotFound);
      return;
    }

    if (!editingData.nameArticle.trim()) {
      showAlert(texts.titleEmpty);
      return;
    }

    if (!isMountedRef.current) {
      return;
    }

    // Отменяем запланированное автосохранение
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
      autoSaveTimeoutRef.current = null;
    }

    setIsPublishing(true);

    try {
      const token = getToken();
      if (!token) {
        showAlert(texts.notAuthorized);
        setIsPublishing(false);
        return;
      }

      // Принудительно обновляем все contentEditable элементы перед публикацией
      document.querySelectorAll('[contenteditable="true"]').forEach((el) => {
        if (el instanceof HTMLElement) {
          el.blur();
        }
      });

      // Небольшая задержка, чтобы onBlur успел обработаться
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Сначала сохраняем последние изменения в черновик
      await autoSaveDraft();

      const details = simplifiedToDetails(blocks);
      const articleIdToUse = currentArticle?.id || currentArticle?.articleId;

      if (!articleIdToUse) {
        showAlert(texts.failedToGetId);
        setIsPublishing(false);
        return;
      }

      // Публикуем статью (isDraft = false)
      const publishRequestBody = {
        articleId: currentArticle?.articleId || article.articleId,
        nameArticle: editingData.nameArticle,
        description: editingData.description,
        img: currentArticle?.img || article.img,
        date: currentArticle?.date || article.date,
        details: details,
        lang: lang,
        isDraft: false, // Публикуем статью
      };
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0d98fd1d-24ff-4297-901e-115ee9f70125', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: 'EditArticleModal.tsx:519',
          message: 'Sending publish request',
          data: {
            articleIdToUse,
            requestBody: JSON.stringify(publishRequestBody).substring(0, 200),
          },
          timestamp: Date.now(),
          sessionId: 'debug-session',
          runId: 'run1',
          hypothesisId: 'F',
        }),
      }).catch(() => {});
      // #endregion
      const response = await fetch(`/api/articles-api?id=${encodeURIComponent(articleIdToUse)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(publishRequestBody),
      });
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0d98fd1d-24ff-4297-901e-115ee9f70125', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: 'EditArticleModal.tsx:537',
          message: 'Publish response received',
          data: { status: response.status, ok: response.ok, statusText: response.statusText },
          timestamp: Date.now(),
          sessionId: 'debug-session',
          runId: 'run1',
          hypothesisId: 'F',
        }),
      }).catch(() => {});
      // #endregion

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/0d98fd1d-24ff-4297-901e-115ee9f70125', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            location: 'EditArticleModal.tsx:538',
            message: 'Publish failed',
            data: { status: response.status, errorData },
            timestamp: Date.now(),
            sessionId: 'debug-session',
            runId: 'run1',
            hypothesisId: 'F',
          }),
        }).catch(() => {});
        // #endregion
        throw new Error((errorData as any)?.error || `HTTP error! status: ${response.status}`);
      }

      // Обновляем Redux store через thunk с принудительным обновлением
      try {
        await dispatch(fetchArticles({ lang, force: true })).unwrap();
      } catch (error: any) {
        console.warn(
          '⚠️ Не удалось обновить статьи из Redux, но публикация прошла успешно:',
          error
        );
      }

      if (!isMountedRef.current) {
        return;
      }

      showAlert(texts.articlePublished, 'success', texts.success);

      setTimeout(() => {
        if (isMountedRef.current) {
          onClose();
        }
      }, 1500);
    } catch (error) {
      console.error('Error publishing article:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      showAlert(`${texts.publishingError}: ${errorMessage}`);
    } finally {
      if (isMountedRef.current) {
        setIsPublishing(false);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <Popup isActive={isOpen} onClose={onClose}>
        <div className="edit-article-modal">
          <div className="edit-article-modal__card">
            <div className="edit-article-modal__header">
              <div className="edit-article-modal__header-left">
                <h2 className="edit-article-modal__title">{texts.editArticle}</h2>
                <div className="edit-article-modal__auto-save-indicator">
                  {isAutoSaving ? (
                    <span className="edit-article-modal__auto-save-status saving">
                      {texts.autoSaving}
                    </span>
                  ) : lastSaved ? (
                    <span className="edit-article-modal__auto-save-status saved">
                      ✓ {texts.saved}
                    </span>
                  ) : (
                    <span className="edit-article-modal__auto-save-status draft">
                      {texts.draft}
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                className="edit-article-modal__close"
                onClick={onClose}
                aria-label={texts.close}
              >
                ×
              </button>
            </div>

            {/* Страница статьи в стиле фронтенда */}
            <section className="article main-background edit-article-modal__article">
              <div className="wrapper">
                {/* Заголовок статьи - редактируемый */}
                <h2
                  className="edit-article-modal__editable-title"
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) => {
                    const value = e.currentTarget.textContent ?? '';
                    // #region agent log
                    fetch('http://127.0.0.1:7242/ingest/0d98fd1d-24ff-4297-901e-115ee9f70125', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        location: 'EditArticleModal.tsx:545',
                        message: 'Title onBlur',
                        data: { value, oldValue: editingData.nameArticle },
                        timestamp: Date.now(),
                        sessionId: 'debug-session',
                        runId: 'run1',
                        hypothesisId: 'D',
                      }),
                    }).catch(() => {});
                    // #endregion
                    setEditingData((prev) => ({
                      ...prev,
                      nameArticle: value,
                    }));
                    scheduleAutoSave();
                  }}
                >
                  {editingData.nameArticle}
                </h2>

                {/* Блоки контента */}
                {blocks.map((block, index) => (
                  <div key={block.id || index}>
                    {/* Заголовок раздела (h3) - показываем только если есть */}
                    {block.title !== undefined && (
                      <h3
                        className="edit-article-modal__editable-h3"
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) => {
                          const title = e.currentTarget.textContent || '';
                          // #region agent log
                          fetch(
                            'http://127.0.0.1:7242/ingest/0d98fd1d-24ff-4297-901e-115ee9f70125',
                            {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                location: 'EditArticleModal.tsx:718',
                                message: 'H3 title onBlur',
                                data: { index, title, oldTitle: block.title },
                                timestamp: Date.now(),
                                sessionId: 'debug-session',
                                runId: 'run1',
                                hypothesisId: 'D',
                              }),
                            }
                          ).catch(() => {});
                          // #endregion
                          updateBlock(index, { title: title || undefined });
                          scheduleAutoSave();
                        }}
                      >
                        {block.title}
                      </h3>
                    )}

                    {/* Изображение или карусель */}
                    {block.type === 'image' && block.img && (
                      <div className="uncollapse edit-article-modal__image-wrapper">
                        <img
                          src={getUserImageUrl(
                            typeof block.img === 'string' ? block.img : block.img[0],
                            'articles'
                          )}
                          alt={block.alt || ''}
                          loading="lazy"
                          decoding="async"
                          className="edit-article-modal__image"
                        />
                        <div className="edit-article-modal__image-controls">
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            style={{ display: 'none' }}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                handleImageUpload(file, index);
                                e.target.value = '';
                              }
                            }}
                          />
                          <button
                            type="button"
                            className="edit-article-modal__control-button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploadingImageIndex === index}
                          >
                            {uploadingImageIndex === index ? texts.uploading : texts.replace}
                          </button>
                          <button
                            type="button"
                            className="edit-article-modal__control-button"
                            onClick={() => deleteBlock(index)}
                          >
                            {texts.delete}
                          </button>
                        </div>
                      </div>
                    )}

                    {block.type === 'carousel' && Array.isArray(block.img) && (
                      <div className="uncollapse edit-article-modal__carousel-wrapper">
                        {editingCarouselIndex === index ? (
                          <div className="edit-article-modal__carousel-edit">
                            <div className="edit-article-modal__carousel-grid">
                              {block.img.map((img, imgIndex) => (
                                <div key={imgIndex} className="edit-article-modal__carousel-item">
                                  <img
                                    src={getUserImageUrl(img, 'articles')}
                                    alt={block.alt || ''}
                                    className="edit-article-modal__carousel-img"
                                  />
                                  <button
                                    type="button"
                                    className="edit-article-modal__carousel-remove"
                                    onClick={() => removeImageFromCarousel(index, imgIndex)}
                                  >
                                    ×
                                  </button>
                                </div>
                              ))}
                              <div className="edit-article-modal__carousel-add">
                                <input
                                  ref={fileInputRef}
                                  type="file"
                                  accept="image/*"
                                  style={{ display: 'none' }}
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      handleImageUpload(file, index);
                                      e.target.value = '';
                                    }
                                  }}
                                />
                                <button
                                  type="button"
                                  className="edit-article-modal__control-button"
                                  onClick={() => fileInputRef.current?.click()}
                                  disabled={uploadingImageIndex === index}
                                >
                                  {uploadingImageIndex === index ? texts.uploading : texts.addPhoto}
                                </button>
                              </div>
                            </div>
                            <div className="edit-article-modal__carousel-actions">
                              <button
                                type="button"
                                className="edit-article-modal__control-button"
                                onClick={() => setEditingCarouselIndex(null)}
                              >
                                {texts.save}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div style={{ position: 'relative' }}>
                            <ImageCarousel
                              images={block.img}
                              alt={block.alt || ''}
                              category="articles"
                            />
                            <button
                              type="button"
                              className="edit-article-modal__carousel-edit-button"
                              onClick={() => setEditingCarouselIndex(index)}
                            >
                              {texts.editCarousel}
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Подзаголовок (h4) - показываем только если есть непустое значение */}
                    {block.subtitle && block.subtitle.trim() && (
                      <h4
                        className="edit-article-modal__editable-h4"
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) => {
                          const subtitle = e.currentTarget.textContent || '';
                          // #region agent log
                          fetch(
                            'http://127.0.0.1:7242/ingest/0d98fd1d-24ff-4297-901e-115ee9f70125',
                            {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                location: 'EditArticleModal.tsx:857',
                                message: 'H4 subtitle onBlur',
                                data: { index, subtitle, oldSubtitle: block.subtitle },
                                timestamp: Date.now(),
                                sessionId: 'debug-session',
                                runId: 'run1',
                                hypothesisId: 'D',
                              }),
                            }
                          ).catch(() => {});
                          // #endregion
                          updateBlock(index, { subtitle: subtitle.trim() || undefined });
                          scheduleAutoSave();
                        }}
                      >
                        {block.subtitle}
                      </h4>
                    )}

                    {/* Контент - параграф или список */}
                    {(block.content || block.type === 'text') && (
                      <>
                        {typeof block.content === 'string' || !block.content ? (
                          <p
                            className="edit-article-modal__editable-p"
                            contentEditable
                            suppressContentEditableWarning
                            onBlur={(e) => {
                              const pElement = e.currentTarget;
                              const strongElement = pElement.querySelector('strong');

                              // Извлекаем значения ДО вызова updateBlock
                              const strongText = strongElement?.textContent?.trim() || '';
                              const fullText = pElement.textContent || '';

                              // Убираем strong текст из content
                              const contentText = strongText
                                ? fullText.replace(strongText, '').trim()
                                : fullText.trim();

                              // #region agent log
                              fetch(
                                'http://127.0.0.1:7242/ingest/0d98fd1d-24ff-4297-901e-115ee9f70125',
                                {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    location: 'EditArticleModal.tsx:887',
                                    message: 'Paragraph onBlur',
                                    data: {
                                      index,
                                      strongText,
                                      contentText,
                                      oldStrong: block.strong,
                                      oldContent: block.content,
                                    },
                                    timestamp: Date.now(),
                                    sessionId: 'debug-session',
                                    runId: 'run1',
                                    hypothesisId: 'D',
                                  }),
                                }
                              ).catch(() => {});
                              // #endregion
                              updateBlock(index, {
                                strong: strongText || undefined,
                                content: contentText || undefined,
                              });
                              scheduleAutoSave();
                            }}
                          >
                            {block.strong && (
                              <strong
                                className="edit-article-modal__editable-strong"
                                contentEditable
                                suppressContentEditableWarning
                                onBlur={(e) => {
                                  e.stopPropagation();
                                }}
                              >
                                {block.strong}
                              </strong>
                            )}
                            {block.strong && block.content && ' '}
                            {block.content
                              ? block.strong
                                ? block.content.replace(block.strong, '').trim()
                                : block.content
                              : ''}
                          </p>
                        ) : (
                          <ul className="edit-article-modal__editable-ul">
                            {block.content.map((item, i) => (
                              <li
                                key={i}
                                className="edit-article-modal__editable-li"
                                contentEditable
                                suppressContentEditableWarning
                                onBlur={(e) => {
                                  const itemValue = e.currentTarget.textContent ?? '';
                                  // #region agent log
                                  fetch(
                                    'http://127.0.0.1:7242/ingest/0d98fd1d-24ff-4297-901e-115ee9f70125',
                                    {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({
                                        location: 'EditArticleModal.tsx:922',
                                        message: 'List item onBlur',
                                        data: {
                                          index,
                                          itemIndex: i,
                                          itemValue,
                                          oldContent: block.content,
                                        },
                                        timestamp: Date.now(),
                                        sessionId: 'debug-session',
                                        runId: 'run1',
                                        hypothesisId: 'D',
                                      }),
                                    }
                                  ).catch(() => {});
                                  // #endregion
                                  const newContent = [...(block.content as string[])];
                                  newContent[i] = itemValue;
                                  updateBlock(index, { content: newContent });
                                  scheduleAutoSave();
                                }}
                              >
                                {item}
                              </li>
                            ))}
                          </ul>
                        )}
                      </>
                    )}
                  </div>
                ))}

                {/* Кнопки добавления блоков */}
                <div className="edit-article-modal__add-blocks">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        handleImageUpload(file);
                        e.target.value = '';
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="edit-article-modal__control-button"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {texts.addPhoto}
                  </button>
                  <button
                    type="button"
                    className="edit-article-modal__control-button"
                    onClick={addTextBlock}
                  >
                    {texts.addText}
                  </button>
                </div>
              </div>
            </section>

            <div className="edit-article-modal__footer">
              <button
                type="button"
                className="edit-article-modal__button edit-article-modal__button--secondary"
                onClick={onClose}
                disabled={isPublishing}
              >
                {texts.cancel}
              </button>
              <button
                type="button"
                className="edit-article-modal__button edit-article-modal__button--primary"
                onClick={handlePublish}
                disabled={isPublishing || isAutoSaving}
              >
                {isPublishing ? texts.publishing : texts.publish}
              </button>
            </div>
          </div>
        </div>
      </Popup>

      {alertModal && (
        <AlertModal
          isOpen={alertModal.isOpen}
          title={alertModal.title}
          message={alertModal.message}
          variant={alertModal.variant}
          onClose={() => setAlertModal(null)}
        />
      )}
    </>
  );
}
