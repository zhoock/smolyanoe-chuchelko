// src/pages/UserDashboard/components/
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
import {
  normalizeDetailsToSimplified,
  simplifiedToDetails,
  blocksToHtml,
  htmlToBlocks,
} from './EditArticleModal.utils';
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
    createCarousel: 'Создать карусель',
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
    createCarousel: 'Create carousel',
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
  const [contentHtml, setContentHtml] = useState<string>('');
  const contentEditableRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textInputRef = useRef<HTMLTextAreaElement>(null);
  const [uploadingImageIndex, setUploadingImageIndex] = useState<number | null>(null);
  const [editingCarouselIndex, setEditingCarouselIndex] = useState<number | null>(null);
  const [carouselBackup, setCarouselBackup] = useState<SimplifiedBlock | null>(null);
  const [showToolbar, setShowToolbar] = useState(false);
  const [paragraphToolbarIndex, setParagraphToolbarIndex] = useState<number | null>(null);
  const paragraphToolbarPositionRef = useRef<{ x: number; y: number } | null>(null);
  const [newTextContent, setNewTextContent] = useState('');
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [alertModal, setAlertModal] = useState<AlertModalState | null>(null);
  const [formattingTooltip, setFormattingTooltip] = useState<{
    show: boolean;
    x: number;
    y: number;
    selectedText: string;
    visible: boolean; // Для анимации
  }>({ show: false, x: 0, y: 0, selectedText: '', visible: false });

  // История изменений для undo/redo
  const [undoStack, setUndoStack] = useState<
    Array<{ blocks: SimplifiedBlock[]; contentHtml: string }>
  >([]);
  const [redoStack, setRedoStack] = useState<
    Array<{ blocks: SimplifiedBlock[]; contentHtml: string }>
  >([]);
  const isUndoRedoRef = useRef(false);

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
      // Очищаем историю undo/redo при закрытии модалки
      setUndoStack([]);
      setRedoStack([]);
      isUndoRedoRef.current = false;
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
      // Преобразуем блоки в HTML для единого contentEditable
      const html = blocksToHtml(simplified);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0d98fd1d-24ff-4297-901e-115ee9f70125', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: 'EditArticleModal.tsx:230',
          message: 'Initializing contentHtml',
          data: {
            blocksCount: simplified.length,
            htmlLength: html.length,
            htmlPreview: html.substring(0, 200),
          },
          timestamp: Date.now(),
          sessionId: 'debug-session',
          runId: 'run1',
          hypothesisId: 'D',
        }),
      }).catch(() => {});
      // #endregion
      setContentHtml(html);

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

  // Автофокус на поле ввода при открытии модалки
  useEffect(() => {
    if (isOpen && textInputRef.current) {
      textInputRef.current.focus();
    }
  }, [isOpen]);

  // Инициализация contentEditable только при первой загрузке
  // НЕ обновляем при каждом изменении contentHtml, чтобы не перезаписывать пользовательский ввод
  const isInitialMountRef = useRef(true);
  const lastContentHtmlRef = useRef<string>('');
  useEffect(() => {
    if (contentEditableRef.current && contentHtml) {
      // Обновляем только если contentHtml изменился извне (не из-за пользовательского ввода)
      // Проверяем, что это действительно новое значение, а не то же самое
      if (
        isInitialMountRef.current ||
        (contentHtml !== lastContentHtmlRef.current &&
          contentHtml !== contentEditableRef.current.innerHTML)
      ) {
        // #region agent log
        const selectionBefore = window.getSelection();
        const selectionInfoBefore = selectionBefore
          ? {
              rangeCount: selectionBefore.rangeCount,
              isCollapsed:
                selectionBefore.rangeCount > 0 ? selectionBefore.getRangeAt(0).collapsed : null,
              startContainer:
                selectionBefore.rangeCount > 0
                  ? selectionBefore.getRangeAt(0).startContainer.nodeName
                  : null,
              startOffset:
                selectionBefore.rangeCount > 0 ? selectionBefore.getRangeAt(0).startOffset : null,
            }
          : null;

        fetch('http://127.0.0.1:7242/ingest/0d98fd1d-24ff-4297-901e-115ee9f70125', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            location: 'EditArticleModal.tsx:298',
            message: 'useEffect: Setting innerHTML - BEFORE',
            data: {
              isInitialMount: isInitialMountRef.current,
              contentHtmlLength: contentHtml.length,
              currentInnerHTMLLength: contentEditableRef.current.innerHTML.length,
              areDifferent: contentHtml !== contentEditableRef.current.innerHTML,
              selectionBefore: selectionInfoBefore,
            },
            timestamp: Date.now(),
            sessionId: 'debug-session',
            runId: 'run1',
            hypothesisId: 'E',
          }),
        }).catch(() => {});
        // #endregion

        contentEditableRef.current.innerHTML = contentHtml;
        lastContentHtmlRef.current = contentHtml;
        isInitialMountRef.current = false;

        // #region agent log
        const selectionAfter = window.getSelection();
        const selectionInfoAfter = selectionAfter
          ? {
              rangeCount: selectionAfter.rangeCount,
              isCollapsed:
                selectionAfter.rangeCount > 0 ? selectionAfter.getRangeAt(0).collapsed : null,
              startContainer:
                selectionAfter.rangeCount > 0
                  ? selectionAfter.getRangeAt(0).startContainer.nodeName
                  : null,
              startOffset:
                selectionAfter.rangeCount > 0 ? selectionAfter.getRangeAt(0).startOffset : null,
            }
          : null;

        fetch('http://127.0.0.1:7242/ingest/0d98fd1d-24ff-4297-901e-115ee9f70125', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            location: 'EditArticleModal.tsx:318',
            message: 'useEffect: Setting innerHTML - AFTER',
            data: {
              selectionAfter: selectionInfoAfter,
              selectionLost: selectionInfoBefore && !selectionInfoAfter,
              selectionChanged:
                JSON.stringify(selectionInfoBefore) !== JSON.stringify(selectionInfoAfter),
            },
            timestamp: Date.now(),
            sessionId: 'debug-session',
            runId: 'run1',
            hypothesisId: 'E',
          }),
        }).catch(() => {});
        // #endregion
      }
    }
  }, [contentHtml]);

  // Сбрасываем флаг при закрытии модалки
  useEffect(() => {
    if (!isOpen) {
      isInitialMountRef.current = true;
      lastContentHtmlRef.current = '';
      setFormattingTooltip({ show: false, x: 0, y: 0, selectedText: '', visible: false });
    }
  }, [isOpen]);

  // Обработчик выделения текста для показа тултипа форматирования
  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null;

    const handleSelectionChange = () => {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0d98fd1d-24ff-4297-901e-115ee9f70125', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: 'EditArticleModal.tsx:335',
          message: 'handleSelectionChange called',
          data: {
            isOpen,
            hasContentEditable: !!contentEditableRef.current,
          },
          timestamp: Date.now(),
          sessionId: 'debug-session',
          runId: 'run1',
          hypothesisId: 'A',
        }),
      }).catch(() => {});
      // #endregion

      // Очищаем предыдущий таймаут, если он есть
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }

      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0 || !contentEditableRef.current || !isOpen) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/0d98fd1d-24ff-4297-901e-115ee9f70125', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            location: 'EditArticleModal.tsx:350',
            message: 'Selection check failed',
            data: {
              hasSelection: !!selection,
              rangeCount: selection?.rangeCount || 0,
              hasContentEditable: !!contentEditableRef.current,
              isOpen,
            },
            timestamp: Date.now(),
            sessionId: 'debug-session',
            runId: 'run1',
            hypothesisId: 'B',
          }),
        }).catch(() => {});
        // #endregion
        setFormattingTooltip({ show: false, x: 0, y: 0, selectedText: '', visible: false });
        return;
      }

      const range = selection.getRangeAt(0);
      const selectedText = selection.toString().trim();

      // Проверяем, что выделение находится внутри contentEditable
      if (
        !contentEditableRef.current.contains(range.commonAncestorContainer) ||
        selectedText.length === 0 ||
        range.collapsed
      ) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/0d98fd1d-24ff-4297-901e-115ee9f70125', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            location: 'EditArticleModal.tsx:370',
            message: 'Selection validation failed',
            data: {
              isInsideContentEditable: contentEditableRef.current.contains(
                range.commonAncestorContainer
              ),
              selectedTextLength: selectedText.length,
              isCollapsed: range.collapsed,
            },
            timestamp: Date.now(),
            sessionId: 'debug-session',
            runId: 'run1',
            hypothesisId: 'C',
          }),
        }).catch(() => {});
        // #endregion
        setFormattingTooltip({ show: false, x: 0, y: 0, selectedText: '', visible: false });
        return;
      }

      // Получаем позицию для тултипа
      const rect = range.getBoundingClientRect();
      const tooltipX = rect.left + rect.width / 2;
      const tooltipY = rect.top - 70; // Сдвигаем выше, чтобы не перекрывать текст

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0d98fd1d-24ff-4297-901e-115ee9f70125', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: 'EditArticleModal.tsx:385',
          message: 'Setting tooltip position',
          data: {
            tooltipX,
            tooltipY,
            selectedTextLength: selectedText.length,
            rectLeft: rect.left,
            rectTop: rect.top,
            rectWidth: rect.width,
          },
          timestamp: Date.now(),
          sessionId: 'debug-session',
          runId: 'run1',
          hypothesisId: 'D',
        }),
      }).catch(() => {});
      // #endregion

      // Сначала скрываем тултип (сбрасываем visible)
      setFormattingTooltip({
        show: true,
        x: tooltipX,
        y: tooltipY,
        selectedText,
        visible: false,
      });

      // Затем показываем с задержкой и анимацией
      timeoutId = setTimeout(() => {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/0d98fd1d-24ff-4297-901e-115ee9f70125', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            location: 'EditArticleModal.tsx:410',
            message: 'Setting tooltip visible',
            data: {
              willSetVisible: true,
            },
            timestamp: Date.now(),
            sessionId: 'debug-session',
            runId: 'run1',
            hypothesisId: 'E',
          }),
        }).catch(() => {});
        // #endregion
        setFormattingTooltip((prev) => ({
          ...prev,
          visible: true,
        }));
      }, 200); // Задержка 200мс (доли секунды)
    };

    // Функция для обновления позиции тултипа при прокрутке
    const updateTooltipPosition = () => {
      setFormattingTooltip((prev) => {
        if (!prev.show || !contentEditableRef.current) {
          return prev;
        }

        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) {
          return prev;
        }

        const range = selection.getRangeAt(0);
        if (!contentEditableRef.current.contains(range.commonAncestorContainer)) {
          return prev;
        }

        const rect = range.getBoundingClientRect();
        const tooltipX = rect.left + rect.width / 2;
        const tooltipY = rect.top - 70;

        return {
          ...prev,
          x: tooltipX,
          y: tooltipY,
        };
      });
    };

    // Обработчики событий для отслеживания выделения
    const handleMouseUp = () => {
      setTimeout(handleSelectionChange, 10);
    };

    const handleKeyUp = () => {
      setTimeout(handleSelectionChange, 10);
    };

    // Обработчик прокрутки для обновления позиции тултипа
    const handleScroll = () => {
      updateTooltipPosition();
    };

    if (isOpen) {
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('keyup', handleKeyUp);
      document.addEventListener('selectionchange', handleSelectionChange);
      // Добавляем обработчики прокрутки для window и всех возможных прокручиваемых контейнеров
      window.addEventListener('scroll', handleScroll, true);
      document.addEventListener('scroll', handleScroll, true);

      return () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        document.removeEventListener('mouseup', handleMouseUp);
        document.removeEventListener('keyup', handleKeyUp);
        document.removeEventListener('selectionchange', handleSelectionChange);
        window.removeEventListener('scroll', handleScroll, true);
        document.removeEventListener('scroll', handleScroll, true);
      };
    }
  }, [isOpen]);

  // Удаление блока (объявляем здесь, чтобы использовать в useEffect ниже)
  const deleteBlockRef = useRef<(index: number) => void>();

  // Сохранение состояния в историю для undo (объявляем здесь, чтобы использовать в useEffect ниже)
  const saveToHistoryRef = useRef<() => void>();
  const handleUndoRef = useRef<() => void>();
  const handleRedoRef = useRef<() => void>();

  // Добавляем кнопки слева от каждого параграфа
  useEffect(() => {
    if (!contentEditableRef.current) return;

    const addButtonsToParagraphs = () => {
      const paragraphs = contentEditableRef.current?.querySelectorAll('p[data-block-type="text"]');
      if (!paragraphs) return;

      paragraphs.forEach((paragraph) => {
        const paragraphElement = paragraph as HTMLParagraphElement;
        // Проверяем, есть ли уже кнопка
        if (paragraphElement.querySelector('.edit-article-modal__paragraph-button')) {
          return;
        }

        // Создаем кнопку
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'edit-article-modal__paragraph-button';
        button.innerHTML = '+';
        button.setAttribute('tabindex', '-1');
        button.setAttribute('contenteditable', 'false');

        // Обработчик клика на кнопку
        button.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();

          // Находим индекс параграфа в DOM
          const allParagraphs = contentEditableRef.current?.querySelectorAll(
            'p[data-block-type="text"]'
          );
          if (!allParagraphs) return;

          const paragraphIndex = Array.from(allParagraphs).indexOf(paragraphElement);
          if (paragraphIndex === -1) return;

          // Получаем позицию кнопки для позиционирования тултипа
          const buttonRect = button.getBoundingClientRect();
          const contentEditableRect = contentEditableRef.current?.getBoundingClientRect();
          if (contentEditableRect) {
            paragraphToolbarPositionRef.current = {
              x: buttonRect.left - contentEditableRect.left + buttonRect.width / 2,
              y: buttonRect.top - contentEditableRect.top,
            };
          }

          // Устанавливаем курсор в начало параграфа
          const selection = window.getSelection();
          if (selection && paragraphElement.firstChild) {
            const range = document.createRange();
            range.setStart(paragraphElement.firstChild, 0);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
          }

          // Показываем тултип для этого параграфа
          setParagraphToolbarIndex(paragraphIndex);
        });

        // Вставляем кнопку в начало параграфа
        paragraphElement.insertBefore(button, paragraphElement.firstChild);
      });
    };

    // Добавляем кнопки после обновления DOM
    const timeoutId = setTimeout(addButtonsToParagraphs, 0);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [blocks, contentHtml]);

  // Закрытие тултипа параграфа при клике вне его
  useEffect(() => {
    if (paragraphToolbarIndex === null) {
      return undefined;
    }

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // Проверяем, что клик был вне тултипа и кнопки
      if (
        !target.closest('.edit-article-modal__paragraph-toolbar') &&
        !target.closest('.edit-article-modal__paragraph-button')
      ) {
        // Восстанавливаем курсор в параграф перед закрытием тултипа
        if (contentEditableRef.current) {
          const allParagraphs = contentEditableRef.current.querySelectorAll(
            'p[data-block-type="text"]'
          );
          if (
            allParagraphs &&
            paragraphToolbarIndex >= 0 &&
            paragraphToolbarIndex < allParagraphs.length
          ) {
            const paragraph = allParagraphs[paragraphToolbarIndex] as HTMLParagraphElement;
            const selection = window.getSelection();
            if (selection && paragraph) {
              // Находим первый текстовый узел или создаем его
              let textNode: Node | null = null;
              if (paragraph.firstChild && paragraph.firstChild.nodeType === Node.TEXT_NODE) {
                textNode = paragraph.firstChild;
              } else {
                // Пропускаем кнопку и ищем текстовый узел
                for (let i = 0; i < paragraph.childNodes.length; i++) {
                  const node = paragraph.childNodes[i];
                  if (node.nodeType === Node.TEXT_NODE) {
                    textNode = node;
                    break;
                  }
                }
                // Если текстового узла нет, создаем его
                if (!textNode) {
                  textNode = document.createTextNode('');
                  // Вставляем после кнопки, если она есть
                  const button = paragraph.querySelector('.edit-article-modal__paragraph-button');
                  if (button && button.nextSibling) {
                    paragraph.insertBefore(textNode, button.nextSibling);
                  } else if (button) {
                    paragraph.appendChild(textNode);
                  } else {
                    paragraph.appendChild(textNode);
                  }
                }
              }

              if (textNode) {
                const range = document.createRange();
                range.setStart(textNode, 0);
                range.collapse(true);
                selection.removeAllRanges();
                selection.addRange(range);
                contentEditableRef.current.focus();
              }
            }
          }
        }

        setParagraphToolbarIndex(null);
      }
    };

    // Используем mousedown вместо click для более быстрой реакции
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [paragraphToolbarIndex]);

  // Обработчик нажатия клавиши Delete для удаления выбранного изображения и Command+Z для undo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Обработка Command+Z (Mac) или Ctrl+Z (Windows/Linux) для undo
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        const target = e.target as HTMLElement;
        // Не обрабатываем, если фокус в поле ввода
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
          return;
        }
        e.preventDefault();
        if (handleUndoRef.current) {
          handleUndoRef.current();
        }
        return;
      }

      // Обработка Command+Shift+Z или Ctrl+Shift+Z для redo
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && e.shiftKey) {
        const target = e.target as HTMLElement;
        // Не обрабатываем, если фокус в поле ввода
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
          return;
        }
        e.preventDefault();
        if (handleRedoRef.current) {
          handleRedoRef.current();
        }
        return;
      }

      // Обработка Command+Y или Ctrl+Y для redo (альтернативный способ)
      if ((e.metaKey || e.ctrlKey) && e.key === 'y') {
        const target = e.target as HTMLElement;
        // Не обрабатываем, если фокус в поле ввода
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
          return;
        }
        e.preventDefault();
        if (handleRedoRef.current) {
          handleRedoRef.current();
        }
        return;
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedImageIndex !== null) {
        // Проверяем, что фокус не в поле ввода (INPUT или TEXTAREA)
        // НО разрешаем удаление, если выбрано изображение, даже если фокус в contentEditable
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
          return;
        }

        // Если фокус в contentEditable, но выбрано изображение, разрешаем удаление
        // Проверяем, что активный элемент не является input или textarea
        const activeElement = document.activeElement;
        if (
          activeElement &&
          (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')
        ) {
          return;
        }

        e.preventDefault();
        const block = blocks[selectedImageIndex];
        if (block && (block.type === 'image' || block.type === 'carousel')) {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/0d98fd1d-24ff-4297-901e-115ee9f70125', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              location: 'EditArticleModal.tsx:628',
              message: 'Deleting image block',
              data: {
                selectedImageIndex,
                blockType: block.type,
                blockId: block.id,
                blocksCount: blocks.length,
              },
              timestamp: Date.now(),
              sessionId: 'debug-session',
              runId: 'run1',
              hypothesisId: 'J',
            }),
          }).catch(() => {});
          // #endregion
          if (deleteBlockRef.current) {
            deleteBlockRef.current(selectedImageIndex);
          }
          setSelectedImageIndex(null);
        }
      }
      // Сброс выбора при нажатии Escape
      if (e.key === 'Escape' && selectedImageIndex !== null) {
        setSelectedImageIndex(null);
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isOpen, selectedImageIndex, blocks]);

  // Применяем класс --selected к выбранному изображению
  useEffect(() => {
    if (!contentEditableRef.current) return;

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0d98fd1d-24ff-4297-901e-115ee9f70125', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'EditArticleModal.tsx:651',
        message: 'Applying --selected class - start',
        data: {
          selectedImageIndex,
          blocksCount: blocks.length,
          hasContentEditable: !!contentEditableRef.current,
        },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        runId: 'run1',
        hypothesisId: 'D',
      }),
    }).catch(() => {});
    // #endregion

    // Убираем класс --selected со всех изображений
    const allImages = contentEditableRef.current.querySelectorAll(
      '.edit-article-modal__inline-image, .edit-article-modal__inline-carousel'
    );
    allImages.forEach((img) => {
      img.classList.remove('edit-article-modal__inline-image--selected');
      img.classList.remove('edit-article-modal__inline-carousel--selected');
    });

    // Добавляем класс --selected к выбранному изображению
    if (selectedImageIndex !== null) {
      const block = blocks[selectedImageIndex];

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0d98fd1d-24ff-4297-901e-115ee9f70125', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: 'EditArticleModal.tsx:675',
          message: 'Applying --selected class - block found',
          data: {
            selectedImageIndex,
            hasBlock: !!block,
            blockType: block?.type,
            blockId: block?.id,
            blocksCount: blocks.length,
          },
          timestamp: Date.now(),
          sessionId: 'debug-session',
          runId: 'run1',
          hypothesisId: 'E',
        }),
      }).catch(() => {});
      // #endregion

      if (block && (block.type === 'image' || block.type === 'carousel')) {
        // Ищем изображение по data-block-id или по позиции
        let targetElement: Element | null = null;

        if (block.id) {
          targetElement = contentEditableRef.current.querySelector(
            `[data-block-type="${block.type}"][data-block-id="${block.id}"]`
          );
        }

        // Если не нашли по id, ищем по позиции
        if (!targetElement) {
          const allImageBlocks = Array.from(
            contentEditableRef.current.querySelectorAll(
              '.edit-article-modal__inline-image, .edit-article-modal__inline-carousel'
            )
          );
          let imageBlockCount = 0;
          for (let i = 0; i < blocks.length; i++) {
            if (blocks[i].type === 'image' || blocks[i].type === 'carousel') {
              if (i === selectedImageIndex) {
                targetElement = allImageBlocks[imageBlockCount] || null;
                break;
              }
              imageBlockCount++;
            }
          }
        }

        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/0d98fd1d-24ff-4297-901e-115ee9f70125', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            location: 'EditArticleModal.tsx:705',
            message: 'Applying --selected class - targetElement found',
            data: {
              selectedImageIndex,
              hasTargetElement: !!targetElement,
              targetElementClassName: targetElement?.className,
              willAddClass: !!targetElement,
            },
            timestamp: Date.now(),
            sessionId: 'debug-session',
            runId: 'run1',
            hypothesisId: 'F',
          }),
        }).catch(() => {});
        // #endregion

        if (targetElement) {
          if (block.type === 'image') {
            targetElement.classList.add('edit-article-modal__inline-image--selected');
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/0d98fd1d-24ff-4297-901e-115ee9f70125', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                location: 'EditArticleModal.tsx:738',
                message: 'Class added to image element',
                data: {
                  selectedImageIndex,
                  hasClass: targetElement.classList.contains(
                    'edit-article-modal__inline-image--selected'
                  ),
                  elementClassName: targetElement.className,
                },
                timestamp: Date.now(),
                sessionId: 'debug-session',
                runId: 'run1',
                hypothesisId: 'I',
              }),
            }).catch(() => {});
            // #endregion
          } else {
            targetElement.classList.add('edit-article-modal__inline-carousel--selected');
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/0d98fd1d-24ff-4297-901e-115ee9f70125', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                location: 'EditArticleModal.tsx:750',
                message: 'Class added to carousel element',
                data: {
                  selectedImageIndex,
                  hasClass: targetElement.classList.contains(
                    'edit-article-modal__inline-carousel--selected'
                  ),
                  elementClassName: targetElement.className,
                },
                timestamp: Date.now(),
                sessionId: 'debug-session',
                runId: 'run1',
                hypothesisId: 'I',
              }),
            }).catch(() => {});
            // #endregion
          }
        }
      }
    }
  }, [selectedImageIndex, blocks, contentHtml]);

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

  // Добавление текстового блока из поля ввода
  const addTextBlockFromInput = () => {
    if (newTextContent.trim() && contentEditableRef.current) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0d98fd1d-24ff-4297-901e-115ee9f70125', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: 'EditArticleModal.tsx:492',
          message: 'addTextBlockFromInput called',
          data: {
            textLength: newTextContent.trim().length,
            hasContentEditable: !!contentEditableRef.current,
            currentInnerHTMLLength: contentEditableRef.current.innerHTML.length,
          },
          timestamp: Date.now(),
          sessionId: 'debug-session',
          runId: 'run1',
          hypothesisId: 'A',
        }),
      }).catch(() => {});
      // #endregion
      const textHtml = `<p data-block-type="text">${newTextContent.trim()}</p>`;
      // Устанавливаем курсор в конец contentEditable, если нет выделения
      if (contentEditableRef.current) {
        const selection = window.getSelection();
        let range: Range | null = null;

        if (selection && selection.rangeCount > 0) {
          range = selection.getRangeAt(0);
          // Проверяем, что выделение находится внутри contentEditable
          if (!contentEditableRef.current.contains(range.commonAncestorContainer)) {
            range = null;
          }
        }

        // Если нет выделения или выделение вне contentEditable, создаем новое в конце
        if (!range) {
          range = document.createRange();
          range.selectNodeContents(contentEditableRef.current);
          range.collapse(false); // Коллапсируем в конец
        }

        range.deleteContents();
        const div = document.createElement('div');
        div.innerHTML = textHtml;
        const fragment = document.createDocumentFragment();
        while (div.firstChild) {
          fragment.appendChild(div.firstChild);
        }
        range.insertNode(fragment);

        // Устанавливаем курсор после вставленного элемента
        range.setStartAfter(fragment.lastChild || range.endContainer);
        range.collapse(true);
        selection?.removeAllRanges();
        selection?.addRange(range);

        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/0d98fd1d-24ff-4297-901e-115ee9f70125', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            location: 'EditArticleModal.tsx:540',
            message: 'After inserting text via selection',
            data: {
              newInnerHTMLLength: contentEditableRef.current.innerHTML.length,
              insertedHtml: textHtml,
              hadSelection: !!selection && selection.rangeCount > 0,
            },
            timestamp: Date.now(),
            sessionId: 'debug-session',
            runId: 'run1',
            hypothesisId: 'B',
          }),
        }).catch(() => {});
        // #endregion
        // Обновляем HTML и блоки
        const html = contentEditableRef.current.innerHTML;
        // Обновляем lastContentHtmlRef, чтобы useEffect не перезаписывал
        lastContentHtmlRef.current = html;
        setContentHtml(html);
        const parsedBlocks = htmlToBlocks(html);
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/0d98fd1d-24ff-4297-901e-115ee9f70125', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            location: 'EditArticleModal.tsx:520',
            message: 'After parsing blocks from inserted text',
            data: {
              htmlLength: html.length,
              parsedBlocksCount: parsedBlocks.length,
              lastBlockContent: parsedBlocks[parsedBlocks.length - 1]?.content,
            },
            timestamp: Date.now(),
            sessionId: 'debug-session',
            runId: 'run1',
            hypothesisId: 'C',
          }),
        }).catch(() => {});
        // #endregion
        setBlocks(parsedBlocks);
        scheduleAutoSave();
      }
      setNewTextContent('');
    } else {
      // Очищаем поле, даже если текст пустой
      setNewTextContent('');
    }
  };

  // Применение форматирования к выделенному тексту
  const applyFormatting = (
    formatType:
      | 'link'
      | 'h1'
      | 'h2'
      | 'h3'
      | 'h4'
      | 'paragraph'
      | 'list'
      | 'quote'
      | 'bold'
      | 'italic'
  ) => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || !contentEditableRef.current) {
      return;
    }

    const range = selection.getRangeAt(0);
    const selectedText = selection.toString().trim();

    if (!selectedText || !contentEditableRef.current.contains(range.commonAncestorContainer)) {
      return;
    }

    // Находим родительский элемент выделения
    let parentElement: HTMLElement | null = range.commonAncestorContainer as HTMLElement;
    if (parentElement.nodeType !== Node.ELEMENT_NODE) {
      parentElement = parentElement.parentElement;
    }

    // Определяем, какой тег нужно создать
    let targetTagName = '';
    let targetBlockType = '';
    switch (formatType) {
      case 'h1':
      case 'h3':
        targetTagName = 'H3';
        targetBlockType = 'title';
        break;
      case 'h2':
      case 'h4':
        targetTagName = 'H4';
        targetBlockType = 'subtitle';
        break;
      case 'paragraph':
        targetTagName = 'P';
        targetBlockType = 'text';
        break;
      case 'list':
        targetTagName = 'UL';
        targetBlockType = 'list';
        break;
      case 'quote':
        targetTagName = 'BLOCKQUOTE';
        targetBlockType = 'quote';
        break;
    }

    // Находим ближайший блок-контейнер (P, H3, H4, UL, BLOCKQUOTE) для замены
    let blockContainer: HTMLElement | null = null;
    if (parentElement) {
      let current: HTMLElement | null = parentElement;
      while (current && current !== contentEditableRef.current) {
        const tagName = current.tagName;
        const blockType = current.getAttribute('data-block-type');
        // Проверяем, является ли это блоком-контейнером
        if (
          (tagName === 'P' && blockType === 'text') ||
          (tagName === 'H3' && blockType === 'title') ||
          (tagName === 'H4' && blockType === 'subtitle') ||
          (tagName === 'UL' && blockType === 'list') ||
          (tagName === 'BLOCKQUOTE' && blockType === 'quote')
        ) {
          blockContainer = current;
          break;
        }
        current = current.parentElement;
      }
    }

    // Проверяем, находится ли выделение внутри тега того же типа
    let existingElement: HTMLElement | null = null;
    if (blockContainer && targetTagName) {
      if (
        blockContainer.tagName === targetTagName &&
        blockContainer.getAttribute('data-block-type') === targetBlockType
      ) {
        existingElement = blockContainer;
      }
    }

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0d98fd1d-24ff-4297-901e-115ee9f70125', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'EditArticleModal.tsx:910',
        message: 'applyFormatting: checking containers',
        data: {
          formatType,
          targetTagName,
          targetBlockType,
          hasBlockContainer: !!blockContainer,
          blockContainerTag: blockContainer?.tagName,
          blockContainerType: blockContainer?.getAttribute('data-block-type'),
          hasExistingElement: !!existingElement,
        },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        runId: 'run1',
        hypothesisId: 'F',
      }),
    }).catch(() => {});
    // #endregion

    // Обработка жирного текста и курсива (inline форматирование)
    if (formatType === 'bold' || formatType === 'italic') {
      // Проверяем, не находится ли выделение уже внутри тега того же типа
      let existingFormatTag: HTMLElement | null = null;
      let formatParent: HTMLElement | null = parentElement;
      const targetFormatTag = formatType === 'bold' ? 'STRONG' : 'EM';

      while (formatParent && formatParent !== contentEditableRef.current) {
        if (formatParent.tagName === targetFormatTag) {
          existingFormatTag = formatParent;
          break;
        }
        formatParent = formatParent.parentElement;
      }

      if (existingFormatTag) {
        // Если уже внутри тега форматирования, убираем форматирование
        const text = existingFormatTag.textContent || '';
        const textNode = document.createTextNode(text);
        existingFormatTag.replaceWith(textNode);
      } else {
        // Создаем новый тег форматирования
        const formatElement = document.createElement(formatType === 'bold' ? 'strong' : 'em');
        formatElement.textContent = selectedText;
        range.deleteContents();
        range.insertNode(formatElement);
      }

      // Обновляем HTML и блоки
      const html = contentEditableRef.current.innerHTML;
      lastContentHtmlRef.current = html;
      setContentHtml(html);
      const parsedBlocks = htmlToBlocks(html);
      setBlocks(parsedBlocks);
      scheduleAutoSave();

      // Скрываем тултип
      setFormattingTooltip({ show: false, x: 0, y: 0, selectedText: '', visible: false });
      return;
    } else if (formatType === 'link') {
      // Обработка ссылок
      // Проверяем, не находится ли выделение уже внутри ссылки
      let linkParent: HTMLElement | null = parentElement;
      while (linkParent && linkParent !== contentEditableRef.current) {
        if (linkParent.tagName === 'A') {
          // Если уже внутри ссылки, просто обновляем href
          const url = prompt(
            lang === 'ru' ? 'Введите ссылку:' : 'Enter link:',
            linkParent.getAttribute('href') || 'https://'
          );
          if (!url) return;
          linkParent.setAttribute('href', url);
          // Обновляем HTML и блоки
          const html = contentEditableRef.current.innerHTML;
          lastContentHtmlRef.current = html;
          setContentHtml(html);
          const parsedBlocks = htmlToBlocks(html);
          setBlocks(parsedBlocks);
          scheduleAutoSave();
          setFormattingTooltip({ show: false, x: 0, y: 0, selectedText: '', visible: false });
          return;
        }
        linkParent = linkParent.parentElement;
      }
      // Запрашиваем URL для новой ссылки
      const url = prompt(lang === 'ru' ? 'Введите ссылку:' : 'Enter link:', 'https://');
      if (!url) return;
      const linkElement = document.createElement('a');
      linkElement.href = url;
      linkElement.target = '_blank';
      linkElement.rel = 'noopener noreferrer';
      linkElement.textContent = selectedText;
      range.deleteContents();
      range.insertNode(linkElement);
    } else if (existingElement) {
      // Если выделение уже внутри тега того же типа, заменяем весь тег
      const newElement = document.createElement(targetTagName.toLowerCase() as any);
      newElement.setAttribute('data-block-type', targetBlockType);

      if (formatType === 'list') {
        const lines = selectedText.split('\n').filter((line) => line.trim());
        lines.forEach((line) => {
          const li = document.createElement('li');
          li.textContent = line.trim();
          newElement.appendChild(li);
        });
      } else {
        newElement.textContent = selectedText;
      }

      existingElement.replaceWith(newElement);
    } else if (blockContainer && blockContainer !== contentEditableRef.current) {
      // Если выделение внутри другого блока-контейнера, заменяем весь блок
      const newElement = document.createElement(targetTagName.toLowerCase() as any);
      newElement.setAttribute('data-block-type', targetBlockType);

      if (formatType === 'list') {
        const lines = selectedText.split('\n').filter((line) => line.trim());
        lines.forEach((line) => {
          const li = document.createElement('li');
          li.textContent = line.trim();
          newElement.appendChild(li);
        });
      } else {
        newElement.textContent = selectedText;
      }

      blockContainer.replaceWith(newElement);
    } else {
      // Создаем новый тег
      let wrapperHtml = '';
      switch (formatType) {
        case 'h1':
        case 'h3':
          wrapperHtml = `<h3 data-block-type="title">${selectedText}</h3>`;
          break;
        case 'h2':
        case 'h4':
          wrapperHtml = `<h4 data-block-type="subtitle">${selectedText}</h4>`;
          break;
        case 'paragraph':
          wrapperHtml = `<p data-block-type="text">${selectedText}</p>`;
          break;
        case 'list': {
          const lines = selectedText.split('\n').filter((line) => line.trim());
          wrapperHtml = `<ul data-block-type="list">${lines.map((line) => `<li>${line.trim()}</li>`).join('')}</ul>`;
          break;
        }
        case 'quote':
          wrapperHtml = `<blockquote data-block-type="quote">${selectedText}</blockquote>`;
          break;
      }

      if (wrapperHtml) {
        // Удаляем выделенный текст
        range.deleteContents();

        // Вставляем новый HTML
        const div = document.createElement('div');
        div.innerHTML = wrapperHtml;
        const fragment = document.createDocumentFragment();
        while (div.firstChild) {
          fragment.appendChild(div.firstChild);
        }
        range.insertNode(fragment);
      }
    }

    // Обновляем HTML и блоки
    const html = contentEditableRef.current.innerHTML;
    lastContentHtmlRef.current = html;
    setContentHtml(html);
    const parsedBlocks = htmlToBlocks(html);
    setBlocks(parsedBlocks);
    scheduleAutoSave();

    // Скрываем тултип
    setFormattingTooltip({ show: false, x: 0, y: 0, selectedText: '', visible: false });
  };

  // Добавление разделителя
  const addDivider = () => {
    if (contentEditableRef.current) {
      const dividerHtml =
        '<hr data-block-type="divider" class="edit-article-modal__inline-divider" />';
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        const div = document.createElement('div');
        div.innerHTML = dividerHtml;
        const fragment = document.createDocumentFragment();
        while (div.firstChild) {
          fragment.appendChild(div.firstChild);
        }
        range.insertNode(fragment);

        // Устанавливаем курсор после разделителя
        setTimeout(() => {
          const newSelection = window.getSelection();
          if (newSelection && contentEditableRef.current) {
            const divider = contentEditableRef.current.querySelector(
              '.edit-article-modal__inline-divider:last-of-type'
            );
            if (divider && divider.nextSibling) {
              const range = document.createRange();
              if (divider.nextSibling.nodeType === Node.TEXT_NODE) {
                range.setStart(divider.nextSibling, 0);
              } else if (divider.nextSibling.nodeType === Node.ELEMENT_NODE) {
                const element = divider.nextSibling as HTMLElement;
                const firstTextNode = element.firstChild;
                if (firstTextNode && firstTextNode.nodeType === Node.TEXT_NODE) {
                  range.setStart(firstTextNode, 0);
                } else {
                  range.setStart(element, 0);
                }
              } else {
                range.setStartAfter(divider);
              }
              range.collapse(true);
              newSelection.removeAllRanges();
              newSelection.addRange(range);
              contentEditableRef.current.focus();
            }
          }
        }, 0);

        // Обновляем HTML и блоки
        const html = contentEditableRef.current.innerHTML;
        // Обновляем lastContentHtmlRef, чтобы useEffect не перезаписывал
        lastContentHtmlRef.current = html;
        setContentHtml(html);
        const parsedBlocks = htmlToBlocks(html);
        setBlocks(parsedBlocks);
        scheduleAutoSave();
      }
    }
    setShowToolbar(false);
    setParagraphToolbarIndex(null);
  };

  // Обработка загрузки изображения из панели инструментов
  const handleImageFromToolbar = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      showAlert(texts.pleaseSelectImage);
      return;
    }

    try {
      const userId = CURRENT_USER_CONFIG.userId;
      if (!userId) {
        showAlert(texts.notAuthorized);
        return;
      }

      setUploadingImageIndex(-1); // Используем -1 для индикации загрузки из панели

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
      // Вставляем изображение в contentEditable
      if (contentEditableRef.current) {
        const imageHtml = `<div data-block-type="image" data-image="${imageFileName}" contenteditable="false" class="edit-article-modal__inline-image">
          <img src="${getUserImageUrl(imageFileName, 'articles')}" alt="" />
        </div>`;
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          range.deleteContents();
          const div = document.createElement('div');
          div.innerHTML = imageHtml;
          const fragment = document.createDocumentFragment();
          while (div.firstChild) {
            fragment.appendChild(div.firstChild);
          }
          range.insertNode(fragment);

          // Устанавливаем курсор после изображения
          setTimeout(() => {
            const newSelection = window.getSelection();
            if (newSelection && contentEditableRef.current) {
              const image = contentEditableRef.current.querySelector(
                '.edit-article-modal__inline-image:last-of-type'
              );
              if (image) {
                const range = document.createRange();
                // Ищем следующий элемент после изображения
                if (image.nextSibling) {
                  if (image.nextSibling.nodeType === Node.TEXT_NODE) {
                    range.setStart(image.nextSibling, 0);
                  } else if (image.nextSibling.nodeType === Node.ELEMENT_NODE) {
                    const element = image.nextSibling as HTMLElement;
                    const firstTextNode = element.firstChild;
                    if (firstTextNode && firstTextNode.nodeType === Node.TEXT_NODE) {
                      range.setStart(firstTextNode, 0);
                    } else {
                      range.setStart(element, 0);
                    }
                  } else {
                    range.setStartAfter(image);
                  }
                } else {
                  // Если следующего элемента нет, создаем новый параграф
                  const newParagraph = document.createElement('p');
                  newParagraph.setAttribute('data-block-type', 'text');
                  const textNode = document.createTextNode('');
                  newParagraph.appendChild(textNode);
                  image.parentNode?.insertBefore(newParagraph, image.nextSibling);
                  range.setStart(textNode, 0);
                }
                range.collapse(true);
                newSelection.removeAllRanges();
                newSelection.addRange(range);
                contentEditableRef.current.focus();
              }
            }
          }, 0);

          // Обновляем HTML и блоки
          const html = contentEditableRef.current.innerHTML;
          // Обновляем lastContentHtmlRef, чтобы useEffect не перезаписывал
          lastContentHtmlRef.current = html;
          setContentHtml(html);
          const parsedBlocks = htmlToBlocks(html);
          setBlocks(parsedBlocks);
          scheduleAutoSave();
        }
      }
      setShowToolbar(false);
      setParagraphToolbarIndex(null);
    } catch (error) {
      console.error('Error uploading image:', error);
      showAlert(texts.errorUploadingImage);
    } finally {
      setUploadingImageIndex(null);
    }
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

  // Преобразование изображения в карусель
  const convertImageToCarousel = (blockIndex: number) => {
    setBlocks((prev) => {
      const newBlocks = [...prev];
      const block = newBlocks[blockIndex];
      if (block.type === 'image' && block.img) {
        const imageUrl = typeof block.img === 'string' ? block.img : block.img[0];
        const newCarouselBlock = {
          ...block,
          type: 'carousel' as const,
          img: [imageUrl],
        };
        newBlocks[blockIndex] = newCarouselBlock;
        // Сохраняем резервную копию перед редактированием
        setCarouselBackup({ ...block });
        // Открываем панель редактирования карусели
        setEditingCarouselIndex(blockIndex);
      }
      return newBlocks;
    });
    scheduleAutoSave();
  };

  // Открытие панели редактирования карусели
  const openCarouselEdit = (blockIndex: number) => {
    const block = blocks[blockIndex];
    if (block?.type === 'carousel') {
      // Сохраняем резервную копию перед редактированием
      setCarouselBackup({ ...block });
      setEditingCarouselIndex(blockIndex);
    }
  };

  // Отмена изменений карусели
  const cancelCarouselEdit = () => {
    if (editingCarouselIndex !== null && carouselBackup) {
      setBlocks((prev) => {
        const newBlocks = [...prev];
        newBlocks[editingCarouselIndex] = { ...carouselBackup };
        return newBlocks;
      });
      setCarouselBackup(null);
      setEditingCarouselIndex(null);
    }
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

  // Сохранение состояния в историю для undo
  const saveToHistory = useCallback(() => {
    if (isUndoRedoRef.current) {
      return; // Не сохраняем в историю, если это операция undo/redo
    }
    setUndoStack((prev) => {
      const newStack = [...prev, { blocks: [...blocks], contentHtml: contentHtml }];
      // Ограничиваем размер истории до 50 операций
      return newStack.slice(-50);
    });
    // Очищаем redo stack при новом изменении
    setRedoStack([]);
  }, [blocks, contentHtml]);

  // Undo - отмена последнего действия
  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;

    isUndoRedoRef.current = true;
    const lastState = undoStack[undoStack.length - 1];
    const currentState = { blocks: [...blocks], contentHtml: contentHtml };

    // Сохраняем текущее состояние в redo stack
    setRedoStack((prev) => [...prev, currentState]);

    // Восстанавливаем предыдущее состояние
    setBlocks(lastState.blocks);
    setContentHtml(lastState.contentHtml);
    if (contentEditableRef.current) {
      contentEditableRef.current.innerHTML = lastState.contentHtml;
      lastContentHtmlRef.current = lastState.contentHtml;

      // Устанавливаем курсор в последний параграф с содержимым после восстановления
      setTimeout(() => {
        if (!contentEditableRef.current) return;

        const paragraphs = Array.from(
          contentEditableRef.current.querySelectorAll('p[data-block-type="text"]')
        ) as HTMLParagraphElement[];

        if (paragraphs.length > 0) {
          // Ищем последний параграф с содержимым (или просто последний, если все пустые)
          let targetParagraph: HTMLParagraphElement | null = null;

          // Проходим с конца и ищем параграф с текстом
          for (let i = paragraphs.length - 1; i >= 0; i--) {
            const paragraph = paragraphs[i];
            // Получаем текст без учета кнопки
            const button = paragraph.querySelector('.edit-article-modal__paragraph-button');
            const textContent = paragraph.textContent || '';
            const textWithoutButton = button
              ? textContent.replace(button.textContent || '', '').trim()
              : textContent.trim();

            if (textWithoutButton.length > 0 || i === 0) {
              targetParagraph = paragraph;
              break;
            }
          }

          // Если не нашли параграф с текстом, берем последний
          if (!targetParagraph && paragraphs.length > 0) {
            targetParagraph = paragraphs[paragraphs.length - 1];
          }

          if (targetParagraph) {
            // Находим все текстовые узлы в параграфе (пропускаем кнопку)
            let lastTextNode: Node | null = null;
            let lastTextNodeLength = 0;

            for (let i = 0; i < targetParagraph.childNodes.length; i++) {
              const node = targetParagraph.childNodes[i];
              if (node.nodeType === Node.TEXT_NODE) {
                lastTextNode = node;
                lastTextNodeLength = node.textContent?.length || 0;
              } else if (
                node.nodeType === Node.ELEMENT_NODE &&
                !(node as HTMLElement).classList.contains('edit-article-modal__paragraph-button')
              ) {
                const element = node as HTMLElement;
                // Ищем текстовые узлы внутри элемента
                const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null);
                let textNode: Node | null = null;
                while ((textNode = walker.nextNode())) {
                  lastTextNode = textNode;
                  lastTextNodeLength = textNode.textContent?.length || 0;
                }
              }
            }

            // Если текстового узла нет, создаем его
            if (!lastTextNode) {
              lastTextNode = document.createTextNode('');
              const button = targetParagraph.querySelector('.edit-article-modal__paragraph-button');
              if (button && button.nextSibling) {
                targetParagraph.insertBefore(lastTextNode, button.nextSibling);
              } else if (button) {
                targetParagraph.appendChild(lastTextNode);
              } else {
                targetParagraph.appendChild(lastTextNode);
              }
              lastTextNodeLength = 0;
            }

            // Устанавливаем курсор в конец последнего текстового узла
            const selection = window.getSelection();
            if (selection && lastTextNode) {
              const range = document.createRange();
              range.setStart(lastTextNode, lastTextNodeLength);
              range.collapse(true);
              selection.removeAllRanges();
              selection.addRange(range);
              contentEditableRef.current.focus();
            }
          }
        }
      }, 0);
    }

    // Удаляем последнее состояние из undo stack
    setUndoStack((prev) => prev.slice(0, -1));

    setTimeout(() => {
      isUndoRedoRef.current = false;
    }, 0);
  }, [undoStack, blocks, contentHtml]);

  // Redo - повтор последнего отмененного действия
  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;

    isUndoRedoRef.current = true;
    const lastState = redoStack[redoStack.length - 1];
    const currentState = { blocks: [...blocks], contentHtml: contentHtml };

    // Сохраняем текущее состояние в undo stack
    setUndoStack((prev) => [...prev, currentState]);

    // Восстанавливаем состояние из redo
    setBlocks(lastState.blocks);
    setContentHtml(lastState.contentHtml);
    if (contentEditableRef.current) {
      contentEditableRef.current.innerHTML = lastState.contentHtml;
      lastContentHtmlRef.current = lastState.contentHtml;

      // Устанавливаем курсор в последний параграф после восстановления
      setTimeout(() => {
        if (!contentEditableRef.current) return;

        const paragraphs = contentEditableRef.current.querySelectorAll('p[data-block-type="text"]');
        if (paragraphs && paragraphs.length > 0) {
          const lastParagraph = paragraphs[paragraphs.length - 1] as HTMLParagraphElement;

          // Находим первый текстовый узел в параграфе (пропускаем кнопку)
          let textNode: Node | null = null;
          for (let i = 0; i < lastParagraph.childNodes.length; i++) {
            const node = lastParagraph.childNodes[i];
            if (node.nodeType === Node.TEXT_NODE) {
              textNode = node;
              break;
            } else if (
              node.nodeType === Node.ELEMENT_NODE &&
              !(node as HTMLElement).classList.contains('edit-article-modal__paragraph-button')
            ) {
              const element = node as HTMLElement;
              if (element.firstChild && element.firstChild.nodeType === Node.TEXT_NODE) {
                textNode = element.firstChild;
                break;
              }
            }
          }

          // Если текстового узла нет, создаем его
          if (!textNode) {
            textNode = document.createTextNode('');
            const button = lastParagraph.querySelector('.edit-article-modal__paragraph-button');
            if (button && button.nextSibling) {
              lastParagraph.insertBefore(textNode, button.nextSibling);
            } else if (button) {
              lastParagraph.appendChild(textNode);
            } else {
              lastParagraph.appendChild(textNode);
            }
          }

          // Устанавливаем курсор в конец текстового узла
          const selection = window.getSelection();
          if (selection && textNode) {
            const range = document.createRange();
            range.setStart(textNode, textNode.textContent?.length || 0);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
            contentEditableRef.current.focus();
          }
        }
      }, 0);
    }

    // Удаляем последнее состояние из redo stack
    setRedoStack((prev) => prev.slice(0, -1));

    setTimeout(() => {
      isUndoRedoRef.current = false;
    }, 0);
  }, [redoStack, blocks, contentHtml]);

  // Сохраняем функции в ref для использования в useEffect
  useEffect(() => {
    saveToHistoryRef.current = saveToHistory;
    handleUndoRef.current = handleUndo;
    handleRedoRef.current = handleRedo;
  }, [saveToHistory, handleUndo, handleRedo]);

  // Удаление блока
  const deleteBlock = useCallback(
    (index: number) => {
      // Сохраняем текущее состояние в историю перед удалением
      if (saveToHistoryRef.current) {
        saveToHistoryRef.current();
      }

      setBlocks((prev) => {
        const newBlocks = prev.filter((_, i) => i !== index);
        // Обновляем contentHtml после удаления блока
        const newHtml = blocksToHtml(newBlocks);
        setContentHtml(newHtml);
        if (contentEditableRef.current) {
          contentEditableRef.current.innerHTML = newHtml;
          lastContentHtmlRef.current = newHtml;
        }
        return newBlocks;
      });
      scheduleAutoSave();
    },
    [scheduleAutoSave, saveToHistory]
  );

  // Сохраняем deleteBlock в ref для использования в useEffect
  useEffect(() => {
    deleteBlockRef.current = deleteBlock;
  }, [deleteBlock]);

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
            <section
              className="article edit-article-modal__article"
              onClick={(e) => {
                // Сбрасываем выбор, если клик не по изображению или разделителю
                const target = e.target as HTMLElement;
                if (
                  selectedImageIndex !== null &&
                  !target.closest('.edit-article-modal__inline-image') &&
                  !target.closest('.edit-article-modal__inline-carousel') &&
                  !target.classList.contains('edit-article-modal__divider')
                ) {
                  setSelectedImageIndex(null);
                }
              }}
            >
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

                {/* Тултип для кнопки "+" слева от параграфа */}
                {paragraphToolbarIndex !== null && paragraphToolbarPositionRef.current && (
                  <div
                    className="edit-article-modal__paragraph-toolbar"
                    style={{
                      position: 'absolute',
                      left: `${paragraphToolbarPositionRef.current.x}px`,
                      top: `${paragraphToolbarPositionRef.current.y + 32}px`,
                      transform: 'translateX(-50%)',
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      className="edit-article-modal__paragraph-toolbar-button"
                      onClick={() => {
                        fileInputRef.current?.click();
                        setParagraphToolbarIndex(null);
                      }}
                      title={lang === 'ru' ? 'Добавить изображение' : 'Add image'}
                    >
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="edit-article-modal__paragraph-toolbar-button"
                      onClick={addDivider}
                      title={lang === 'ru' ? 'Добавить разделитель' : 'Add divider'}
                    >
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <line x1="3" y1="12" x2="21" y2="12" />
                      </svg>
                    </button>
                  </div>
                )}

                {/* Единый contentEditable блок для редактирования всего контента */}
                <div
                  ref={contentEditableRef}
                  className="edit-article-modal__content-editable"
                  contentEditable
                  suppressContentEditableWarning
                  onMouseDown={(e) => {
                    // Предотвращаем выделение текста при клике на изображения
                    const target = e.target as HTMLElement;
                    if (
                      target.closest('.edit-article-modal__inline-image') ||
                      target.closest('.edit-article-modal__inline-carousel')
                    ) {
                      e.preventDefault();
                      // Очищаем любое существующее выделение
                      const selection = window.getSelection();
                      if (selection) {
                        selection.removeAllRanges();
                      }
                    }

                    // Если клик по кнопке, не обрабатываем дальше
                    if (target.closest('.edit-article-modal__paragraph-button')) {
                      return;
                    }

                    // Если клик по параграфу, позволяем браузеру установить курсор естественным образом
                    const paragraph = target.closest('p[data-block-type="text"]');
                    if (paragraph) {
                      // Не предотвращаем событие - браузер сам установит курсор
                      // Но убеждаемся, что contentEditable имеет фокус
                      setTimeout(() => {
                        if (
                          contentEditableRef.current &&
                          document.activeElement !== contentEditableRef.current
                        ) {
                          contentEditableRef.current.focus();
                        }
                      }, 0);
                    }
                  }}
                  onClick={(e) => {
                    const target = e.target as HTMLElement;

                    // Если клик по кнопке, не обрабатываем дальше
                    if (target.closest('.edit-article-modal__paragraph-button')) {
                      return;
                    }

                    // Если клик по параграфу, явно устанавливаем курсор
                    const paragraph = target.closest('p[data-block-type="text"]');
                    if (paragraph && !target.closest('.edit-article-modal__paragraph-button')) {
                      // Используем координаты клика для установки курсора
                      const clickX = e.clientX;
                      const clickY = e.clientY;

                      setTimeout(() => {
                        const selection = window.getSelection();
                        if (selection && contentEditableRef.current) {
                          // Создаем range из точки клика
                          let range: Range | null = null;
                          if (document.caretRangeFromPoint) {
                            range = document.caretRangeFromPoint(clickX, clickY);
                          } else if (document.caretPositionFromPoint) {
                            const caretPos = document.caretPositionFromPoint(clickX, clickY);
                            if (caretPos) {
                              range = document.createRange();
                              range.setStart(caretPos.offsetNode, caretPos.offset);
                              range.collapse(true);
                            }
                          }

                          if (range) {
                            selection.removeAllRanges();
                            selection.addRange(range);
                            contentEditableRef.current.focus();
                          } else {
                            // Fallback: устанавливаем курсор в начало параграфа
                            const paragraphElement = paragraph as HTMLElement;
                            // Пропускаем кнопку и находим первый текстовый узел
                            let textNode: Node | null = null;
                            for (let i = 0; i < paragraphElement.childNodes.length; i++) {
                              const node = paragraphElement.childNodes[i];
                              if (node.nodeType === Node.TEXT_NODE) {
                                textNode = node;
                                break;
                              } else if (
                                node.nodeType === Node.ELEMENT_NODE &&
                                !(node as HTMLElement).classList.contains(
                                  'edit-article-modal__paragraph-button'
                                )
                              ) {
                                const element = node as HTMLElement;
                                if (
                                  element.firstChild &&
                                  element.firstChild.nodeType === Node.TEXT_NODE
                                ) {
                                  textNode = element.firstChild;
                                  break;
                                }
                              }
                            }

                            if (!textNode) {
                              textNode = document.createTextNode('');
                              // Вставляем после кнопки, если она есть
                              const button = paragraphElement.querySelector(
                                '.edit-article-modal__paragraph-button'
                              );
                              if (button && button.nextSibling) {
                                paragraphElement.insertBefore(textNode, button.nextSibling);
                              } else if (button) {
                                paragraphElement.appendChild(textNode);
                              } else {
                                paragraphElement.appendChild(textNode);
                              }
                            }

                            const newRange = document.createRange();
                            newRange.setStart(textNode, 0);
                            newRange.collapse(true);
                            selection.removeAllRanges();
                            selection.addRange(newRange);
                            contentEditableRef.current.focus();
                          }
                        }
                      }, 0);
                    }

                    // Обработка клика на изображения и карусели для установки selectedImageIndex
                    const imageWrapper = target.closest('.edit-article-modal__inline-image');
                    const carouselWrapper = target.closest('.edit-article-modal__inline-carousel');

                    // #region agent log
                    fetch('http://127.0.0.1:7242/ingest/0d98fd1d-24ff-4297-901e-115ee9f70125', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        location: 'EditArticleModal.tsx:2074',
                        message: 'Image click handler - start',
                        data: {
                          targetTagName: target.tagName,
                          targetClassName: target.className,
                          hasImageWrapper: !!imageWrapper,
                          hasCarouselWrapper: !!carouselWrapper,
                          blocksCount: blocks.length,
                        },
                        timestamp: Date.now(),
                        sessionId: 'debug-session',
                        runId: 'run1',
                        hypothesisId: 'A',
                      }),
                    }).catch(() => {});
                    // #endregion

                    if (imageWrapper || carouselWrapper) {
                      e.preventDefault();
                      e.stopPropagation();

                      // Очищаем выделение текста, если оно есть
                      const selection = window.getSelection();
                      if (selection) {
                        selection.removeAllRanges();
                      }

                      // Находим индекс блока по data-block-id
                      const wrapper = imageWrapper || carouselWrapper;
                      if (!wrapper) return;

                      const blockId = wrapper.getAttribute('data-block-id');

                      // #region agent log
                      fetch('http://127.0.0.1:7242/ingest/0d98fd1d-24ff-4297-901e-115ee9f70125', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          location: 'EditArticleModal.tsx:2095',
                          message: 'Image click - found wrapper',
                          data: {
                            blockId,
                            wrapperClassName: wrapper.className,
                            blocksCount: blocks.length,
                          },
                          timestamp: Date.now(),
                          sessionId: 'debug-session',
                          runId: 'run1',
                          hypothesisId: 'B',
                        }),
                      }).catch(() => {});
                      // #endregion

                      // Ищем блок по data-block-id или по порядковому номеру в DOM
                      let blockIndex = -1;

                      // #region agent log
                      fetch('http://127.0.0.1:7242/ingest/0d98fd1d-24ff-4297-901e-115ee9f70125', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          location: 'EditArticleModal.tsx:2217',
                          message: 'Image click - searching by blockId',
                          data: {
                            blockId,
                            blocksWithIds: blocks.map((b, idx) => ({
                              index: idx,
                              id: b.id,
                              type: b.type,
                            })),
                          },
                          timestamp: Date.now(),
                          sessionId: 'debug-session',
                          runId: 'run1',
                          hypothesisId: 'G',
                        }),
                      }).catch(() => {});
                      // #endregion

                      if (blockId && blockId !== '') {
                        // Ищем по data-block-id, но только среди блоков типа image или carousel
                        blockIndex = blocks.findIndex(
                          (block) =>
                            String(block.id) === blockId &&
                            (block.type === 'image' || block.type === 'carousel')
                        );

                        // #region agent log
                        fetch('http://127.0.0.1:7242/ingest/0d98fd1d-24ff-4297-901e-115ee9f70125', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            location: 'EditArticleModal.tsx:2222',
                            message: 'Image click - blockIndex after findIndex',
                            data: {
                              blockId,
                              blockIndex,
                              foundBlockType: blockIndex >= 0 ? blocks[blockIndex]?.type : null,
                              foundBlockId: blockIndex >= 0 ? blocks[blockIndex]?.id : null,
                            },
                            timestamp: Date.now(),
                            sessionId: 'debug-session',
                            runId: 'run1',
                            hypothesisId: 'H',
                          }),
                        }).catch(() => {});
                        // #endregion
                      }

                      // Если не нашли по id, ищем по позиции в DOM
                      if (blockIndex === -1 && contentEditableRef.current) {
                        const allImageBlocks = Array.from(
                          contentEditableRef.current.querySelectorAll(
                            '.edit-article-modal__inline-image, .edit-article-modal__inline-carousel'
                          )
                        );
                        const domIndex = allImageBlocks.indexOf(wrapper);
                        if (domIndex >= 0) {
                          // Находим индекс в массиве blocks, считая только image и carousel блоки
                          let imageBlockCount = 0;
                          for (let i = 0; i < blocks.length; i++) {
                            if (blocks[i].type === 'image' || blocks[i].type === 'carousel') {
                              if (imageBlockCount === domIndex) {
                                blockIndex = i;
                                break;
                              }
                              imageBlockCount++;
                            }
                          }
                        }
                      }

                      // #region agent log
                      fetch('http://127.0.0.1:7242/ingest/0d98fd1d-24ff-4297-901e-115ee9f70125', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          location: 'EditArticleModal.tsx:2130',
                          message: 'Image click - blockIndex found',
                          data: {
                            blockIndex,
                            willSetSelectedImageIndex: blockIndex >= 0,
                            currentSelectedImageIndex: selectedImageIndex,
                          },
                          timestamp: Date.now(),
                          sessionId: 'debug-session',
                          runId: 'run1',
                          hypothesisId: 'C',
                        }),
                      }).catch(() => {});
                      // #endregion

                      if (blockIndex >= 0) {
                        setSelectedImageIndex(blockIndex);
                      }
                    }
                  }}
                  onKeyDown={(e) => {
                    // Обработка Enter: по умолчанию создаем параграф, Shift+Enter - тот же тег
                    // Не блокируем стандартные комбинации клавиш для выделения текста
                    if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey && !e.altKey) {
                      // Проверяем, что курсор находится внутри contentEditable
                      if (!contentEditableRef.current) {
                        return;
                      }

                      const selection = window.getSelection();
                      if (!selection || selection.rangeCount === 0) {
                        // Если нет выделения, позволяем стандартное поведение
                        return;
                      }

                      const range = selection.getRangeAt(0);
                      // Проверяем, что курсор находится внутри нашего contentEditable
                      if (!contentEditableRef.current.contains(range.commonAncestorContainer)) {
                        return;
                      }

                      e.preventDefault();

                      // Shift+Enter: создаем новый элемент того же типа
                      if (e.shiftKey) {
                        // Находим текущий блок-контейнер и элемент списка (если есть)
                        let blockContainer: HTMLElement | null = null;
                        let listItem: HTMLElement | null = null;
                        let current: Node | null = range.commonAncestorContainer;

                        while (current && current !== contentEditableRef.current) {
                          if (current.nodeType === Node.ELEMENT_NODE) {
                            const element = current as HTMLElement;
                            const tagName = element.tagName;
                            const blockType = element.getAttribute('data-block-type');

                            // Проверяем, является ли это элементом списка
                            if (tagName === 'LI') {
                              listItem = element;
                            }

                            // Проверяем, является ли это блоком-контейнером
                            if (
                              (tagName === 'P' && blockType === 'text') ||
                              (tagName === 'H3' && blockType === 'title') ||
                              (tagName === 'H4' && blockType === 'subtitle') ||
                              (tagName === 'UL' && blockType === 'list') ||
                              (tagName === 'BLOCKQUOTE' && blockType === 'quote')
                            ) {
                              blockContainer = element;
                              break;
                            }
                          }
                          current = current.parentNode;
                        }

                        let newElement: HTMLElement | null = null;

                        // Если находимся внутри списка, создаем новый элемент списка
                        if (listItem && blockContainer && blockContainer.tagName === 'UL') {
                          const newLi = document.createElement('li');
                          const textNode = document.createTextNode('');
                          newLi.appendChild(textNode);

                          // Вставляем новый элемент списка после текущего
                          if (listItem.nextSibling) {
                            listItem.parentNode?.insertBefore(newLi, listItem.nextSibling);
                          } else {
                            listItem.parentNode?.appendChild(newLi);
                          }

                          newElement = newLi;
                        } else if (blockContainer) {
                          // Создаем новый элемент того же типа, что и текущий блок
                          const tagName = blockContainer.tagName;
                          const blockType = blockContainer.getAttribute('data-block-type');

                          if (tagName === 'P' && blockType === 'text') {
                            newElement = document.createElement('p');
                            newElement.setAttribute('data-block-type', 'text');
                          } else if (tagName === 'H3' && blockType === 'title') {
                            newElement = document.createElement('h3');
                            newElement.setAttribute('data-block-type', 'title');
                          } else if (tagName === 'H4' && blockType === 'subtitle') {
                            newElement = document.createElement('h4');
                            newElement.setAttribute('data-block-type', 'subtitle');
                          } else if (tagName === 'BLOCKQUOTE' && blockType === 'quote') {
                            newElement = document.createElement('blockquote');
                            newElement.setAttribute('data-block-type', 'quote');
                          }

                          if (newElement) {
                            const textNode = document.createTextNode('');
                            newElement.appendChild(textNode);

                            // Вставляем новый элемент после текущего блока
                            if (blockContainer.nextSibling) {
                              blockContainer.parentNode?.insertBefore(
                                newElement,
                                blockContainer.nextSibling
                              );
                            } else {
                              blockContainer.parentNode?.appendChild(newElement);
                            }
                          }
                        } else {
                          // Если не нашли блок-контейнер, создаем новый параграф
                          newElement = document.createElement('p');
                          newElement.setAttribute('data-block-type', 'text');
                          const textNode = document.createTextNode('');
                          newElement.appendChild(textNode);
                          contentEditableRef.current.appendChild(newElement);
                        }

                        // Обновляем HTML и блоки
                        if (newElement && contentEditableRef.current) {
                          const html = contentEditableRef.current.innerHTML;
                          lastContentHtmlRef.current = html;
                          setContentHtml(html);
                          const parsedBlocks = htmlToBlocks(html);
                          setBlocks(parsedBlocks);

                          // Устанавливаем курсор в новый элемент
                          setTimeout(() => {
                            const currentSelection = window.getSelection();
                            if (!currentSelection || !contentEditableRef.current || !newElement)
                              return;

                            // Находим новый элемент в обновленном DOM
                            let targetElement: HTMLElement | null = null;

                            if (newElement.tagName === 'LI') {
                              // Для элементов списка ищем по родителю и позиции
                              const allLists = Array.from(
                                contentEditableRef.current.querySelectorAll(
                                  'ul[data-block-type="list"]'
                                )
                              );
                              for (const ul of allLists) {
                                const lis = Array.from(ul.querySelectorAll('li'));
                                if (lis.length > 0) {
                                  // Берем последний элемент списка
                                  targetElement = lis[lis.length - 1] as HTMLElement;
                                  break;
                                }
                              }
                            } else {
                              // Для других элементов ищем по типу и позиции
                              const allElements = contentEditableRef.current.querySelectorAll(
                                `${newElement.tagName.toLowerCase()}[data-block-type="${newElement.getAttribute('data-block-type')}"]`
                              );
                              if (allElements.length > 0) {
                                targetElement = allElements[allElements.length - 1] as HTMLElement;
                              }
                            }

                            if (targetElement) {
                              let textNode: Text | null = null;
                              if (
                                targetElement.firstChild &&
                                targetElement.firstChild.nodeType === Node.TEXT_NODE
                              ) {
                                textNode = targetElement.firstChild as Text;
                              } else {
                                textNode = document.createTextNode('');
                                targetElement.appendChild(textNode);
                              }

                              const finalRange = document.createRange();
                              finalRange.setStart(textNode, 0);
                              finalRange.collapse(true);
                              currentSelection.removeAllRanges();
                              currentSelection.addRange(finalRange);
                              contentEditableRef.current.focus();
                            }
                          }, 0);
                        }

                        return; // Завершаем обработку Shift+Enter
                      }

                      // Enter (без Shift): создаем новый параграф
                      // #region agent log
                      fetch('http://127.0.0.1:7242/ingest/0d98fd1d-24ff-4297-901e-115ee9f70125', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          location: 'EditArticleModal.tsx:1946',
                          message: 'Enter key pressed - start (no shift)',
                          data: {
                            hasContentEditable: !!contentEditableRef.current,
                            innerHTMLLength: contentEditableRef.current?.innerHTML?.length || 0,
                          },
                          timestamp: Date.now(),
                          sessionId: 'debug-session',
                          runId: 'run1',
                          hypothesisId: 'A',
                        }),
                      }).catch(() => {});
                      // #endregion

                      // #region agent log
                      fetch('http://127.0.0.1:7242/ingest/0d98fd1d-24ff-4297-901e-115ee9f70125', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          location: 'EditArticleModal.tsx:1964',
                          message: 'Enter key - before preventDefault (no shift)',
                          data: {
                            rangeStartContainer: range.startContainer.nodeName,
                            rangeStartOffset: range.startOffset,
                            rangeCollapsed: range.collapsed,
                            selectionRangeCount: selection.rangeCount,
                          },
                          timestamp: Date.now(),
                          sessionId: 'debug-session',
                          runId: 'run1',
                          hypothesisId: 'A',
                        }),
                      }).catch(() => {});
                      // #endregion

                      e.preventDefault();

                      // Сохраняем текущее состояние в историю перед созданием нового параграфа
                      if (saveToHistoryRef.current) {
                        saveToHistoryRef.current();
                      }

                      // Используем стандартное поведение браузера для разбивки блока
                      // document.execCommand('insertParagraph') создает новый блок того же типа
                      // Но мы хотим создать параграф, поэтому делаем это вручную

                      // Находим родительский блок-контейнер
                      let blockContainer: HTMLElement | null = null;
                      let current: Node | null = range.commonAncestorContainer;
                      while (current && current !== contentEditableRef.current) {
                        if (current.nodeType === Node.ELEMENT_NODE) {
                          const element = current as HTMLElement;
                          const tagName = element.tagName;
                          const blockType = element.getAttribute('data-block-type');
                          if (
                            (tagName === 'P' && blockType === 'text') ||
                            (tagName === 'H3' && blockType === 'title') ||
                            (tagName === 'H4' && blockType === 'subtitle') ||
                            (tagName === 'UL' && blockType === 'list') ||
                            (tagName === 'BLOCKQUOTE' && blockType === 'quote')
                          ) {
                            blockContainer = element;
                            break;
                          }
                        }
                        current = current.parentNode;
                      }

                      let newParagraph: HTMLParagraphElement | null = null;

                      // #region agent log
                      fetch('http://127.0.0.1:7242/ingest/0d98fd1d-24ff-4297-901e-115ee9f70125', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          location: 'EditArticleModal.tsx:1992',
                          message: 'Before creating paragraph',
                          data: {
                            hasBlockContainer: !!blockContainer,
                            blockContainerTag: blockContainer?.tagName,
                            blockContainerType: blockContainer?.getAttribute('data-block-type'),
                          },
                          timestamp: Date.now(),
                          sessionId: 'debug-session',
                          runId: 'run1',
                          hypothesisId: 'B',
                        }),
                      }).catch(() => {});
                      // #endregion

                      if (blockContainer) {
                        // Используем стандартное поведение для разбивки блока
                        // Но затем заменяем созданный блок на параграф
                        const startContainer = range.startContainer;
                        const startOffset = range.startOffset;

                        // Извлекаем содержимое после курсора
                        const afterRange = range.cloneRange();
                        afterRange.setStart(startContainer, startOffset);
                        afterRange.setEnd(blockContainer, blockContainer.childNodes.length);
                        const afterContents = afterRange.extractContents();

                        // Создаем новый параграф
                        newParagraph = document.createElement('p');
                        newParagraph.setAttribute('data-block-type', 'text');

                        // Перемещаем содержимое после курсора в новый параграф
                        if (afterContents.textContent) {
                          newParagraph.textContent = afterContents.textContent;
                        }

                        // Вставляем новый параграф после текущего блока
                        if (blockContainer.nextSibling) {
                          blockContainer.parentNode?.insertBefore(
                            newParagraph,
                            blockContainer.nextSibling
                          );
                        } else {
                          blockContainer.parentNode?.appendChild(newParagraph);
                        }
                      } else {
                        // Если не нашли блок-контейнер, создаем новый параграф в конце
                        newParagraph = document.createElement('p');
                        newParagraph.setAttribute('data-block-type', 'text');
                        // Создаем пустой текстовый узел для курсора
                        const textNode = document.createTextNode('');
                        newParagraph.appendChild(textNode);
                        contentEditableRef.current.appendChild(newParagraph);
                      }

                      // #region agent log
                      fetch('http://127.0.0.1:7242/ingest/0d98fd1d-24ff-4297-901e-115ee9f70125', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          location: 'EditArticleModal.tsx:2033',
                          message: 'Paragraph created, before HTML update',
                          data: {
                            hasNewParagraph: !!newParagraph,
                            newParagraphText: newParagraph?.textContent || '',
                            newParagraphHasTextNode: !!newParagraph?.firstChild,
                            newParagraphTextNodeType: newParagraph?.firstChild?.nodeType,
                          },
                          timestamp: Date.now(),
                          sessionId: 'debug-session',
                          runId: 'run1',
                          hypothesisId: 'A',
                        }),
                      }).catch(() => {});
                      // #endregion

                      // Обновляем HTML и блоки
                      const html = contentEditableRef.current.innerHTML;
                      lastContentHtmlRef.current = html;
                      setContentHtml(html);
                      const parsedBlocks = htmlToBlocks(html);
                      setBlocks(parsedBlocks);

                      // #region agent log
                      fetch('http://127.0.0.1:7242/ingest/0d98fd1d-24ff-4297-901e-115ee9f70125', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          location: 'EditArticleModal.tsx:2040',
                          message: 'After HTML/Blocks update, before cursor setup',
                          data: {
                            htmlLength: html.length,
                            parsedBlocksCount: parsedBlocks.length,
                            currentSelectionRangeCount: window.getSelection()?.rangeCount || 0,
                          },
                          timestamp: Date.now(),
                          sessionId: 'debug-session',
                          runId: 'run1',
                          hypothesisId: 'A',
                        }),
                      }).catch(() => {});
                      // #endregion

                      // Устанавливаем курсор в новый параграф после обновления DOM
                      if (newParagraph && contentEditableRef.current) {
                        // Находим параграф в обновленном DOM (он может быть пересоздан)
                        const allParagraphs = contentEditableRef.current.querySelectorAll(
                          'p[data-block-type="text"]'
                        );
                        let targetParagraph: HTMLParagraphElement | null = null;

                        // Ищем параграф, который находится после blockContainer (если он был)
                        if (blockContainer) {
                          // Находим индекс blockContainer
                          const allBlocks = Array.from(contentEditableRef.current.children);
                          const blockIndex = allBlocks.indexOf(blockContainer);
                          if (blockIndex >= 0 && blockIndex < allBlocks.length - 1) {
                            // Берем следующий параграф
                            const nextBlock = allBlocks[blockIndex + 1];
                            if (
                              nextBlock.tagName === 'P' &&
                              nextBlock.getAttribute('data-block-type') === 'text'
                            ) {
                              targetParagraph = nextBlock as HTMLParagraphElement;
                            }
                          }
                        }

                        // Если не нашли, берем последний параграф
                        if (!targetParagraph && allParagraphs.length > 0) {
                          targetParagraph = allParagraphs[
                            allParagraphs.length - 1
                          ] as HTMLParagraphElement;
                        }

                        // #region agent log
                        fetch('http://127.0.0.1:7242/ingest/0d98fd1d-24ff-4297-901e-115ee9f70125', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            location: 'EditArticleModal.tsx:2042',
                            message: 'Finding target paragraph',
                            data: {
                              allParagraphsCount: allParagraphs.length,
                              hasBlockContainer: !!blockContainer,
                              foundTargetParagraph: !!targetParagraph,
                              targetParagraphText:
                                targetParagraph?.textContent?.substring(0, 20) || '',
                            },
                            timestamp: Date.now(),
                            sessionId: 'debug-session',
                            runId: 'run1',
                            hypothesisId: 'B',
                          }),
                        }).catch(() => {});
                        // #endregion

                        if (targetParagraph) {
                          // Создаем текстовый узел, если его нет
                          let textNode: Text | null = null;
                          if (
                            targetParagraph.firstChild &&
                            targetParagraph.firstChild.nodeType === Node.TEXT_NODE
                          ) {
                            textNode = targetParagraph.firstChild as Text;
                          } else {
                            textNode = document.createTextNode('');
                            targetParagraph.appendChild(textNode);
                          }

                          // #region agent log
                          fetch(
                            'http://127.0.0.1:7242/ingest/0d98fd1d-24ff-4297-901e-115ee9f70125',
                            {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                location: 'EditArticleModal.tsx:2073',
                                message: 'Before setting cursor',
                                data: {
                                  hasTextNode: !!textNode,
                                  textNodeLength: textNode?.textContent?.length || 0,
                                  targetParagraphHasFocus:
                                    document.activeElement === contentEditableRef.current,
                                },
                                timestamp: Date.now(),
                                sessionId: 'debug-session',
                                runId: 'run1',
                                hypothesisId: 'C',
                              }),
                            }
                          ).catch(() => {});
                          // #endregion

                          // Устанавливаем курсор после обновления React (используем setTimeout для следующего тика)
                          // Это гарантирует, что React завершил обновление DOM перед установкой курсора
                          setTimeout(() => {
                            const currentSelection = window.getSelection();
                            if (!currentSelection || !contentEditableRef.current) return;

                            // Находим параграф снова (он мог быть пересоздан React после setBlocks)
                            const allParagraphsAfter = contentEditableRef.current.querySelectorAll(
                              'p[data-block-type="text"]'
                            );
                            let finalTargetParagraph: HTMLParagraphElement | null = null;

                            if (blockContainer) {
                              const allBlocksAfter = Array.from(
                                contentEditableRef.current.children
                              );
                              const blockIndexAfter = allBlocksAfter.indexOf(blockContainer);
                              if (
                                blockIndexAfter >= 0 &&
                                blockIndexAfter < allBlocksAfter.length - 1
                              ) {
                                const nextBlockAfter = allBlocksAfter[blockIndexAfter + 1];
                                if (
                                  nextBlockAfter.tagName === 'P' &&
                                  nextBlockAfter.getAttribute('data-block-type') === 'text'
                                ) {
                                  finalTargetParagraph = nextBlockAfter as HTMLParagraphElement;
                                }
                              }
                            }

                            if (!finalTargetParagraph && allParagraphsAfter.length > 0) {
                              finalTargetParagraph = allParagraphsAfter[
                                allParagraphsAfter.length - 1
                              ] as HTMLParagraphElement;
                            }

                            if (finalTargetParagraph) {
                              // #region agent log
                              fetch(
                                'http://127.0.0.1:7242/ingest/0d98fd1d-24ff-4297-901e-115ee9f70125',
                                {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    location: 'EditArticleModal.tsx:2323',
                                    message: 'Found target paragraph in setTimeout',
                                    data: {
                                      paragraphText:
                                        finalTargetParagraph.textContent?.substring(0, 20) || '',
                                      paragraphHasChildren: finalTargetParagraph.hasChildNodes(),
                                      paragraphFirstChildType:
                                        finalTargetParagraph.firstChild?.nodeType,
                                      paragraphIndex: Array.from(
                                        contentEditableRef.current.children
                                      ).indexOf(finalTargetParagraph),
                                      allParagraphsCount: allParagraphsAfter.length,
                                    },
                                    timestamp: Date.now(),
                                    sessionId: 'debug-session',
                                    runId: 'run1',
                                    hypothesisId: 'B',
                                  }),
                                }
                              ).catch(() => {});
                              // #endregion

                              let finalTextNode: Text | null = null;
                              if (
                                finalTargetParagraph.firstChild &&
                                finalTargetParagraph.firstChild.nodeType === Node.TEXT_NODE
                              ) {
                                finalTextNode = finalTargetParagraph.firstChild as Text;
                              } else {
                                finalTextNode = document.createTextNode('');
                                finalTargetParagraph.appendChild(finalTextNode);
                              }

                              const finalRange = document.createRange();
                              finalRange.setStart(finalTextNode, 0);
                              finalRange.collapse(true);
                              currentSelection.removeAllRanges();
                              currentSelection.addRange(finalRange);

                              // Убеждаемся, что параграф виден (не пустой и не скрыт)
                              if (
                                finalTargetParagraph.textContent === '' &&
                                !finalTextNode.textContent
                              ) {
                                // Добавляем неразрывный пробел, чтобы параграф был виден
                                finalTextNode.textContent = '\u00A0'; // &nbsp;
                                finalRange.setStart(finalTextNode, 0);
                                finalRange.collapse(true);
                                currentSelection.removeAllRanges();
                                currentSelection.addRange(finalRange);
                              }

                              contentEditableRef.current.focus();

                              // Устанавливаем курсор еще раз через requestAnimationFrame для надежности
                              requestAnimationFrame(() => {
                                const rafSelection = window.getSelection();
                                if (rafSelection && finalTargetParagraph && finalTextNode) {
                                  // Проверяем, что текстовый узел все еще существует
                                  if (finalTargetParagraph.contains(finalTextNode)) {
                                    const rafRange = document.createRange();
                                    rafRange.setStart(finalTextNode, 0);
                                    rafRange.collapse(true);
                                    rafSelection.removeAllRanges();
                                    rafSelection.addRange(rafRange);
                                    contentEditableRef.current?.focus();
                                  }
                                }
                              });

                              // #region agent log
                              fetch(
                                'http://127.0.0.1:7242/ingest/0d98fd1d-24ff-4297-901e-115ee9f70125',
                                {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    location: 'EditArticleModal.tsx:2286',
                                    message: 'After setting cursor (delayed after React update)',
                                    data: {
                                      selectionRangeCount: window.getSelection()?.rangeCount || 0,
                                      selectionIsCollapsed: window.getSelection()?.getRangeAt(0)
                                        ?.collapsed,
                                      selectionStartContainer: window.getSelection()?.getRangeAt(0)
                                        ?.startContainer?.nodeName,
                                      selectionStartOffset: window.getSelection()?.getRangeAt(0)
                                        ?.startOffset,
                                      hasFocus:
                                        document.activeElement === contentEditableRef.current,
                                      activeElementTag: document.activeElement?.tagName,
                                      paragraphText: finalTargetParagraph.textContent || '',
                                      paragraphHasContent:
                                        (finalTargetParagraph.textContent?.length || 0) > 0,
                                    },
                                    timestamp: Date.now(),
                                    sessionId: 'debug-session',
                                    runId: 'run1',
                                    hypothesisId: 'C',
                                  }),
                                }
                              ).catch(() => {});
                              // #endregion
                            }
                          }, 0);
                        } else {
                          // #region agent log
                          fetch(
                            'http://127.0.0.1:7242/ingest/0d98fd1d-24ff-4297-901e-115ee9f70125',
                            {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                location: 'EditArticleModal.tsx:2094',
                                message: 'Target paragraph not found',
                                data: {
                                  allParagraphsCount: allParagraphs.length,
                                  hasNewParagraph: !!newParagraph,
                                },
                                timestamp: Date.now(),
                                sessionId: 'debug-session',
                                runId: 'run1',
                                hypothesisId: 'B',
                              }),
                            }
                          ).catch(() => {});
                          // #endregion
                        }
                      }

                      scheduleAutoSave();
                    }
                    // Shift+Enter - оставляем стандартное поведение браузера (создает <br> или тот же тег)
                  }}
                  onPaste={(e) => {
                    e.preventDefault();

                    // Получаем только текстовое содержимое из буфера обмена
                    const pastedText = e.clipboardData.getData('text/plain');

                    if (!pastedText || !contentEditableRef.current) {
                      return;
                    }

                    const selection = window.getSelection();
                    if (!selection || selection.rangeCount === 0) {
                      return;
                    }

                    const range = selection.getRangeAt(0);

                    // Проверяем, что курсор находится внутри нашего contentEditable
                    if (!contentEditableRef.current.contains(range.commonAncestorContainer)) {
                      return;
                    }

                    // Удаляем выделенный текст (если есть)
                    range.deleteContents();

                    // Вставляем чистый текст
                    const textNode = document.createTextNode(pastedText);
                    range.insertNode(textNode);

                    // Перемещаем курсор в конец вставленного текста
                    range.setStartAfter(textNode);
                    range.collapse(true);
                    selection.removeAllRanges();
                    selection.addRange(range);

                    // Обновляем HTML и блоки
                    const html = contentEditableRef.current.innerHTML;
                    lastContentHtmlRef.current = html;
                    setContentHtml(html);
                    const parsedBlocks = htmlToBlocks(html);
                    setBlocks(parsedBlocks);

                    // Планируем автосохранение
                    scheduleAutoSave();
                  }}
                  onFocus={() => {
                    // #region agent log
                    fetch('http://127.0.0.1:7242/ingest/0d98fd1d-24ff-4297-901e-115ee9f70125', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        location: 'EditArticleModal.tsx:1293',
                        message: 'ContentEditable onFocus',
                        data: {
                          hasRef: !!contentEditableRef.current,
                          contentHtmlLength: contentHtml.length,
                          innerHTML: contentEditableRef.current?.innerHTML?.substring(0, 100),
                          isContentEditable: contentEditableRef.current?.isContentEditable,
                        },
                        timestamp: Date.now(),
                        sessionId: 'debug-session',
                        runId: 'run1',
                        hypothesisId: 'A',
                      }),
                    }).catch(() => {});
                    // #endregion
                  }}
                  onInput={(e) => {
                    // #region agent log
                    fetch('http://127.0.0.1:7242/ingest/0d98fd1d-24ff-4297-901e-115ee9f70125', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        location: 'EditArticleModal.tsx:1350',
                        message: 'ContentEditable onInput triggered',
                        data: {
                          newHtmlLength: e.currentTarget.innerHTML.length,
                          newHtmlPreview: e.currentTarget.innerHTML.substring(0, 100),
                          oldContentHtmlLength: contentHtml.length,
                          isInitialMount: isInitialMountRef.current,
                        },
                        timestamp: Date.now(),
                        sessionId: 'debug-session',
                        runId: 'run1',
                        hypothesisId: 'B',
                      }),
                    }).catch(() => {});
                    // #endregion
                    const html = e.currentTarget.innerHTML;
                    // Обновляем lastContentHtmlRef, чтобы useEffect не перезаписывал
                    lastContentHtmlRef.current = html;
                    setContentHtml(html);
                    // Парсим HTML обратно в блоки
                    const parsedBlocks = htmlToBlocks(html);
                    // #region agent log
                    fetch('http://127.0.0.1:7242/ingest/0d98fd1d-24ff-4297-901e-115ee9f70125', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        location: 'EditArticleModal.tsx:1370',
                        message: 'After htmlToBlocks',
                        data: {
                          parsedBlocksCount: parsedBlocks.length,
                          htmlLength: html.length,
                        },
                        timestamp: Date.now(),
                        sessionId: 'debug-session',
                        runId: 'run1',
                        hypothesisId: 'B',
                      }),
                    }).catch(() => {});
                    // #endregion

                    // Проверяем, изменилось ли количество блоков или структура (например, удалили изображение)
                    // Сравниваем количество блоков и их типы
                    let blocksChanged = false;
                    if (parsedBlocks.length !== blocks.length) {
                      blocksChanged = true;
                    } else {
                      // Проверяем, изменились ли типы блоков
                      for (let i = 0; i < parsedBlocks.length; i++) {
                        if (parsedBlocks[i].type !== blocks[i]?.type) {
                          blocksChanged = true;
                          break;
                        }
                      }
                    }

                    // Сохраняем в историю только при значимых изменениях (удаление/добавление блоков)
                    if (blocksChanged && saveToHistoryRef.current) {
                      saveToHistoryRef.current();
                    }

                    setBlocks(parsedBlocks);
                    scheduleAutoSave();
                  }}
                  onBlur={() => {
                    // #region agent log
                    fetch('http://127.0.0.1:7242/ingest/0d98fd1d-24ff-4297-901e-115ee9f70125', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        location: 'EditArticleModal.tsx:1306',
                        message: 'ContentEditable onBlur',
                        data: {
                          hasRef: !!contentEditableRef.current,
                          finalHtmlLength: contentEditableRef.current?.innerHTML?.length,
                        },
                        timestamp: Date.now(),
                        sessionId: 'debug-session',
                        runId: 'run1',
                        hypothesisId: 'C',
                      }),
                    }).catch(() => {});
                    // #endregion
                    // При потере фокуса также обновляем блоки
                    if (contentEditableRef.current) {
                      const html = contentEditableRef.current.innerHTML;
                      const parsedBlocks = htmlToBlocks(html);
                      setBlocks(parsedBlocks);
                      scheduleAutoSave();
                    }
                  }}
                />

                {/* Тултип форматирования при выделении текста */}
                {formattingTooltip.show && (
                  <div
                    className={`edit-article-modal__formatting-tooltip ${
                      formattingTooltip.visible
                        ? 'edit-article-modal__formatting-tooltip--visible'
                        : ''
                    }`}
                    style={{
                      left: `${formattingTooltip.x}px`,
                      top: `${formattingTooltip.y}px`,
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      className="edit-article-modal__formatting-button"
                      onClick={() => applyFormatting('link')}
                      title={lang === 'ru' ? 'Сделать ссылкой' : 'Make link'}
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                      </svg>
                    </button>
                    <div className="edit-article-modal__formatting-separator" />
                    <button
                      type="button"
                      className="edit-article-modal__formatting-button"
                      onClick={() => applyFormatting('h1')}
                      title={lang === 'ru' ? 'Заголовок первого уровня' : 'Heading 1'}
                    >
                      <strong>H</strong>
                    </button>
                    <button
                      type="button"
                      className="edit-article-modal__formatting-button edit-article-modal__formatting-button--active"
                      onClick={() => applyFormatting('h2')}
                      title={lang === 'ru' ? 'Заголовок второго уровня' : 'Heading 2'}
                    >
                      H
                    </button>
                    <button
                      type="button"
                      className="edit-article-modal__formatting-button"
                      onClick={() => applyFormatting('h3')}
                      title={lang === 'ru' ? 'Заголовок третьего уровня' : 'Heading 3'}
                    >
                      <span style={{ fontSize: '12px' }}>H3</span>
                    </button>
                    <button
                      type="button"
                      className="edit-article-modal__formatting-button"
                      onClick={() => applyFormatting('h4')}
                      title={lang === 'ru' ? 'Заголовок четвёртого уровня' : 'Heading 4'}
                    >
                      <span style={{ fontSize: '12px' }}>H4</span>
                    </button>
                    <div className="edit-article-modal__formatting-separator" />
                    <button
                      type="button"
                      className="edit-article-modal__formatting-button"
                      onClick={() => applyFormatting('paragraph')}
                      title={lang === 'ru' ? 'Параграф' : 'Paragraph'}
                    >
                      <span style={{ fontSize: '12px' }}>P</span>
                    </button>
                    <button
                      type="button"
                      className="edit-article-modal__formatting-button"
                      onClick={() => applyFormatting('bold')}
                      title={lang === 'ru' ? 'Жирный текст' : 'Bold'}
                    >
                      <strong>B</strong>
                    </button>
                    <button
                      type="button"
                      className="edit-article-modal__formatting-button"
                      onClick={() => applyFormatting('italic')}
                      title={lang === 'ru' ? 'Курсив' : 'Italic'}
                    >
                      <em>I</em>
                    </button>
                    <div className="edit-article-modal__formatting-separator" />
                    <button
                      type="button"
                      className="edit-article-modal__formatting-button"
                      onClick={() => applyFormatting('list')}
                      title={lang === 'ru' ? 'Элемент списка' : 'List item'}
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <line x1="8" y1="6" x2="21" y2="6" />
                        <line x1="8" y1="12" x2="21" y2="12" />
                        <line x1="8" y1="18" x2="21" y2="18" />
                        <line x1="3" y1="6" x2="3.01" y2="6" />
                        <line x1="3" y1="12" x2="3.01" y2="12" />
                        <line x1="3" y1="18" x2="3.01" y2="18" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="edit-article-modal__formatting-button"
                      onClick={() => applyFormatting('quote')}
                      title={lang === 'ru' ? 'Цитата' : 'Quote'}
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z" />
                        <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z" />
                      </svg>
                    </button>
                  </div>
                )}

                {/* Поле ввода с плюсиком и панель инструментов */}
                <div className="edit-article-modal__add-blocks">
                  <div className="edit-article-modal__text-input-wrapper">
                    <button
                      type="button"
                      className="edit-article-modal__add-button"
                      onClick={() => setShowToolbar(!showToolbar)}
                    >
                      +
                    </button>
                    <textarea
                      ref={textInputRef}
                      className="edit-article-modal__text-input"
                      placeholder={lang === 'ru' ? 'Начните вводить текст...' : 'Start typing...'}
                      value={newTextContent}
                      onChange={(e) => setNewTextContent(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          addTextBlockFromInput();
                        }
                      }}
                      onBlur={() => {
                        // Сохраняем текст при потере фокуса
                        if (newTextContent.trim()) {
                          addTextBlockFromInput();
                        }
                      }}
                      rows={1}
                      style={{
                        minHeight: '40px',
                        resize: 'none',
                        overflow: 'hidden',
                      }}
                      onInput={(e) => {
                        const target = e.target as HTMLTextAreaElement;
                        target.style.height = 'auto';
                        target.style.height = `${target.scrollHeight}px`;
                      }}
                    />
                  </div>
                  {showToolbar && (
                    <div className="edit-article-modal__toolbar">
                      <button
                        type="button"
                        className="edit-article-modal__toolbar-button"
                        onClick={() => {
                          fileInputRef.current?.click();
                          setShowToolbar(false);
                        }}
                        title={lang === 'ru' ? 'Добавить изображение' : 'Add image'}
                      >
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                          <circle cx="8.5" cy="8.5" r="1.5" />
                          <polyline points="21 15 16 10 5 21" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        className="edit-article-modal__toolbar-button"
                        onClick={addDivider}
                        title={lang === 'ru' ? 'Добавить разделитель' : 'Add divider'}
                      >
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <line x1="3" y1="12" x2="21" y2="12" />
                        </svg>
                      </button>
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        handleImageFromToolbar(file);
                        e.target.value = '';
                      }
                    }}
                  />
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
