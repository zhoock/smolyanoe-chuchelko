// src/pages/UserDashboard/components/EditArticleModalV2.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Popup } from '@shared/ui/popup';
import { useAppDispatch } from '@shared/lib/hooks/useAppDispatch';
import { useLang } from '@app/providers/lang';
import { getToken } from '@shared/lib/auth';
import { fetchArticles } from '@entities/article';
import type { IArticles } from '@models';
import type { Block, ArticleMeta, BlockType } from './EditArticleModalV2.utils';
import {
  normalizeDetailsToBlocks,
  blocksToDetails,
  generateId,
  debounce,
} from './EditArticleModalV2.utils';
import { SortableBlock } from './blocks/SortableBlock';
import { SlashMenu } from './blocks/SlashMenu';
import './EditArticleModalV2.style.scss';

interface EditArticleModalV2Props {
  isOpen: boolean;
  article: IArticles;
  onClose: () => void;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

const LANG_TEXTS = {
  ru: {
    editArticle: 'Редактирование статьи',
    title: 'Название статьи',
    description: 'Описание',
    cancel: 'Отмена',
    publish: 'Опубликовать',
    publishing: 'Публикация...',
    saving: 'Сохраняем...',
    saved: 'Сохранено ✓',
    draft: 'Черновик',
    error: 'Ошибка',
    articleNotFound: 'Статья не найдена',
    articleSaved: 'Статья успешно сохранена',
    articlePublished: 'Статья успешно опубликована',
    savingError: 'Ошибка при сохранении',
    addBlock: 'Добавить блок',
  },
  en: {
    editArticle: 'Edit Article',
    title: 'Article Title',
    description: 'Description',
    cancel: 'Cancel',
    publish: 'Publish',
    publishing: 'Publishing...',
    saving: 'Saving...',
    saved: 'Saved ✓',
    draft: 'Draft',
    error: 'Error',
    articleNotFound: 'Article not found',
    articleSaved: 'Article saved successfully',
    articlePublished: 'Article published successfully',
    savingError: 'Error saving article',
    addBlock: 'Add Block',
  },
};

export function EditArticleModalV2({ isOpen, article, onClose }: EditArticleModalV2Props) {
  const { lang } = useLang();
  const dispatch = useAppDispatch();
  const texts = LANG_TEXTS[lang];

  // Состояние редактора
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [meta, setMeta] = useState<ArticleMeta>({ title: '', description: '' });
  const [focusBlockId, setFocusBlockId] = useState<string | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);

  // История для Undo/Redo
  type EditorSnapshot = {
    blocks: Block[];
    meta: ArticleMeta;
    focusBlockId: string | null;
    selectedBlockId: string | null;
  };
  const [undoStack, setUndoStack] = useState<EditorSnapshot[]>([]);
  const [redoStack, setRedoStack] = useState<EditorSnapshot[]>([]);
  const textChangeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [slashMenu, setSlashMenu] = useState<{
    blockId: string;
    position: { top: number; left: number };
    cursorPos: number;
  } | null>(null);
  const [slashMenuSelectedIndex, setSlashMenuSelectedIndex] = useState(0);
  // VK-стиль инсертера: показывается только после Enter в конце блока
  const [vkInserter, setVkInserter] = useState<{ afterBlockId: string } | null>(null);

  // Обработка Escape для скрытия VK-плюса
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && vkInserter) {
        setVkInserter(null);
      }
    };

    if (vkInserter) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [vkInserter]);

  // Sensors для drag-and-drop
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Состояние сохранения
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [originalIsDraft, setOriginalIsDraft] = useState<boolean>(true);

  // Refs для управления автосохранением
  const isMountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [currentArticle, setCurrentArticle] = useState<IArticles | null>(null);

  // Очистка таймера текстовых изменений при размонтировании
  useEffect(() => {
    return () => {
      if (textChangeTimeoutRef.current) {
        clearTimeout(textChangeTimeoutRef.current);
      }
    };
  }, []);

  // Загрузка статьи при открытии
  useEffect(() => {
    if (!isOpen) return;

    const loadArticle = async () => {
      try {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/0d98fd1d-24ff-4297-901e-115ee9f70125', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            location: 'EditArticleModalV2.tsx:120',
            message: 'loadArticle started',
            data: { isOpen, articleId: article.articleId, lang },
            timestamp: Date.now(),
            sessionId: 'debug-session',
            runId: 'run1',
            hypothesisId: 'A',
          }),
        }).catch(() => {});
        // #endregion

        const token = getToken();
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/0d98fd1d-24ff-4297-901e-115ee9f70125', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            location: 'EditArticleModalV2.tsx:123',
            message: 'Token check',
            data: { hasToken: !!token, tokenLength: token?.length || 0 },
            timestamp: Date.now(),
            sessionId: 'debug-session',
            runId: 'run1',
            hypothesisId: 'A',
          }),
        }).catch(() => {});
        // #endregion
        if (!token) return;

        const fetchUrl = `/api/articles-api?lang=${lang}&includeDrafts=true`;
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/0d98fd1d-24ff-4297-901e-115ee9f70125', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            location: 'EditArticleModalV2.tsx:126',
            message: 'Before fetch',
            data: { fetchUrl, hasToken: !!token },
            timestamp: Date.now(),
            sessionId: 'debug-session',
            runId: 'run1',
            hypothesisId: 'B',
          }),
        }).catch(() => {});
        // #endregion

        const response = await fetch(fetchUrl, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/0d98fd1d-24ff-4297-901e-115ee9f70125', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            location: 'EditArticleModalV2.tsx:132',
            message: 'After fetch',
            data: { status: response.status, statusText: response.statusText, ok: response.ok },
            timestamp: Date.now(),
            sessionId: 'debug-session',
            runId: 'run1',
            hypothesisId: 'B',
          }),
        }).catch(() => {});
        // #endregion

        if (response.ok) {
          const data = await response.json();
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/0d98fd1d-24ff-4297-901e-115ee9f70125', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              location: 'EditArticleModalV2.tsx:135',
              message: 'API response parsed',
              data: {
                isArray: Array.isArray(data),
                hasData: !!data.data,
                hasArticles: !!data.articles,
                dataLength: Array.isArray(data)
                  ? data.length
                  : data.data?.length || data.articles?.length || 0,
              },
              timestamp: Date.now(),
              sessionId: 'debug-session',
              runId: 'run1',
              hypothesisId: 'C',
            }),
          }).catch(() => {});
          // #endregion

          const articlesList = Array.isArray(data) ? data : (data.data ?? data.articles ?? []);
          const articleForEdit = articlesList.find(
            (a: IArticles) => a.articleId === article.articleId
          );

          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/0d98fd1d-24ff-4297-901e-115ee9f70125', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              location: 'EditArticleModalV2.tsx:139',
              message: 'Article search',
              data: {
                articlesListLength: articlesList.length,
                searchingFor: article.articleId,
                found: !!articleForEdit,
                articleDetails: articleForEdit
                  ? {
                      hasDetails: !!articleForEdit.details,
                      detailsType: typeof articleForEdit.details,
                    }
                  : null,
              },
              timestamp: Date.now(),
              sessionId: 'debug-session',
              runId: 'run1',
              hypothesisId: 'D',
            }),
          }).catch(() => {});
          // #endregion

          if (articleForEdit) {
            setCurrentArticle(articleForEdit);
            setOriginalIsDraft(articleForEdit.isDraft ?? true);

            // Парсим details, если это строка (JSONB из базы может приходить как строка)
            let parsedDetails = articleForEdit.details;
            if (typeof articleForEdit.details === 'string') {
              try {
                parsedDetails = JSON.parse(articleForEdit.details);
              } catch (e) {
                parsedDetails = [];
              }
            }

            // Убеждаемся, что details - это массив
            if (!Array.isArray(parsedDetails)) {
              parsedDetails = [];
            }

            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/0d98fd1d-24ff-4297-901e-115ee9f70125', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                location: 'EditArticleModalV2.tsx:158',
                message: 'Before normalizeDetailsToBlocks',
                data: {
                  parsedDetailsLength: parsedDetails.length,
                  parsedDetailsType: typeof parsedDetails,
                  isArray: Array.isArray(parsedDetails),
                  firstDetail: parsedDetails[0] || null,
                },
                timestamp: Date.now(),
                sessionId: 'debug-session',
                runId: 'run1',
                hypothesisId: 'E',
              }),
            }).catch(() => {});
            // #endregion

            // Инициализируем блоки и мета
            const loadedBlocks = normalizeDetailsToBlocks(parsedDetails);

            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/0d98fd1d-24ff-4297-901e-115ee9f70125', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                location: 'EditArticleModalV2.tsx:160',
                message: 'After normalizeDetailsToBlocks',
                data: {
                  blocksCount: loadedBlocks.length,
                  blocksTypes: loadedBlocks.map((b) => b.type),
                  firstBlock: loadedBlocks[0] || null,
                },
                timestamp: Date.now(),
                sessionId: 'debug-session',
                runId: 'run1',
                hypothesisId: 'E',
              }),
            }).catch(() => {});
            // #endregion

            setBlocks(loadedBlocks);

            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/0d98fd1d-24ff-4297-901e-115ee9f70125', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                location: 'EditArticleModalV2.tsx:161',
                message: 'setBlocks called',
                data: { blocksCount: loadedBlocks.length },
                timestamp: Date.now(),
                sessionId: 'debug-session',
                runId: 'run1',
                hypothesisId: 'F',
              }),
            }).catch(() => {});
            // #endregion

            setMeta({
              title: articleForEdit.nameArticle || '',
              description: articleForEdit.description || '',
            });
          }
        } else {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/0d98fd1d-24ff-4297-901e-115ee9f70125', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              location: 'EditArticleModalV2.tsx:167',
              message: 'Response not OK',
              data: { status: response.status, statusText: response.statusText },
              timestamp: Date.now(),
              sessionId: 'debug-session',
              runId: 'run1',
              hypothesisId: 'B',
            }),
          }).catch(() => {});
          // #endregion
        }
      } catch (error) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/0d98fd1d-24ff-4297-901e-115ee9f70125', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            location: 'EditArticleModalV2.tsx:169',
            message: 'Error in loadArticle',
            data: { error: error instanceof Error ? error.message : String(error) },
            timestamp: Date.now(),
            sessionId: 'debug-session',
            runId: 'run1',
            hypothesisId: 'A',
          }),
        }).catch(() => {});
        // #endregion
        console.error('Error loading article:', error);
      }
    };

    loadArticle();
  }, [isOpen, article.articleId, lang]);

  // Очистка при закрытии
  useEffect(() => {
    isMountedRef.current = isOpen;
    if (!isOpen) {
      // Отменяем автосохранение
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
        autoSaveTimeoutRef.current = null;
      }
      // Отменяем запросы
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    }
    return () => {
      isMountedRef.current = false;
    };
  }, [isOpen]);

  // Автосохранение
  const autoSave = useCallback(async () => {
    if (!isMountedRef.current || !isOpen || !currentArticle?.id) return;

    // Отменяем предыдущий запрос
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setSaveStatus('saving');

    try {
      const token = getToken();
      if (!token) return;

      const details = blocksToDetails(blocks);
      const shouldBeDraft = originalIsDraft ?? true;

      const requestBody = {
        articleId: currentArticle.articleId,
        nameArticle: meta.title,
        description: meta.description,
        img: currentArticle.img || article.img,
        date: currentArticle.date || article.date,
        details: details,
        lang: lang,
        isDraft: shouldBeDraft,
      };

      const response = await fetch(
        `/api/articles-api?id=${encodeURIComponent(currentArticle.id)}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(requestBody),
          signal: abortControllerRef.current.signal,
        }
      );

      if (response.ok) {
        setSaveStatus('saved');
        setLastSaved(new Date());
        // Обновляем Redux store
        try {
          await dispatch(fetchArticles({ lang, force: true })).unwrap();
        } catch (error) {
          console.warn('Failed to update Redux store:', error);
        }
      } else {
        setSaveStatus('error');
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Auto-save error:', error);
        setSaveStatus('error');
      }
    } finally {
      if (isMountedRef.current) {
        // Сбрасываем статус через 2 секунды
        setTimeout(() => {
          if (isMountedRef.current && saveStatus === 'saved') {
            setSaveStatus('idle');
          }
        }, 2000);
      }
    }
  }, [blocks, meta, currentArticle, originalIsDraft, lang, dispatch, isOpen, article, saveStatus]);

  // Debounced автосохранение
  const debouncedAutoSave = useRef(
    debounce(() => {
      autoSave();
    }, 1500)
  ).current;

  // Планирование автосохранения
  useEffect(() => {
    if (!isOpen || !currentArticle?.id) return;

    debouncedAutoSave();

    return () => {
      // Очистка при размонтировании
    };
  }, [blocks, meta, isOpen, currentArticle?.id, debouncedAutoSave]);

  // Публикация
  const handlePublish = useCallback(async () => {
    if (!currentArticle?.id) return;

    setIsPublishing(true);
    setSaveStatus('saving');

    try {
      const token = getToken();
      if (!token) return;

      // Принудительное сохранение перед публикацией
      const details = blocksToDetails(blocks);

      const requestBody = {
        articleId: currentArticle.articleId,
        nameArticle: meta.title,
        description: meta.description,
        img: currentArticle.img || article.img,
        date: currentArticle.date || article.date,
        details: details,
        lang: lang,
        isDraft: false, // Публикуем
      };

      const response = await fetch(
        `/api/articles-api?id=${encodeURIComponent(currentArticle.id)}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(requestBody),
        }
      );

      if (response.ok) {
        setSaveStatus('saved');
        // Обновляем Redux store
        await dispatch(fetchArticles({ lang, force: true })).unwrap();
        onClose();
      } else {
        setSaveStatus('error');
      }
    } catch (error) {
      console.error('Publish error:', error);
      setSaveStatus('error');
    } finally {
      setIsPublishing(false);
    }
  }, [blocks, meta, currentArticle, lang, dispatch, onClose, article]);

  // Создание нового блока по типу
  const createBlock = useCallback((type: BlockType): Block => {
    switch (type) {
      case 'paragraph':
        return { id: generateId(), type: 'paragraph', text: '' };
      case 'title':
        return { id: generateId(), type: 'title', text: '' };
      case 'subtitle':
        return { id: generateId(), type: 'subtitle', text: '' };
      case 'quote':
        return { id: generateId(), type: 'quote', text: '' };
      case 'list':
        return { id: generateId(), type: 'list', items: [''] };
      case 'divider':
        return { id: generateId(), type: 'divider' };
      case 'image':
        return { id: generateId(), type: 'image', imageKey: '' };
      case 'carousel':
        return { id: generateId(), type: 'carousel', imageKeys: [] };
    }
  }, []);

  // Функции для работы с историей Undo/Redo
  const saveSnapshot = useCallback(() => {
    const snapshot: EditorSnapshot = {
      blocks: JSON.parse(JSON.stringify(blocks)), // Deep clone
      meta: { ...meta },
      focusBlockId,
      selectedBlockId,
    };
    setUndoStack((prev) => [...prev, snapshot].slice(-50)); // Ограничиваем историю 50 шагами
    setRedoStack([]); // Очищаем redo при новом действии
  }, [blocks, meta, focusBlockId, selectedBlockId]);

  const restoreSnapshot = useCallback((snapshot: EditorSnapshot) => {
    setBlocks(JSON.parse(JSON.stringify(snapshot.blocks))); // Deep clone
    setMeta({ ...snapshot.meta });
    setFocusBlockId(snapshot.focusBlockId);
    setSelectedBlockId(snapshot.selectedBlockId);
  }, []);

  const undo = useCallback(() => {
    if (undoStack.length === 0) return;

    const currentSnapshot: EditorSnapshot = {
      blocks: JSON.parse(JSON.stringify(blocks)),
      meta: { ...meta },
      focusBlockId,
      selectedBlockId,
    };
    setRedoStack((prev) => [currentSnapshot, ...prev]);

    const previousSnapshot = undoStack[undoStack.length - 1];
    restoreSnapshot(previousSnapshot);
    setUndoStack((prev) => prev.slice(0, -1));
  }, [undoStack, blocks, meta, focusBlockId, selectedBlockId, restoreSnapshot]);

  const redo = useCallback(() => {
    if (redoStack.length === 0) return;

    const currentSnapshot: EditorSnapshot = {
      blocks: JSON.parse(JSON.stringify(blocks)),
      meta: { ...meta },
      focusBlockId,
      selectedBlockId,
    };
    setUndoStack((prev) => [...prev, currentSnapshot]);

    const nextSnapshot = redoStack[0];
    restoreSnapshot(nextSnapshot);
    setRedoStack((prev) => prev.slice(1));
  }, [redoStack, blocks, meta, focusBlockId, selectedBlockId, restoreSnapshot]);

  // Управление блоками
  const insertBlock = useCallback(
    (index: number, type: BlockType) => {
      // Сохраняем снимок перед вставкой
      saveSnapshot();

      const newBlock = createBlock(type);

      setBlocks((prev) => {
        const newBlocks = [...prev];
        newBlocks.splice(index, 0, newBlock);
        return newBlocks;
      });

      // Фокус на новый блок
      setTimeout(() => {
        setFocusBlockId(newBlock.id);
      }, 0);
    },
    [createBlock, saveSnapshot]
  );

  const deleteBlock = useCallback(
    (blockId: string) => {
      // Сохраняем снимок перед удалением
      saveSnapshot();

      setBlocks((prev) => {
        const filtered = prev.filter((b) => b.id !== blockId);
        // Если блоков не осталось, создаем пустой paragraph
        return filtered.length > 0 ? filtered : [{ id: generateId(), type: 'paragraph', text: '' }];
      });
    },
    [saveSnapshot]
  );

  // Конвертация image в carousel
  const convertImageToCarousel = useCallback(
    (blockId: string) => {
      // Сохраняем снимок перед конвертацией
      saveSnapshot();

      setBlocks((prev) =>
        prev.map((block) => {
          if (block.id === blockId && block.type === 'image') {
            return {
              id: block.id,
              type: 'carousel',
              imageKeys: block.imageKey ? [block.imageKey] : [],
              caption: block.caption,
            } as Block;
          }
          return block;
        })
      );
      setSelectedBlockId(null);
    },
    [saveSnapshot]
  );

  // Обработка Delete/Backspace для удаления выделенного блока (image/carousel) и Undo/Redo
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Обработка Undo/Redo (Cmd+Z / Cmd+Shift+Z / Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y)
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const metaKey = isMac ? event.metaKey : event.ctrlKey;
      const key = event.key.toLowerCase();

      // Проверяем Undo/Redo до проверки фокуса в текстовом поле
      if (metaKey && key === 'z') {
        if (event.shiftKey) {
          // Redo: Cmd+Shift+Z (Mac) или Ctrl+Shift+Z (Windows)
          event.preventDefault();
          event.stopPropagation();
          redo();
          return;
        } else {
          // Undo: Cmd+Z (Mac) или Ctrl+Z (Windows)
          event.preventDefault();
          event.stopPropagation();
          undo();
          return;
        }
      }

      // Redo через Ctrl+Y (Windows)
      if (!isMac && event.ctrlKey && key === 'y') {
        event.preventDefault();
        event.stopPropagation();
        redo();
        return;
      }

      // Проверяем, что фокус не в текстовом поле (textarea/input)
      const activeElement = document.activeElement;
      if (
        activeElement &&
        (activeElement.tagName === 'TEXTAREA' ||
          activeElement.tagName === 'INPUT' ||
          (activeElement as HTMLElement).isContentEditable)
      ) {
        return; // Стандартное поведение для текстовых полей
      }

      if (selectedBlockId && (event.key === 'Delete' || event.key === 'Backspace')) {
        const selectedBlock = blocks.find((b) => b.id === selectedBlockId);
        if (
          selectedBlock &&
          (selectedBlock.type === 'image' || selectedBlock.type === 'carousel')
        ) {
          event.preventDefault();
          const blockIndex = blocks.findIndex((b) => b.id === selectedBlockId);
          deleteBlock(selectedBlockId);
          setSelectedBlockId(null);
          // Фокус на предыдущий блок, если есть
          if (blockIndex > 0) {
            setTimeout(() => {
              setFocusBlockId(blocks[blockIndex - 1].id);
            }, 0);
          }
        }
      }
    };

    // Используем capture phase для перехвата события до других обработчиков
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [selectedBlockId, blocks, deleteBlock, undo, redo]);

  // Снятие выделения при клике вне блока
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      // Проверяем, что клик не на блоке изображения или его дочерних элементах
      if (
        selectedBlockId &&
        !target.closest('.edit-article-v2__block--image') &&
        !target.closest('.edit-article-v2__block-wrapper--selected')
      ) {
        setSelectedBlockId(null);
      }
    };

    if (selectedBlockId) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [selectedBlockId]);

  const updateBlock = useCallback(
    (blockId: string, updates: Partial<Block>, shouldSaveHistory = false) => {
      // Если это текстовое изменение, группируем через debounce
      const isTextChange = 'text' in updates || 'items' in updates || 'caption' in updates;

      if (isTextChange && !shouldSaveHistory) {
        // Отменяем предыдущий таймер
        if (textChangeTimeoutRef.current) {
          clearTimeout(textChangeTimeoutRef.current);
        }

        // Сохраняем снимок через 500ms после последнего изменения
        textChangeTimeoutRef.current = setTimeout(() => {
          saveSnapshot();
        }, 500);
      } else if (shouldSaveHistory) {
        // Для не-текстовых изменений (например, изменение caption) сохраняем сразу
        saveSnapshot();
      }

      setBlocks((prev) =>
        prev.map((block) => {
          if (block.id !== blockId) return block;
          // Type-safe merge
          const updatedBlock = { ...block, ...updates } as Block;

          // Если пользователь начал печатать в блоке с VK-плюсом, скрываем плюс
          if (vkInserter?.afterBlockId === blockId) {
            // Проверяем, что блок больше не пустой (для текстовых блоков)
            if (
              (updatedBlock.type === 'paragraph' ||
                updatedBlock.type === 'title' ||
                updatedBlock.type === 'subtitle' ||
                updatedBlock.type === 'quote') &&
              updatedBlock.text.trim() !== ''
            ) {
              setVkInserter(null);
            }
            // Для списка проверяем, что есть непустые элементы
            if (
              updatedBlock.type === 'list' &&
              updatedBlock.items.some((item) => item.trim() !== '')
            ) {
              setVkInserter(null);
            }
          }

          return updatedBlock;
        })
      );
    },
    [vkInserter, saveSnapshot]
  );

  // Обработчики для блоков
  const handleBlockEnter = useCallback(
    (blockId: string, atEnd: boolean) => {
      const blockIndex = blocks.findIndex((b) => b.id === blockId);
      if (blockIndex === -1) return;

      const block = blocks[blockIndex];

      if (atEnd) {
        // Сохраняем снимок перед созданием нового блока
        saveSnapshot();

        // Вставляем новый paragraph после текущего блока
        const newBlock = createBlock('paragraph');
        setBlocks((prev) => {
          const newBlocks = [...prev];
          newBlocks.splice(blockIndex + 1, 0, newBlock);
          return newBlocks;
        });

        // Показываем VK-плюс у нового блока
        setVkInserter({ afterBlockId: newBlock.id });

        // Фокус на новый блок
        setTimeout(() => {
          setFocusBlockId(newBlock.id);
        }, 0);
      } else {
        // Разрезаем блок на два (только для текстовых блоков)
        if (
          block.type === 'paragraph' ||
          block.type === 'title' ||
          block.type === 'subtitle' ||
          block.type === 'quote'
        ) {
          // Сохраняем снимок перед разрезанием
          saveSnapshot();

          const textarea = document.activeElement as HTMLTextAreaElement;
          if (textarea) {
            const cursorPos = textarea.selectionStart;
            const text = block.type === 'paragraph' ? block.text : block.text;
            const beforeText = text.substring(0, cursorPos);
            const afterText = text.substring(cursorPos);

            // Обновляем текущий блок
            updateBlock(blockId, { text: beforeText } as Partial<Block>, true);

            // Вставляем новый блок после
            const newBlock: Block =
              block.type === 'paragraph'
                ? { id: generateId(), type: 'paragraph', text: afterText }
                : block.type === 'title'
                  ? { id: generateId(), type: 'title', text: afterText }
                  : block.type === 'subtitle'
                    ? { id: generateId(), type: 'subtitle', text: afterText }
                    : { id: generateId(), type: 'quote', text: afterText };

            setBlocks((prev) => {
              const newBlocks = [...prev];
              newBlocks.splice(blockIndex + 1, 0, newBlock);
              return newBlocks;
            });

            // Фокус на новый блок
            setTimeout(() => {
              setFocusBlockId(newBlock.id);
            }, 0);
          }
        }
      }
    },
    [blocks, createBlock, updateBlock, saveSnapshot]
  );

  const handleBlockBackspace = useCallback(
    (blockId: string, isEmpty: boolean, atStart: boolean = false) => {
      const blockIndex = blocks.findIndex((b) => b.id === blockId);
      if (blockIndex === -1) return;

      const currentBlock = blocks[blockIndex];

      // Если блок пустой
      if (isEmpty) {
        // Не удаляем, если это единственный paragraph
        if (blocks.length === 1 && currentBlock.type === 'paragraph') {
          return;
        }

        deleteBlock(blockId);

        // Фокус на предыдущий блок
        if (blockIndex > 0) {
          setTimeout(() => {
            setFocusBlockId(blocks[blockIndex - 1].id);
          }, 0);
        }
        return;
      }

      // Если курсор в начале блока и есть предыдущий блок
      if (atStart && blockIndex > 0) {
        const prevBlock = blocks[blockIndex - 1];

        // Сливаем только совместимые текстовые блоки
        if (
          (currentBlock.type === 'paragraph' ||
            currentBlock.type === 'title' ||
            currentBlock.type === 'subtitle' ||
            currentBlock.type === 'quote') &&
          (prevBlock.type === 'paragraph' ||
            prevBlock.type === 'title' ||
            prevBlock.type === 'subtitle' ||
            prevBlock.type === 'quote')
        ) {
          const mergedText = prevBlock.text + currentBlock.text;
          const mergedType = prevBlock.type; // Сохраняем тип предыдущего блока

          // Обновляем предыдущий блок
          updateBlock(prevBlock.id, { text: mergedText } as Partial<Block>);

          // Удаляем текущий блок
          deleteBlock(blockId);

          // Фокус на объединённый блок
          setTimeout(() => {
            setFocusBlockId(prevBlock.id);
            // Устанавливаем курсор в место слияния
            const textarea = document.querySelector(
              `[data-block-id="${prevBlock.id}"] textarea`
            ) as HTMLTextAreaElement;
            if (textarea) {
              textarea.focus();
              textarea.setSelectionRange(prevBlock.text.length, prevBlock.text.length);
            }
          }, 0);
        }
      }
    },
    [blocks, deleteBlock, updateBlock]
  );

  // Drag-and-drop handlers
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      if (over && active.id !== over.id) {
        // Сохраняем снимок перед перетаскиванием
        saveSnapshot();

        setBlocks((items) => {
          const oldIndex = items.findIndex((item) => item.id === active.id);
          const newIndex = items.findIndex((item) => item.id === over.id);

          const newBlocks = arrayMove(items, oldIndex, newIndex);
          return newBlocks;
        });

        // Фокус на перетащенный блок
        setTimeout(() => {
          setFocusBlockId(active.id as string);
        }, 0);
      }
    },
    [saveSnapshot]
  );

  // Дублирование блока
  const duplicateBlock = useCallback(
    (blockId: string) => {
      // Сохраняем снимок перед дублированием
      saveSnapshot();

      const blockIndex = blocks.findIndex((b) => b.id === blockId);
      if (blockIndex === -1) return;

      const block = blocks[blockIndex];
      const duplicatedBlock = { ...block, id: generateId() };

      setBlocks((prev) => {
        const newBlocks = [...prev];
        newBlocks.splice(blockIndex + 1, 0, duplicatedBlock);
        return newBlocks;
      });

      setTimeout(() => {
        setFocusBlockId(duplicatedBlock.id);
      }, 0);
    },
    [blocks, saveSnapshot]
  );

  // Перемещение блока вверх/вниз
  const moveBlockUp = useCallback(
    (blockId: string) => {
      // Сохраняем снимок перед перемещением
      saveSnapshot();

      const blockIndex = blocks.findIndex((b) => b.id === blockId);
      if (blockIndex <= 0) return;

      setBlocks((prev) => {
        const newBlocks = [...prev];
        [newBlocks[blockIndex - 1], newBlocks[blockIndex]] = [
          newBlocks[blockIndex],
          newBlocks[blockIndex - 1],
        ];
        return newBlocks;
      });
    },
    [blocks, saveSnapshot]
  );

  const moveBlockDown = useCallback(
    (blockId: string) => {
      // Сохраняем снимок перед перемещением
      saveSnapshot();

      const blockIndex = blocks.findIndex((b) => b.id === blockId);
      if (blockIndex === -1 || blockIndex >= blocks.length - 1) return;

      setBlocks((prev) => {
        const newBlocks = [...prev];
        [newBlocks[blockIndex], newBlocks[blockIndex + 1]] = [
          newBlocks[blockIndex + 1],
          newBlocks[blockIndex],
        ];
        return newBlocks;
      });
    },
    [blocks, saveSnapshot]
  );

  // Вставка блока после указанного
  const insertBlockAfter = useCallback(
    (blockId: string, type: string) => {
      const blockIndex = blocks.findIndex((b) => b.id === blockId);
      if (blockIndex === -1) return;

      insertBlock(blockIndex + 1, type as BlockType);
    },
    [blocks, insertBlock]
  );

  // Обработчик slash-меню
  const handleSlash = useCallback(
    (blockId: string, position: { top: number; left: number }, cursorPos: number) => {
      setSlashMenu({ blockId, position, cursorPos });
      setSlashMenuSelectedIndex(0);
    },
    []
  );

  // Навигация в slash-меню
  useEffect(() => {
    if (!slashMenu) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSlashMenuSelectedIndex((prev) => Math.min(prev + 1, 7));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSlashMenuSelectedIndex((prev) => Math.max(prev - 1, 0));
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [slashMenu]);

  // Обработчик выбора из slash-меню
  const handleSlashSelect = useCallback(
    (type: string) => {
      if (!slashMenu) return;

      const block = blocks.find((b) => b.id === slashMenu.blockId);
      if (
        !block ||
        (block.type !== 'paragraph' &&
          block.type !== 'title' &&
          block.type !== 'subtitle' &&
          block.type !== 'quote')
      ) {
        setSlashMenu(null);
        return;
      }

      // Удаляем "/" из текста
      const textBefore = block.text.substring(0, slashMenu.cursorPos - 1);
      const textAfter = block.text.substring(slashMenu.cursorPos);
      const newText = textBefore + textAfter;

      // Преобразуем текущий блок в выбранный тип
      if (type === block.type) {
        // Если тип совпадает, просто удаляем "/"
        updateBlock(slashMenu.blockId, { text: newText } as Partial<Block>);
      } else {
        // Преобразуем блок в новый тип
        const newBlock = createBlock(type as BlockType);
        if (
          newBlock.type === 'paragraph' ||
          newBlock.type === 'title' ||
          newBlock.type === 'subtitle' ||
          newBlock.type === 'quote'
        ) {
          (newBlock as any).text = newText;
        }

        const blockIndex = blocks.findIndex((b) => b.id === slashMenu.blockId);
        setBlocks((prev) => {
          const newBlocks = [...prev];
          newBlocks[blockIndex] = newBlock;
          return newBlocks;
        });

        setTimeout(() => {
          setFocusBlockId(newBlock.id);
        }, 0);
      }

      setSlashMenu(null);
    },
    [slashMenu, blocks, updateBlock, createBlock]
  );

  // Обработчик paste
  const handlePaste = useCallback(
    async (blockId: string, text: string, files: File[]) => {
      const block = blocks.find((b) => b.id === blockId);
      if (!block) return;

      const blockIndex = blocks.findIndex((b) => b.id === blockId);

      // Если есть изображения, создаем Image-блоки для каждого
      if (files.length > 0) {
        const { uploadFile } = await import('@shared/api/storage');
        const { CURRENT_USER_CONFIG } = await import('@config/user');

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
            const newBlock: Block = {
              id: generateId(),
              type: 'image',
              imageKey,
            };

            setBlocks((prev) => {
              const newBlocks = [...prev];
              newBlocks.splice(blockIndex + 1 + i, 0, newBlock);
              return newBlocks;
            });
          }
        }

        // Если был текст вместе с изображениями, вставляем его в текущий блок
        if (
          text.trim() &&
          (block.type === 'paragraph' ||
            block.type === 'title' ||
            block.type === 'subtitle' ||
            block.type === 'quote')
        ) {
          const textarea = document.activeElement as HTMLTextAreaElement;
          if (textarea) {
            const cursorPos = textarea.selectionStart;
            const newText =
              block.text.substring(0, cursorPos) +
              text +
              block.text.substring(textarea.selectionEnd);
            updateBlock(blockId, { text: newText } as Partial<Block>);
          }
        }
      } else if (text) {
        // Многострочный текст - проверяем, нужно ли преобразовать в список
        const lines = text.split('\n').filter((line) => line.trim());
        if (lines.length > 2) {
          // Создаем list-блок
          const newBlock: Block = {
            id: generateId(),
            type: 'list',
            items: lines,
          };

          setBlocks((prev) => {
            const newBlocks = [...prev];
            newBlocks.splice(blockIndex + 1, 0, newBlock);
            return newBlocks;
          });

          setTimeout(() => {
            setFocusBlockId(newBlock.id);
          }, 0);
        } else {
          // Обычный текст - вставляем в текущий блок
          if (
            block.type === 'paragraph' ||
            block.type === 'title' ||
            block.type === 'subtitle' ||
            block.type === 'quote'
          ) {
            const textarea = document.activeElement as HTMLTextAreaElement;
            if (textarea) {
              const cursorPos = textarea.selectionStart;
              const newText =
                block.text.substring(0, cursorPos) +
                text +
                block.text.substring(textarea.selectionEnd);
              updateBlock(blockId, { text: newText } as Partial<Block>);

              // Устанавливаем курсор после вставленного текста
              setTimeout(() => {
                textarea.focus();
                const newCursorPos = cursorPos + text.length;
                textarea.setSelectionRange(newCursorPos, newCursorPos);
              }, 0);
            }
          }
        }
      }
    },
    [blocks, updateBlock]
  );

  // Обработчик форматирования
  const handleFormat = useCallback(
    (blockId: string, type: 'bold' | 'italic' | 'link') => {
      const block = blocks.find((b) => b.id === blockId);
      if (
        !block ||
        (block.type !== 'paragraph' &&
          block.type !== 'title' &&
          block.type !== 'subtitle' &&
          block.type !== 'quote')
      ) {
        return;
      }

      const textarea = document.activeElement as HTMLTextAreaElement;
      if (!textarea) return;

      const selectionStart = textarea.selectionStart;
      const selectionEnd = textarea.selectionEnd;

      if (selectionStart === selectionEnd) {
        // Нет выделения - вставляем шаблон
        let template = '';
        let cursorOffset = 0;

        if (type === 'bold') {
          template = '**текст**';
          cursorOffset = 2;
        } else if (type === 'italic') {
          template = '_текст_';
          cursorOffset = 1;
        } else if (type === 'link') {
          template = '[текст](url)';
          cursorOffset = 1;
        }

        const newText =
          block.text.substring(0, selectionStart) + template + block.text.substring(selectionEnd);

        updateBlock(blockId, { text: newText } as Partial<Block>);

        // Устанавливаем курсор внутрь шаблона
        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(
            selectionStart + cursorOffset,
            selectionStart + cursorOffset + 6
          );
        }, 0);
      } else {
        // Есть выделение - оборачиваем в markdown
        const selectedText = block.text.substring(selectionStart, selectionEnd);
        let wrappedText = '';

        if (type === 'bold') {
          wrappedText = `**${selectedText}**`;
        } else if (type === 'italic') {
          wrappedText = `_${selectedText}_`;
        } else if (type === 'link') {
          wrappedText = `[${selectedText}](url)`;
        }

        const newText =
          block.text.substring(0, selectionStart) +
          wrappedText +
          block.text.substring(selectionEnd);

        updateBlock(blockId, { text: newText } as Partial<Block>);

        // Устанавливаем курсор после обёрнутого текста
        setTimeout(() => {
          textarea.focus();
          const newCursorPos = selectionStart + wrappedText.length;
          textarea.setSelectionRange(newCursorPos, newCursorPos);
        }, 0);
      }
    },
    [blocks, updateBlock]
  );

  // Статус сохранения
  const getStatusText = () => {
    switch (saveStatus) {
      case 'saving':
        return texts.saving;
      case 'saved':
        return texts.saved;
      case 'error':
        return texts.error;
      default:
        return originalIsDraft ? texts.draft : '';
    }
  };

  // Компонент VK-стиля плюса (показывается только после Enter в конце блока)
  const VkPlusInserter = ({
    onSelect,
    onClose,
  }: {
    onSelect: (type: string) => void;
    onClose: () => void;
  }) => {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
          setIsOpen(false);
          onClose();
        }
      };

      const handleEscape = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          setIsOpen(false);
          onClose();
        }
      };

      if (isOpen) {
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEscape);
        return () => {
          document.removeEventListener('mousedown', handleClickOutside);
          document.removeEventListener('keydown', handleEscape);
        };
      }
    }, [isOpen, onClose]);

    const blockTypes = [
      { type: 'paragraph', label: 'Текст', icon: '📝' },
      { type: 'title', label: 'Заголовок', icon: '📌' },
      { type: 'subtitle', label: 'Подзаголовок', icon: '📍' },
      { type: 'quote', label: 'Цитата', icon: '💬' },
      { type: 'list', label: 'Список', icon: '📋' },
      { type: 'divider', label: 'Разделитель', icon: '➖' },
      { type: 'image', label: 'Изображение', icon: '🖼️' },
      { type: 'carousel', label: 'Карусель', icon: '🎠' },
    ];

    return (
      <div ref={menuRef} className="edit-article-v2__vk-plus">
        <button
          type="button"
          className="edit-article-v2__vk-plus-button"
          onClick={() => setIsOpen(!isOpen)}
        >
          +
        </button>
        {isOpen && (
          <div className="edit-article-v2__vk-plus-menu">
            {blockTypes.map(({ type, label, icon }) => (
              <button
                key={type}
                type="button"
                className="edit-article-v2__vk-plus-menu-item"
                onClick={() => {
                  onSelect(type);
                  setIsOpen(false);
                }}
              >
                <span className="edit-article-v2__vk-plus-menu-icon">{icon}</span>
                <span>{label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <Popup isActive={isOpen} onClose={onClose}>
      <div className="edit-article-v2">
        <div className="edit-article-v2__container">
          {/* Sticky Header */}
          <div className="edit-article-v2__header">
            <div className="edit-article-v2__header-content">
              <input
                type="text"
                className="edit-article-v2__title-input"
                value={meta.title}
                onChange={(e) => setMeta((prev) => ({ ...prev, title: e.target.value }))}
                placeholder={texts.title}
              />
              <div className="edit-article-v2__status">{getStatusText()}</div>
            </div>
            <div className="edit-article-v2__header-actions">
              <button
                type="button"
                className="edit-article-v2__button edit-article-v2__button--cancel"
                onClick={onClose}
              >
                {texts.cancel}
              </button>
              <button
                type="button"
                className="edit-article-v2__button edit-article-v2__button--publish"
                onClick={handlePublish}
                disabled={isPublishing || saveStatus === 'saving'}
              >
                {isPublishing ? texts.publishing : texts.publish}
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="edit-article-v2__content article">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={blocks.map((b) => b.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="edit-article-v2__blocks">
                  {blocks.map((block, index) => (
                    <React.Fragment key={block.id}>
                      <SortableBlock
                        block={block}
                        index={index}
                        isFocused={focusBlockId === block.id}
                        isSelected={selectedBlockId === block.id}
                        onUpdate={updateBlock}
                        onDelete={deleteBlock}
                        onFocus={setFocusBlockId}
                        onBlur={() => {
                          setFocusBlockId(null);
                          // Скрываем плюс при потере фокуса, если блок не пустой
                          if (vkInserter?.afterBlockId === block.id) {
                            const isBlockEmpty =
                              (block.type === 'paragraph' ||
                                block.type === 'title' ||
                                block.type === 'subtitle' ||
                                block.type === 'quote') &&
                              block.text.trim() === '';
                            const isListEmpty =
                              block.type === 'list' &&
                              block.items.every((item) => item.trim() === '');
                            if (!isBlockEmpty && !isListEmpty) {
                              setVkInserter(null);
                            }
                          }
                        }}
                        onSelect={setSelectedBlockId}
                        onEnter={handleBlockEnter}
                        onBackspace={(isEmpty: boolean, atStart?: boolean) =>
                          handleBlockBackspace(block.id, isEmpty, atStart ?? false)
                        }
                        onInsertAfter={insertBlockAfter}
                        onDuplicate={duplicateBlock}
                        onMoveUp={moveBlockUp}
                        onMoveDown={moveBlockDown}
                        onSlash={handleSlash}
                        onFormat={handleFormat}
                        onPaste={handlePaste}
                        onConvertToCarousel={convertImageToCarousel}
                      />
                      {/* VK-стиль плюс: показывается только после Enter в конце блока, только для пустых текстовых блоков */}
                      {vkInserter?.afterBlockId === block.id &&
                        (block.type === 'paragraph' ||
                          block.type === 'title' ||
                          block.type === 'subtitle' ||
                          block.type === 'quote') &&
                        block.text.trim() === '' && (
                          <VkPlusInserter
                            onSelect={(type) => {
                              insertBlockAfter(block.id, type);
                              setVkInserter(null);
                            }}
                            onClose={() => setVkInserter(null)}
                          />
                        )}
                    </React.Fragment>
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            {/* Slash menu */}
            {slashMenu && (
              <SlashMenu
                position={slashMenu.position}
                onSelect={handleSlashSelect}
                onClose={() => setSlashMenu(null)}
                selectedIndex={slashMenuSelectedIndex}
              />
            )}
          </div>
        </div>
      </div>
    </Popup>
  );
}
