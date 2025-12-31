// src/pages/UserDashboard/UserDashboard.tsx

import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useLang } from '@app/providers/lang';
import { useAppSelector } from '@shared/lib/hooks/useAppSelector';
import { useAppDispatch } from '@shared/lib/hooks/useAppDispatch';
import { selectUiDictionaryFirst } from '@shared/model/uiDictionary';
import type { SupportedLang } from '@shared/model/lang';
import clsx from 'clsx';
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
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { getUserImageUrl, formatDate } from '@shared/api/albums';
import { Popup } from '@shared/ui/popup';
import { Hamburger } from '@shared/ui/hamburger';
import { ConfirmationModal } from '@shared/ui/confirmationModal';
import { AlertModal } from '@shared/ui/alertModal';
import { logout, isAuthenticated, getUser, getToken } from '@shared/lib/auth';
import {
  fetchAlbums,
  selectAlbumsStatus,
  selectAlbumsData,
  selectAlbumsError,
} from '@entities/album';
import {
  fetchArticles,
  selectArticlesStatus,
  selectArticlesData,
  selectArticlesError,
} from '@entities/article';
import { loadTrackTextFromDatabase, saveTrackText } from '@entities/track/lib';
import { uploadFile } from '@shared/api/storage';
import { loadAuthorshipFromStorage, loadSyncedLyricsFromStorage } from '@features/syncedLyrics/lib';
import { uploadTracks, prepareAndUploadTrack, type TrackUploadData } from '@shared/api/tracks';
import { AddLyricsModal } from './components/AddLyricsModal';
import { EditLyricsModal } from './components/EditLyricsModal';
import { PreviewLyricsModal } from './components/PreviewLyricsModal';
import { EditAlbumModal, type AlbumFormData } from './components/EditAlbumModal';
import { EditArticleModalV2 } from './components/EditArticleModalV2';
import { ArticlesListSkeleton } from './components/ArticlesListSkeleton';
import { SyncLyricsModal } from './components/SyncLyricsModal';
import { ProfileSettingsModal } from './components/ProfileSettingsModal';
import { PaymentSettings } from '@features/paymentSettings/ui/PaymentSettings';
import { MyPurchasesContent } from './components/MyPurchasesContent';
import type { IAlbums, IArticles } from '@models';
import { getCachedAuthorship, setCachedAuthorship } from '@shared/lib/utils/authorshipCache';
import {
  transformAlbumsToAlbumData,
  type AlbumData,
  type TrackData,
} from '@entities/album/lib/transformAlbumData';
import { useAvatar } from '@shared/lib/hooks/useAvatar';
import './UserDashboard.style.scss';
const LANG_OPTIONS: SupportedLang[] = ['en', 'ru'];

// Компонент для сортируемого трека
interface SortableTrackItemProps {
  track: TrackData;
  albumId: string;
  onDelete: (albumId: string, trackId: string, trackTitle: string) => void;
  onTitleChange?: (albumId: string, trackId: string, newTitle: string) => Promise<void>;
}

// Функция для извлечения первых двух строк текста из блоков статьи
function getArticlePreviewText(article: IArticles): string {
  if (!article.details || !Array.isArray(article.details)) {
    return '';
  }

  const textParts: string[] = [];

  for (const block of article.details) {
    if (!block) continue;

    const blockType = (block as any).type;

    // Старый формат: type: 'text' с content
    if (blockType === 'text') {
      const content = (block as any).content;
      const strong = (block as any).strong;

      // Добавляем strong, если есть
      if (strong && typeof strong === 'string' && strong.trim()) {
        textParts.push(strong.trim());
      }

      // Добавляем content
      if (typeof content === 'string' && content.trim()) {
        textParts.push(content.trim());
      } else if (Array.isArray(content)) {
        const textStr = content.filter((item) => typeof item === 'string' && item.trim()).join(' ');
        if (textStr) {
          textParts.push(textStr);
        }
      }
    }
    // Новый формат: type: 'paragraph', 'quote'
    else if (blockType === 'paragraph' || blockType === 'quote') {
      const text = (block as any).text;
      if (typeof text === 'string' && text.trim()) {
        // Убираем markdown разметку для превью
        const cleanText = text
          .replace(/\*\*(.*?)\*\*/g, '$1') // Убираем **bold**
          .replace(/_(.*?)_/g, '$1') // Убираем _italic_
          .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Убираем [link](url)
          .trim();
        if (cleanText) {
          textParts.push(cleanText);
        }
      }
    }
    // Списки
    else if (blockType === 'list') {
      const items = (block as any).items;
      if (Array.isArray(items)) {
        const listText = items.filter((item) => typeof item === 'string' && item.trim()).join(' ');
        if (listText) {
          textParts.push(listText);
        }
      }
    }

    // Если уже набрали достаточно текста (примерно 2 строки = 150-200 символов)
    const combinedText = textParts.join(' ');
    if (combinedText.length >= 150) {
      break;
    }
  }

  const fullText = textParts.join(' ');

  if (!fullText) {
    return '';
  }

  // Берем первые ~150 символов или до конца, если меньше
  let preview = fullText.substring(0, 150);

  // Обрезаем по последнему пробелу, чтобы не обрезать слово
  const lastSpace = preview.lastIndexOf(' ');
  if (lastSpace > 100 && fullText.length > 150) {
    preview = preview.substring(0, lastSpace);
  }

  // Добавляем троеточие, если текст был обрезан
  if (fullText.length > preview.length) {
    preview += '...';
  }

  return preview;
}

function SortableTrackItem({ track, albumId, onDelete, onTitleChange }: SortableTrackItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: track.id,
  });

  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(track.title);
  const inputRef = useRef<HTMLInputElement>(null);

  // Синхронизируем editedTitle с track.title при изменении track
  useEffect(() => {
    if (!isEditing) {
      setEditedTitle(track.title);
    }
  }, [track.title, isEditing]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleTitleClick = () => {
    setIsEditing(true);
    setEditedTitle(track.title);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleTitleBlur = async () => {
    if (editedTitle.trim() !== track.title && editedTitle.trim() !== '' && onTitleChange) {
      // Сохраняем изменения
      await onTitleChange(albumId, track.id, editedTitle.trim());
    } else if (editedTitle.trim() === '') {
      // Если поле пустое, возвращаем исходное значение
      setEditedTitle(track.title);
    }
    setIsEditing(false);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      inputRef.current?.blur();
    } else if (e.key === 'Escape') {
      setEditedTitle(track.title);
      setIsEditing(false);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={clsx('user-dashboard__track-item', {
        'user-dashboard__track-item--dragging': isDragging,
      })}
    >
      <div
        {...attributes}
        {...listeners}
        className="user-dashboard__track-drag-handle"
        title="Перетащите для изменения порядка"
        aria-label="Перетащите для изменения порядка"
      >
        <span className="user-dashboard__track-drag-icon">⋮⋮</span>
      </div>
      <div className="user-dashboard__track-number">{track.id.padStart(2, '0')}</div>
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          className="user-dashboard__track-title-input"
          value={editedTitle}
          onChange={(e) => setEditedTitle(e.target.value)}
          onBlur={handleTitleBlur}
          onKeyDown={handleTitleKeyDown}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        />
      ) : (
        <div
          className="user-dashboard__track-title"
          onClick={handleTitleClick}
          title="Нажмите для редактирования"
        >
          {track.title}
        </div>
      )}
      <div className="user-dashboard__track-duration-container">
        <div className="user-dashboard__track-duration">{track.duration}</div>
        {!isEditing && (
          <button
            type="button"
            className="user-dashboard__track-delete-button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(albumId, track.id, track.title);
            }}
            title="Удалить трек"
            aria-label="Удалить трек"
          >
            Удалить трек
          </button>
        )}
      </div>
    </div>
  );
}

function UserDashboard() {
  const { lang, setLang } = useLang();
  const dispatch = useAppDispatch();
  const ui = useAppSelector((state) => selectUiDictionaryFirst(state, lang));
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const albumsStatus = useAppSelector((state) => selectAlbumsStatus(state, lang));
  const albumsError = useAppSelector((state) => selectAlbumsError(state, lang));
  const albumsFromStore = useAppSelector((state) => selectAlbumsData(state, lang));
  const articlesStatus = useAppSelector((state) => selectArticlesStatus(state, lang));
  const articlesError = useAppSelector((state) => selectArticlesError(state, lang));
  const articlesFromStore = useAppSelector((state) => selectArticlesData(state, lang));
  const user = getUser();

  // Получаем вкладку из URL параметра или используем значение по умолчанию
  const tabParam = searchParams.get('tab');
  const validTabs: Array<'albums' | 'posts' | 'payment-settings' | 'my-purchases'> = [
    'albums',
    'posts',
    'payment-settings',
    'my-purchases',
  ];
  const initialTab =
    tabParam && validTabs.includes(tabParam as any)
      ? (tabParam as 'albums' | 'posts' | 'payment-settings' | 'my-purchases')
      : 'albums';

  const [activeTab, setActiveTab] = useState<
    'albums' | 'posts' | 'payment-settings' | 'my-purchases'
  >(initialTab);
  const [isProfileSettingsModalOpen, setIsProfileSettingsModalOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);
  const [expandedAlbumId, setExpandedAlbumId] = useState<string | null>(null);
  const [expandedArticleId, setExpandedArticleId] = useState<string | null>(null);
  const [albumsData, setAlbumsData] = useState<AlbumData[]>([]);
  const [editArticleModal, setEditArticleModal] = useState<{
    isOpen: boolean;
    article: IArticles | null;
  } | null>(null);
  const [isLoadingTracks, setIsLoadingTracks] = useState<boolean>(false);
  const [isUploadingTracks, setIsUploadingTracks] = useState<{ [albumId: string]: boolean }>({});
  const [uploadProgress, setUploadProgress] = useState<{ [albumId: string]: number }>({});
  const fileInputRefs = useRef<{ [albumId: string]: HTMLInputElement | null }>({});
  const { avatarSrc, isUploadingAvatar, avatarInputRef, handleAvatarClick, handleAvatarChange } =
    useAvatar();
  const [addLyricsModal, setAddLyricsModal] = useState<{
    isOpen: boolean;
    albumId: string;
    trackId: string;
    trackTitle: string;
  } | null>(null);
  const [editLyricsModal, setEditLyricsModal] = useState<{
    isOpen: boolean;
    albumId: string;
    trackId: string;
    trackTitle: string;
    trackStatus: TrackData['lyricsStatus'];
    hasSyncedLyrics?: boolean; // Есть ли синхронизированный текст
    initialLyrics?: string;
    initialAuthorship?: string;
  } | null>(null);
  const [previewLyricsModal, setPreviewLyricsModal] = useState<{
    isOpen: boolean;
    lyrics: string;
    syncedLyrics?: { text: string; startTime: number; endTime?: number }[];
    authorship?: string;
    trackSrc?: string;
  } | null>(null);
  const [syncLyricsModal, setSyncLyricsModal] = useState<{
    isOpen: boolean;
    albumId: string;
    trackId: string;
    trackTitle: string;
    trackSrc?: string;
    lyricsText?: string;
    authorship?: string;
  } | null>(null);
  const [editAlbumModal, setEditAlbumModal] = useState<{
    isOpen: boolean;
    albumId?: string;
  } | null>(null);

  const [confirmationModal, setConfirmationModal] = useState<{
    isOpen: boolean;
    title?: string;
    message: string;
    onConfirm: () => void;
    variant?: 'danger' | 'warning' | 'info';
  } | null>(null);
  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    title?: string;
    message: string;
    variant?: 'success' | 'error' | 'warning' | 'info';
  } | null>(null);

  // Состояние для загрузки обложки статьи
  const [articleCoverUpload, setArticleCoverUpload] = useState<{
    [articleId: string]: {
      preview: string | null;
      status: 'idle' | 'uploading' | 'uploaded' | 'error';
      progress: number;
      error: string | null;
      dragActive: boolean;
    };
  }>({});
  const articleCoverLocalPreviewRefs = useRef<{ [articleId: string]: string | null }>({});

  // Функции для загрузки обложки статьи
  const handleArticleCoverDrag = (articleId: string, e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setArticleCoverUpload((prev) => ({
        ...prev,
        [articleId]: {
          ...(prev[articleId] || {
            preview: null,
            status: 'idle',
            progress: 0,
            error: null,
            dragActive: false,
          }),
          dragActive: true,
        },
      }));
    }
    if (e.type === 'dragleave') {
      setArticleCoverUpload((prev) => ({
        ...prev,
        [articleId]: {
          ...(prev[articleId] || {
            preview: null,
            status: 'idle',
            progress: 0,
            error: null,
            dragActive: false,
          }),
          dragActive: false,
        },
      }));
    }
  };

  const handleArticleCoverDrop = async (articleId: string, e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setArticleCoverUpload((prev) => ({
      ...prev,
      [articleId]: {
        ...(prev[articleId] || {
          preview: null,
          status: 'idle',
          progress: 0,
          error: null,
          dragActive: false,
        }),
        dragActive: false,
      },
    }));

    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      await handleArticleCoverFileUpload(articleId, file);
    }
  };

  const handleArticleCoverFileInput = async (
    articleId: string,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      await handleArticleCoverFileUpload(articleId, file);
    }
    e.target.value = '';
  };

  const handleArticleCoverFileUpload = async (articleId: string, file: File) => {
    if (!file.type.startsWith('image/')) {
      setArticleCoverUpload((prev) => ({
        ...prev,
        [articleId]: {
          ...(prev[articleId] || {
            preview: null,
            status: 'idle',
            progress: 0,
            error: null,
            dragActive: false,
          }),
          status: 'error',
          error: ui?.dashboard?.pleaseSelectImageFile ?? 'Please select an image file',
        },
      }));
      return;
    }

    try {
      // Сброс
      setArticleCoverUpload((prev) => ({
        ...prev,
        [articleId]: {
          preview: null,
          status: 'uploading',
          progress: 0,
          error: null,
          dragActive: false,
        },
      }));

      // Локальное превью
      if (articleCoverLocalPreviewRefs.current[articleId]) {
        URL.revokeObjectURL(articleCoverLocalPreviewRefs.current[articleId]!);
      }
      articleCoverLocalPreviewRefs.current[articleId] = URL.createObjectURL(file);
      setArticleCoverUpload((prev) => ({
        ...prev,
        [articleId]: {
          ...(prev[articleId] || {
            preview: null,
            status: 'idle',
            progress: 0,
            error: null,
            dragActive: false,
          }),
          preview: articleCoverLocalPreviewRefs.current[articleId],
        },
      }));

      // Загружаем файл
      const { CURRENT_USER_CONFIG } = await import('@config/user');

      const fileExtension = file.name.split('.').pop() || 'jpg';
      const baseFileName = file.name.replace(/\.[^/.]+$/, '');
      const timestamp = Date.now();
      const fileName = `article_cover_${timestamp}_${baseFileName}.${fileExtension}`;

      setArticleCoverUpload((prev) => ({
        ...prev,
        [articleId]: {
          ...(prev[articleId] || {
            preview: null,
            status: 'idle',
            progress: 0,
            error: null,
            dragActive: false,
          }),
          progress: 30,
        },
      }));

      const url = await uploadFile({
        userId: CURRENT_USER_CONFIG.userId,
        file,
        category: 'articles',
        fileName,
      });

      setArticleCoverUpload((prev) => ({
        ...prev,
        [articleId]: {
          ...(prev[articleId] || {
            preview: null,
            status: 'idle',
            progress: 0,
            error: null,
            dragActive: false,
          }),
          progress: 90,
        },
      }));

      if (url) {
        // Извлекаем imageKey из URL
        const urlParts = url.split('/');
        const fileNameFromUrl = urlParts[urlParts.length - 1]?.split('?')[0] || '';
        const finalImageKey = fileNameFromUrl.replace(/\.(webp|jpg|jpeg|png)$/i, '');

        // Обновляем статью через API
        const token = getToken();
        if (token) {
          const article = articlesFromStore.find((a) => a.articleId === articleId);
          if (article && article.id) {
            const response = await fetch(`/api/articles-api?id=${encodeURIComponent(article.id)}`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                articleId: article.articleId,
                nameArticle: article.nameArticle,
                description: article.description,
                img: finalImageKey,
                date: article.date,
                details: article.details,
                lang: lang,
                isDraft: article.isDraft ?? true,
              }),
            });

            if (response.ok) {
              // Обновляем список статей
              dispatch(fetchArticles({ lang, force: true }));
            }
          }
        }

        // Освобождаем objectURL
        if (articleCoverLocalPreviewRefs.current[articleId]) {
          URL.revokeObjectURL(articleCoverLocalPreviewRefs.current[articleId]!);
          articleCoverLocalPreviewRefs.current[articleId] = null;
        }

        // Устанавливаем финальный URL
        setArticleCoverUpload((prev) => ({
          ...prev,
          [articleId]: {
            preview: url,
            status: 'uploaded',
            progress: 100,
            error: null,
            dragActive: false,
          },
        }));
      } else {
        setArticleCoverUpload((prev) => ({
          ...prev,
          [articleId]: {
            ...(prev[articleId] || {
              preview: null,
              status: 'idle',
              progress: 0,
              error: null,
              dragActive: false,
            }),
            status: 'error',
            error: ui?.dashboard?.failedToUploadCover ?? 'Failed to upload cover image',
          },
        }));
      }
    } catch (error) {
      console.error('Error uploading article cover:', error);
      setArticleCoverUpload((prev) => ({
        ...prev,
        [articleId]: {
          ...(prev[articleId] || {
            preview: null,
            status: 'idle',
            progress: 0,
            error: null,
            dragActive: false,
          }),
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      }));
    }
  };

  // Проверка авторизации
  useEffect(() => {
    if (!isAuthenticated()) {
      navigate('/auth', { replace: true });
    }
  }, [navigate]);

  // Загрузка альбомов
  useEffect(() => {
    if (albumsStatus === 'idle' || albumsStatus === 'failed') {
      dispatch(fetchAlbums({ lang })).catch((error: any) => {
        // ConditionError - это нормально, condition отменил запрос
        if (error?.name === 'ConditionError') {
          return;
        }
        console.error('Error fetching albums:', error);
      });
    }
  }, [dispatch, lang, albumsStatus]);

  // Загрузка статей при переключении на вкладку posts
  useEffect(() => {
    if (activeTab === 'posts' && (articlesStatus === 'idle' || articlesStatus === 'failed')) {
      dispatch(fetchArticles({ lang })).catch((error: any) => {
        if (error?.name === 'ConditionError') {
          return;
        }
        console.error('Error fetching articles:', error);
      });
    }
  }, [dispatch, lang, articlesStatus, activeTab]);

  // Преобразование данных из IAlbums[] в AlbumData[] и загрузка статусов треков
  useEffect(() => {
    if (!albumsFromStore || albumsFromStore.length === 0) {
      setAlbumsData([]);
      setIsLoadingTracks(false);
      return;
    }

    setIsLoadingTracks(true);
    const abortController = new AbortController();

    (async () => {
      try {
        // Преобразуем альбомы из Redux store в формат для UI
        const transformedAlbums = transformAlbumsToAlbumData(albumsFromStore);

        // Добавляем authorship из кеша для каждого трека
        transformedAlbums.forEach((album) => {
          album.tracks.forEach((track) => {
            if (!track.authorship) {
              const cachedAuthorship = getCachedAuthorship(album.albumId, track.id, lang);
              if (cachedAuthorship) {
                track.authorship = cachedAuthorship;
              }
            }
          });
        });

        // Обновляем локальное состояние из Redux store
        if (!abortController.signal.aborted) {
          setAlbumsData([...transformedAlbums]);
          setIsLoadingTracks(false);
        }
      } catch (error) {
        console.error('Ошибка загрузки данных альбомов:', error);
        if (!abortController.signal.aborted) {
          setIsLoadingTracks(false);
        }
      }
    })();

    return () => {
      abortController.abort();
    };
  }, [albumsFromStore, lang]);

  // Закрываем меню языка при клике вне
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setLangOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Смена языка
  const changeLang = (newLang: SupportedLang) => {
    if (newLang !== lang) {
      setLang(newLang);
    }
    setLangOpen(false);
  };

  const toggleAlbum = (albumId: string) => {
    setExpandedAlbumId((prev) => (prev === albumId ? null : albumId));
  };

  // Настройка сенсоров для drag-and-drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Минимальное расстояние для начала перетаскивания (в пикселях)
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Обработка завершения перетаскивания трека
  const handleDragEnd = async (event: DragEndEvent, albumId: string) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const album = albumsData.find((a) => a.id === albumId);
    if (!album) return;

    const oldIndex = album.tracks.findIndex((track) => track.id === active.id);
    const newIndex = album.tracks.findIndex((track) => track.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    // Оптимистичное обновление UI
    const newTracks = arrayMove(album.tracks, oldIndex, newIndex);
    setAlbumsData((prevAlbums) =>
      prevAlbums.map((a) => (a.id === albumId ? { ...a, tracks: newTracks } : a))
    );

    // Сохраняем новый порядок в БД
    try {
      const token = getToken();
      if (!token) {
        setAlertModal({
          isOpen: true,
          title: 'Ошибка',
          message: 'Ошибка: вы не авторизованы. Пожалуйста, войдите в систему.',
          variant: 'error',
        });
        // Откатываем изменения
        setAlbumsData((prevAlbums) =>
          prevAlbums.map((a) => (a.id === albumId ? { ...a, tracks: album.tracks } : a))
        );
        return;
      }

      // Формируем массив с новыми order_index
      const trackOrders = newTracks.map((track, index) => ({
        trackId: track.id,
        orderIndex: index,
      }));

      const response = await fetch('/api/albums', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          albumId: album.albumId,
          lang,
          trackOrders,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error((errorData as any)?.error || `HTTP error! status: ${response.status}`);
      }

      // Обновляем данные из БД для синхронизации
      await dispatch(fetchAlbums({ lang, force: true })).unwrap();
      console.log('✅ Tracks reordered successfully');
    } catch (error) {
      console.error('❌ Error reordering tracks:', error);
      setAlertModal({
        isOpen: true,
        title: 'Ошибка',
        message: `Ошибка при изменении порядка треков: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: 'error',
      });
      // Откатываем изменения
      setAlbumsData((prevAlbums) =>
        prevAlbums.map((a) => (a.id === albumId ? { ...a, tracks: album.tracks } : a))
      );
    }
  };

  // Удаление трека
  const handleDeleteTrack = async (albumId: string, trackId: string, trackTitle: string) => {
    // Показываем модальное окно подтверждения
    setConfirmationModal({
      isOpen: true,
      title: 'Подтвердите действие',
      message: `Вы уверены, что хотите удалить трек "${trackTitle}"?`,
      variant: 'danger',
      onConfirm: async () => {
        setConfirmationModal(null);
        await performDeleteTrack(albumId, trackId);
      },
    });
  };

  // Обновление названия трека
  const handleTrackTitleChange = async (albumId: string, trackId: string, newTitle: string) => {
    try {
      const token = getToken();
      if (!token) {
        setAlertModal({
          isOpen: true,
          title: 'Ошибка',
          message: 'Ошибка: вы не авторизованы. Пожалуйста, войдите в систему.',
          variant: 'error',
        });
        return;
      }

      // Вызываем API для обновления названия
      const response = await fetch('/api/update-track-title', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          albumId,
          trackId,
          title: newTitle,
          lang,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error((errorData as any)?.message || `HTTP error! status: ${response.status}`);
      }

      // Обновляем локальное состояние
      setAlbumsData((prev) =>
        prev.map((album) =>
          album.albumId === albumId || album.id === albumId
            ? {
                ...album,
                tracks: album.tracks.map((t) => (t.id === trackId ? { ...t, title: newTitle } : t)),
              }
            : album
        )
      );

      console.log('✅ Track title updated successfully');
    } catch (error) {
      console.error('❌ Error updating track title:', error);
      setAlertModal({
        isOpen: true,
        title: 'Ошибка',
        message: `Ошибка при обновлении названия трека: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: 'error',
      });
      // Откатываем изменения в локальном состоянии
      await dispatch(fetchAlbums({ lang, force: true })).unwrap();
    }
  };

  const performDeleteTrack = async (albumId: string, trackId: string) => {
    try {
      const token = getToken();
      if (!token) {
        setAlertModal({
          isOpen: true,
          title: 'Ошибка',
          message: 'Ошибка: вы не авторизованы. Пожалуйста, войдите в систему.',
          variant: 'error',
        });
        return;
      }

      // Удаляем трек через API
      const response = await fetch(
        `/api/albums?trackId=${encodeURIComponent(trackId)}&albumId=${encodeURIComponent(albumId)}&lang=${encodeURIComponent(lang)}`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error((errorData as any)?.error || `HTTP error! status: ${response.status}`);
      }

      // Обновляем Redux store
      await dispatch(fetchAlbums({ lang, force: true })).unwrap();

      console.log('✅ Track deleted successfully:', { albumId, trackId });
    } catch (error) {
      console.error('❌ Error deleting track:', error);
      setAlertModal({
        isOpen: true,
        title: 'Ошибка',
        message: `Ошибка при удалении трека: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: 'error',
      });
    }
  };

  const handleDeleteAlbum = async (albumId: string) => {
    // Находим альбом для получения названия
    const album = albumsData.find((a) => a.id === albumId);
    const albumTitle = album?.title || albumId;

    // Показываем модальное окно подтверждения
    setConfirmationModal({
      isOpen: true,
      title: 'Подтвердите действие',
      message: `Вы уверены, что хотите удалить альбом "${albumTitle}"?`,
      variant: 'danger',
      onConfirm: async () => {
        setConfirmationModal(null);
        await performDeleteAlbum(albumId);
      },
    });
  };

  const handleDeleteArticle = async (article: IArticles) => {
    // Показываем модальное окно подтверждения
    setConfirmationModal({
      isOpen: true,
      title: ui?.dashboard?.confirmAction ?? 'Confirm action',
      message: (
        ui?.dashboard?.confirmDeleteArticle ??
        'Are you sure you want to delete the article "{name}"?'
      ).replace('{name}', article.nameArticle || article.articleId),
      variant: 'danger',
      onConfirm: async () => {
        setConfirmationModal(null);
        await performDeleteArticle(article);
      },
    });
  };

  const performDeleteArticle = async (article: IArticles) => {
    try {
      const token = getToken();
      if (!token) {
        setAlertModal({
          isOpen: true,
          title: ui?.dashboard?.error ?? 'Error',
          message:
            ui?.dashboard?.errorNotAuthorized ?? 'Error: you are not authorized. Please log in.',
          variant: 'error',
        });
        return;
      }

      // Нужен UUID id статьи для удаления
      if (!article.id) {
        setAlertModal({
          isOpen: true,
          title: ui?.dashboard?.error ?? 'Error',
          message:
            ui?.dashboard?.errorArticleIdNotFound ??
            'Error: could not find article ID for deletion.',
          variant: 'error',
        });
        return;
      }

      // Удаляем статью через API
      const response = await fetch(`/api/articles-api?id=${encodeURIComponent(article.id)}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error((errorData as any)?.error || `HTTP error! status: ${response.status}`);
      }

      // Обновляем Redux store
      await dispatch(fetchArticles({ lang, force: true })).unwrap();

      // Закрываем расширенный вид, если удаленная статья была открыта
      if (expandedArticleId === article.articleId) {
        setExpandedArticleId(null);
      }

      console.log('✅ Article deleted successfully:', article.articleId);
    } catch (error) {
      console.error('❌ Error deleting article:', error);
      setAlertModal({
        isOpen: true,
        title: ui?.dashboard?.error ?? 'Error',
        message: `${ui?.dashboard?.errorDeletingArticle ?? 'Error deleting article'}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: 'error',
      });
    }
  };

  const performDeleteAlbum = async (albumId: string) => {
    try {
      const token = getToken();
      if (!token) {
        setAlertModal({
          isOpen: true,
          title: 'Ошибка',
          message: 'Ошибка: вы не авторизованы. Пожалуйста, войдите в систему.',
          variant: 'error',
        });
        return;
      }

      // Удаляем альбом через API
      const response = await fetch('/api/albums', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          albumId,
          lang,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error((errorData as any)?.error || `HTTP error! status: ${response.status}`);
      }

      // Обновляем Redux store
      await dispatch(fetchAlbums({ lang, force: true })).unwrap();

      // Удаляем альбом из локального состояния
      setAlbumsData((prev) => prev.filter((a) => a.id !== albumId));

      // Закрываем расширенный вид, если удаленный альбом был открыт
      if (expandedAlbumId === albumId) {
        setExpandedAlbumId(null);
      }

      console.log('✅ Album deleted successfully:', albumId);
    } catch (error) {
      console.error('❌ Error deleting album:', error);
      setAlertModal({
        isOpen: true,
        title: 'Ошибка',
        message: `Ошибка при удалении альбома: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: 'error',
      });
    }
  };

  // Обработка загрузки треков
  const handleTrackUpload = async (albumId: string, files: FileList) => {
    if (isUploadingTracks[albumId]) {
      return;
    }

    setIsUploadingTracks((prev) => ({ ...prev, [albumId]: true }));
    setUploadProgress((prev) => ({ ...prev, [albumId]: 0 }));

    try {
      // Находим альбом в albumsFromStore для получения данных
      const albumFromStore = albumsFromStore.find((a) => a.albumId === albumId);
      if (!albumFromStore) {
        throw new Error('Album not found');
      }

      // Загружаем файлы и подготавливаем метаданные для каждого трека
      const tracksData: TrackUploadData[] = [];
      const fileArray = Array.from(files);

      // Получаем текущее количество треков в альбоме для правильной нумерации
      const currentAlbum = albumsData.find((a) => a.id === albumId);
      const existingTracksCount = currentAlbum?.tracks?.length || 0;
      const startTrackNumber = existingTracksCount + 1;

      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i];
        // Генерируем trackId начиная с существующего количества + 1
        const trackId = String(startTrackNumber + i);

        // Обновляем прогресс: загрузка файла (0-80% для всех файлов)
        const fileProgressStart = (i / fileArray.length) * 80;
        const fileProgressEnd = ((i + 1) / fileArray.length) * 80;
        setUploadProgress((prev) => ({ ...prev, [albumId]: fileProgressStart }));

        // orderIndex должен быть равен индексу в массиве всех треков (существующие + новые)
        const orderIndex = existingTracksCount + i;

        try {
          const trackData = await prepareAndUploadTrack(file, albumId, trackId, orderIndex);
          tracksData.push(trackData);

          // Обновляем прогресс после успешной загрузки файла
          setUploadProgress((prev) => ({ ...prev, [albumId]: fileProgressEnd }));
        } catch (error) {
          console.error(`❌ [handleTrackUpload] Error uploading track ${trackId}:`, error);
          // Продолжаем загрузку остальных треков, но не обновляем прогресс при ошибке
        }
      }

      // Обновляем прогресс: сохранение метаданных в БД (80-100%)
      setUploadProgress((prev) => ({ ...prev, [albumId]: 90 }));

      if (tracksData.length === 0) {
        throw new Error('Failed to upload any tracks');
      }

      // Загружаем треки
      const result = await uploadTracks(albumId, lang, tracksData);

      if (result.success && result.data) {
        const uploadedCount = Array.isArray(result.data) ? result.data.length : 0;

        // Обновляем прогресс: завершение (100%)
        setUploadProgress((prev) => ({ ...prev, [albumId]: 100 }));

        // Оптимистичное обновление: сразу добавляем новые треки в локальное состояние
        setAlbumsData((prevAlbums) => {
          return prevAlbums.map((album) => {
            if (album.albumId === albumId || album.id === albumId) {
              // Добавляем новые треки к существующим
              const newTracks: TrackData[] = tracksData.map((trackData) => ({
                id: trackData.trackId,
                title: trackData.title,
                duration: `${Math.floor(trackData.duration / 60)}:${Math.floor(
                  trackData.duration % 60
                )
                  .toString()
                  .padStart(2, '0')}`,
                lyricsStatus: 'empty' as const,
              }));

              return {
                ...album,
                tracks: [...album.tracks, ...newTracks],
              };
            }
            return album;
          });
        });

        // Обновляем список альбомов из БД для синхронизации
        // useEffect автоматически обновит albumsData когда albumsFromStore изменится
        try {
          // Небольшая задержка для гарантии обновления БД
          await new Promise((resolve) => setTimeout(resolve, 300));
          await dispatch(fetchAlbums({ lang, force: true })).unwrap();
          console.log('✅ [handleTrackUpload] Albums refreshed from database');
        } catch (fetchError: any) {
          // ConditionError - это нормально, condition отменил запрос
          if (fetchError?.name !== 'ConditionError') {
            console.error('⚠️ Failed to refresh albums:', fetchError);
          }
        }

        setAlertModal({
          isOpen: true,
          title: 'Успешно',
          message: `Successfully uploaded ${uploadedCount} track(s)`,
          variant: 'success',
        });
      } else {
        throw new Error(result.error || 'Failed to upload tracks');
      }
    } catch (error) {
      console.error('❌ Error uploading tracks:', error);
      setAlertModal({
        isOpen: true,
        title: 'Ошибка',
        message: `Error uploading tracks: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: 'error',
      });
    } finally {
      setIsUploadingTracks((prev) => {
        const newState = { ...prev };
        delete newState[albumId];
        return newState;
      });
      setUploadProgress((prev) => {
        const newState = { ...prev };
        delete newState[albumId];
        return newState;
      });
    }
  };

  const getLyricsStatusText = (status: TrackData['lyricsStatus']) => {
    switch (status) {
      case 'synced':
        return ui?.dashboard?.addedSynced ?? 'Added, synced';
      case 'text-only':
        return ui?.dashboard?.addedNoSync ?? 'Added, no sync';
      case 'empty':
        return ui?.dashboard?.noLyrics ?? 'No lyrics';
      default:
        return '';
    }
  };

  const getLyricsActions = (
    status: TrackData['lyricsStatus'],
    hasSyncedLyrics: boolean = false
  ) => {
    switch (status) {
      case 'synced': {
        const actions = [{ label: ui?.dashboard?.edit ?? 'Edit', action: 'edit' }];
        // Показываем Prev только если есть синхронизированный текст
        if (hasSyncedLyrics) {
          actions.push({ label: ui?.dashboard?.prev ?? 'Prev', action: 'prev' });
        }
        actions.push({ label: ui?.dashboard?.sync ?? 'Sync', action: 'sync' });
        return actions;
      }
      case 'text-only':
        return [
          { label: ui?.dashboard?.edit ?? 'Edit', action: 'edit' },
          { label: ui?.dashboard?.sync ?? 'Sync', action: 'sync' },
        ];
      case 'empty':
        return [{ label: ui?.dashboard?.add ?? 'Add', action: 'add' }];
      default:
        return [];
    }
  };

  const handleLyricsAction = async (
    action: string,
    albumId: string,
    trackId: string,
    trackTitle: string
  ) => {
    if (action === 'add') {
      setAddLyricsModal({ isOpen: true, albumId, trackId, trackTitle });
    } else if (action === 'edit') {
      const album = albumsData.find((a) => a.id === albumId);
      const track = album?.tracks.find((t) => t.id === trackId);
      if (track) {
        // Загружаем текст, authorship и syncedLyrics из БД для отображения в модальном окне
        const [storedText, storedAuthorship, storedSyncedLyrics] = await Promise.all([
          loadTrackTextFromDatabase(albumId, trackId, lang).catch(() => null),
          loadAuthorshipFromStorage(albumId, trackId, lang).catch(() => null),
          loadSyncedLyricsFromStorage(albumId, trackId, lang).catch(() => null),
        ]);

        const cachedAuthorship = getCachedAuthorship(albumId, trackId, lang);
        const fallbackAuthorship = track.authorship || cachedAuthorship;
        const fallbackText = track.lyricsText || '';

        const finalText = storedText || fallbackText;

        if (process.env.NODE_ENV === 'development') {
          console.log('[UserDashboard] Opening edit lyrics modal:', {
            albumId,
            trackId,
            storedTextLength: storedText?.length || 0,
            fallbackTextLength: fallbackText.length,
            finalTextLength: finalText.length,
            loadedFromDb: !!storedText,
            hasStoredSyncedLyrics: !!storedSyncedLyrics,
            storedSyncedLyricsLength: storedSyncedLyrics?.length || 0,
          });
        }

        // Проверяем наличие синхронизированного текста
        // Используем загруженные данные из БД, если они есть, иначе используем данные из track
        const syncedLyrics = storedSyncedLyrics || track.syncedLyrics;

        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/0d98fd1d-24ff-4297-901e-115ee9f70125', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            location: 'UserDashboard.tsx:742',
            message: 'Checking hasSyncedLyrics',
            data: {
              albumId,
              trackId,
              hasTrackSyncedLyrics: !!track.syncedLyrics,
              hasStoredSyncedLyrics: !!storedSyncedLyrics,
              syncedLyricsType: Array.isArray(syncedLyrics) ? 'array' : typeof syncedLyrics,
              syncedLyricsLength: Array.isArray(syncedLyrics) ? syncedLyrics.length : 0,
              syncedLyricsSample:
                Array.isArray(syncedLyrics) && syncedLyrics.length > 0
                  ? syncedLyrics.slice(0, 3).map((line: any) => ({
                      hasStartTime: 'startTime' in line,
                      startTime: line.startTime,
                      startTimeType: typeof line.startTime,
                      hasText: 'text' in line,
                    }))
                  : null,
              lyricsStatus: track.lyricsStatus,
            },
            timestamp: Date.now(),
            sessionId: 'debug-session',
            runId: 'run1',
            hypothesisId: 'A',
          }),
        }).catch(() => {});
        // #endregion

        // Проверяем наличие синхронизированного текста
        // Текст считается синхронизированным только если есть хотя бы одна строка с startTime > 0
        // (строки с startTime === 0 считаются несинхронизированными)
        const hasSyncedLyrics =
          Array.isArray(syncedLyrics) &&
          syncedLyrics.length > 0 &&
          syncedLyrics.some((line) => line.startTime > 0);

        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/0d98fd1d-24ff-4297-901e-115ee9f70125', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            location: 'UserDashboard.tsx:785',
            message: 'hasSyncedLyrics result - fixed check',
            data: {
              albumId,
              trackId,
              hasSyncedLyrics,
              willShowPreview: hasSyncedLyrics,
              willShowSync: !hasSyncedLyrics,
              syncedLyricsLength: Array.isArray(syncedLyrics) ? syncedLyrics.length : 0,
              hasStartTimeGreaterThanZero: Array.isArray(syncedLyrics)
                ? syncedLyrics.some((line) => line.startTime > 0)
                : false,
            },
            timestamp: Date.now(),
            sessionId: 'debug-session',
            runId: 'run1',
            hypothesisId: 'B',
          }),
        }).catch(() => {});
        // #endregion

        setEditLyricsModal({
          isOpen: true,
          albumId,
          trackId,
          trackTitle,
          trackStatus: track.lyricsStatus,
          hasSyncedLyrics,
          initialLyrics: finalText,
          initialAuthorship: storedAuthorship || fallbackAuthorship || undefined,
        });
      }
    } else if (action === 'prev') {
      const lyrics = getTrackLyricsText(albumId, trackId);

      // Загружаем синхронизированные тексты из БД
      const syncedLyrics = await loadSyncedLyricsFromStorage(albumId, trackId, lang).catch(
        () => null
      );

      // Загружаем авторство из БД
      const authorship = await loadAuthorshipFromStorage(albumId, trackId, lang).catch(() => null);

      const album = albumsData.find((a) => a.id === albumId);
      const track = album?.tracks.find((t) => t.id === trackId);

      console.log('[UserDashboard] Opening Preview Lyrics:', {
        albumId,
        trackId,
        trackSrc: track?.src,
        hasTrack: !!track,
        albumTracks: album?.tracks.map((t) => ({ id: t.id, src: t.src })),
        syncedLyricsCount: syncedLyrics?.length || 0,
      });

      setPreviewLyricsModal({
        isOpen: true,
        lyrics,
        syncedLyrics: syncedLyrics || undefined,
        authorship: authorship || undefined,
        trackSrc: track?.src,
      });
    } else if (action === 'sync') {
      const album = albumsData.find((a) => a.id === albumId);
      const track = album?.tracks.find((t) => t.id === trackId);
      if (track) {
        const lyricsText = getTrackLyricsText(albumId, trackId);
        setSyncLyricsModal({
          isOpen: true,
          albumId,
          trackId,
          trackTitle,
          trackSrc: track.src,
          lyricsText,
          authorship: track.authorship,
        });
      }
    }
  };

  const handleAddLyrics = async (lyrics: string, authorship?: string) => {
    if (!addLyricsModal) return;

    // Сохраняем текст и авторство в БД
    const album = albumsData.find((a) => a.id === addLyricsModal.albumId);
    if (album) {
      const result = await saveTrackText({
        albumId: addLyricsModal.albumId,
        trackId: addLyricsModal.trackId,
        lang,
        content: lyrics,
        authorship,
      });

      if (result.success) {
        setCachedAuthorship(addLyricsModal.albumId, addLyricsModal.trackId, lang, authorship);
        setAlbumsData((prev) =>
          prev.map((a) => {
            if (a.id === addLyricsModal.albumId) {
              return {
                ...a,
                tracks: a.tracks.map((track) =>
                  track.id === addLyricsModal.trackId
                    ? {
                        ...track,
                        lyricsStatus: 'text-only' as const,
                        lyricsText: lyrics,
                        authorship,
                      }
                    : track
                ),
              };
            }
            return a;
          })
        );
      } else {
        setAlertModal({
          isOpen: true,
          title: 'Ошибка',
          message: result.message || 'Ошибка при сохранении текста',
          variant: 'error',
        });
      }
    }

    setAddLyricsModal(null);
  };

  const handleSaveLyrics = async (lyrics: string, authorship?: string) => {
    if (!editLyricsModal) return;

    // Сохраняем текст и авторство в БД
    const album = albumsData.find((a) => a.id === editLyricsModal.albumId);
    if (album) {
      const result = await saveTrackText({
        albumId: editLyricsModal.albumId,
        trackId: editLyricsModal.trackId,
        lang,
        content: lyrics,
        authorship,
      });

      if (result.success) {
        setCachedAuthorship(editLyricsModal.albumId, editLyricsModal.trackId, lang, authorship);

        // Перезагружаем текст из БД, чтобы убедиться, что он сохранен корректно
        const savedText = await loadTrackTextFromDatabase(
          editLyricsModal.albumId,
          editLyricsModal.trackId,
          lang
        ).catch(() => null);

        // Используем сохраненный текст из БД, если он есть, иначе используем переданный текст
        const finalText = savedText || lyrics;

        // Обновляем albumsData с сохраненным текстом
        setAlbumsData((prev) =>
          prev.map((a) => {
            if (a.id === editLyricsModal.albumId) {
              return {
                ...a,
                tracks: a.tracks.map((track) =>
                  track.id === editLyricsModal.trackId
                    ? {
                        ...track,
                        lyricsText: finalText,
                        authorship,
                        lyricsStatus: 'text-only' as const,
                      }
                    : track
                ),
              };
            }
            return a;
          })
        );

        // Обновляем initialLyrics в состоянии модального окна ДО закрытия, чтобы изменения сразу отобразились
        // Это важно, если модалка остается открытой (хотя обычно она закрывается)
        setEditLyricsModal((prev) =>
          prev
            ? {
                ...prev,
                initialLyrics: finalText,
                initialAuthorship: authorship || prev.initialAuthorship,
              }
            : null
        );

        console.log('✅ Lyrics saved and albumsData updated:', {
          albumId: editLyricsModal.albumId,
          trackId: editLyricsModal.trackId,
          lyricsLength: finalText.length,
          loadedFromDb: !!savedText,
          finalText: finalText.substring(0, 50) + '...',
        });
      } else {
        setAlertModal({
          isOpen: true,
          title: 'Ошибка',
          message: result.message || 'Ошибка при сохранении текста',
          variant: 'error',
        });
      }
    }
  };

  const getTrackLyricsText = (albumId: string, trackId: string): string => {
    const album = albumsData.find((a) => a.id === albumId);
    const track = album?.tracks.find((t) => t.id === trackId);
    return track?.lyricsText || '';
  };

  const getTrackAuthorship = (albumId: string, trackId: string): string | undefined => {
    const album = albumsData.find((a) => a.id === albumId);
    const track = album?.tracks.find((t) => t.id === trackId);
    return track?.authorship;
  };

  const handlePreviewLyrics = async () => {
    if (!editLyricsModal) return;
    const { albumId, trackId } = editLyricsModal;
    const lyrics = getTrackLyricsText(albumId, trackId);

    // Загружаем синхронизированные тексты из БД
    const syncedLyrics = await loadSyncedLyricsFromStorage(albumId, trackId, lang).catch(
      () => null
    );

    // Загружаем авторство из БД
    const authorship = await loadAuthorshipFromStorage(albumId, trackId, lang).catch(() => null);

    const album = albumsData.find((a) => a.id === albumId);
    const track = album?.tracks.find((t) => t.id === trackId);

    setPreviewLyricsModal({
      isOpen: true,
      lyrics,
      syncedLyrics: syncedLyrics || undefined,
      authorship: authorship || undefined,
      trackSrc: track?.src,
    });
  };

  const handleSyncLyricsFromEdit = async (currentLyrics: string, currentAuthorship?: string) => {
    if (!editLyricsModal) return;
    const { albumId, trackId, trackTitle } = editLyricsModal;
    // Сначала сохраняем изменения текста
    await handleSaveLyrics(currentLyrics, currentAuthorship);
    // Закрываем модалку редактирования текста
    setEditLyricsModal(null);
    // Открываем модалку синхронизации с сохранённым текстом
    const album = albumsData.find((a) => a.id === albumId);
    const track = album?.tracks.find((t) => t.id === trackId);
    if (track) {
      // Используем переданный текст напрямую (он уже сохранён через handleSaveLyrics)
      setSyncLyricsModal({
        isOpen: true,
        albumId,
        trackId,
        trackTitle,
        trackSrc: track.src,
        lyricsText: currentLyrics,
        authorship: currentAuthorship,
      });
    }
  };

  // Показываем загрузку пока данные не загружены
  // Не показываем пустой дашборд - ждем данные
  if ((albumsStatus === 'loading' || albumsStatus === 'idle') && albumsData.length === 0) {
    return (
      <Popup isActive={true} onClose={() => navigate('/')}>
        <div className="user-dashboard">
          <div className="user-dashboard__card">
            <div className="user-dashboard__loading">Загрузка...</div>
          </div>
        </div>
      </Popup>
    );
  }

  if (albumsStatus === 'failed') {
    return (
      <Popup isActive={true} onClose={() => navigate('/')}>
        <div className="user-dashboard">
          <div className="user-dashboard__card">
            <div className="user-dashboard__error">
              Ошибка загрузки: {albumsError || 'Не удалось загрузить альбомы'}
            </div>
          </div>
        </div>
      </Popup>
    );
  }

  return (
    <>
      <Helmet>
        <title>{ui?.dashboard?.title ?? 'User Dashboard'} — Смоляное Чучелко</title>
      </Helmet>

      <Popup isActive={true} onClose={() => navigate('/')}>
        <div className="user-dashboard">
          {/* Main card container */}
          <div className="user-dashboard__card">
            {/* Header with tabs */}
            <div className="user-dashboard__header">
              <div className="user-dashboard__tabs">
                <button
                  type="button"
                  className={`user-dashboard__tab ${activeTab === 'albums' ? 'user-dashboard__tab--active' : ''}`}
                  onClick={() => setActiveTab('albums')}
                >
                  {ui?.dashboard?.tabs?.albums ?? 'Albums'}
                </button>
                <button
                  type="button"
                  className={`user-dashboard__tab ${activeTab === 'posts' ? 'user-dashboard__tab--active' : ''}`}
                  onClick={() => setActiveTab('posts')}
                >
                  {ui?.dashboard?.tabs?.posts ?? 'Articles'}
                </button>
                <button
                  type="button"
                  className={`user-dashboard__tab ${activeTab === 'payment-settings' ? 'user-dashboard__tab--active' : ''}`}
                  onClick={() => setActiveTab('payment-settings')}
                >
                  {ui?.dashboard?.tabs?.paymentSettings ?? 'Payment Settings'}
                </button>
                <button
                  type="button"
                  className={`user-dashboard__tab ${activeTab === 'my-purchases' ? 'user-dashboard__tab--active' : ''}`}
                  onClick={() => setActiveTab('my-purchases')}
                >
                  Мои покупки
                </button>
              </div>
              <div className="user-dashboard__header-controls">
                {/* Language switcher */}
                <div className="user-dashboard__lang-menu" ref={langRef}>
                  <button
                    type="button"
                    className="user-dashboard__lang-current"
                    onClick={() => setLangOpen(!langOpen)}
                    aria-haspopup="listbox"
                    aria-expanded={langOpen}
                    aria-label={`Выбрать язык. Текущий язык: ${lang === 'ru' ? (ui?.dashboard?.russian ?? 'Русский') : (ui?.dashboard?.english ?? 'English')}`}
                  >
                    {lang.toUpperCase()}
                  </button>
                  <ul
                    className={clsx('user-dashboard__lang-list', { 'is-hidden': !langOpen })}
                    role="listbox"
                  >
                    {LANG_OPTIONS.map((l) => (
                      <li key={l}>
                        <button
                          className={clsx('user-dashboard__lang-option', { active: lang === l })}
                          onClick={() => changeLang(l)}
                          role="option"
                          aria-selected={lang === l}
                        >
                          {l.toUpperCase()}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
                <button
                  type="button"
                  className="user-dashboard__logout-button"
                  onClick={() => {
                    logout();
                    navigate('/auth');
                  }}
                >
                  {ui?.dashboard?.logout ?? 'Logout'}
                </button>
              </div>
            </div>

            {/* Main layout */}
            <div className="user-dashboard__layout">
              {/* Left column - Profile */}
              <div className="user-dashboard__profile">
                <h3 className="user-dashboard__profile-title">
                  {ui?.dashboard?.profile ?? 'Profile'}
                </h3>

                <div className="user-dashboard__avatar">
                  <div
                    className="user-dashboard__avatar-img"
                    role="button"
                    tabIndex={0}
                    aria-label="Изменить аватар"
                    onClick={handleAvatarClick}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleAvatarClick();
                      }
                    }}
                  >
                    <img
                      src={avatarSrc}
                      alt={ui?.dashboard?.profile ?? 'Profile'}
                      onError={(e) => {
                        const img = e.target as HTMLImageElement;
                        const applied = img.dataset.fallbackApplied;

                        // 1) если фолбэк ещё не пробовали — пробуем дефолтный аватар
                        if (!applied) {
                          img.dataset.fallbackApplied = 'default';
                          img.src = '/images/avatar.png';
                          return;
                        }

                        // 2) если и дефолтный не загрузился — скрываем
                        img.style.display = 'none';
                      }}
                    />
                    {isUploadingAvatar && (
                      <div
                        className="user-dashboard__avatar-loader"
                        aria-live="polite"
                        aria-busy="true"
                      >
                        <div className="user-dashboard__avatar-spinner"></div>
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    className="user-dashboard__avatar-edit"
                    onClick={handleAvatarClick}
                    disabled={isUploadingAvatar}
                    aria-label="Изменить аватар"
                  >
                    ✎
                  </button>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    style={{
                      position: 'absolute',
                      width: '1px',
                      height: '1px',
                      opacity: 0,
                      pointerEvents: 'none',
                    }}
                    onChange={handleAvatarChange}
                  />
                </div>

                <div className="user-dashboard__profile-fields">
                  <div className="user-dashboard__field">
                    <label htmlFor="name">{ui?.dashboard?.profileFields?.name ?? 'Name'}</label>
                    <input id="name" type="text" defaultValue={user?.name || ''} disabled />
                  </div>

                  <div className="user-dashboard__field">
                    <label htmlFor="email">{ui?.dashboard?.profileFields?.email ?? 'Email'}</label>
                    <input id="email" type="email" defaultValue={user?.email || ''} disabled />
                  </div>
                </div>

                <button
                  type="button"
                  className="user-dashboard__profile-settings-button"
                  onClick={() => setIsProfileSettingsModalOpen(true)}
                >
                  {ui?.dashboard?.profileSettings ?? 'Настройки профиля'}
                </button>
              </div>

              {/* Vertical separator */}
              <div className="user-dashboard__separator"></div>

              {/* Right column - Content */}
              <div className="user-dashboard__content">
                {activeTab === 'payment-settings' ? (
                  <PaymentSettings userId={user?.id || 'zhoock'} />
                ) : activeTab === 'my-purchases' ? (
                  <MyPurchasesContent userEmail={user?.email} />
                ) : activeTab === 'albums' ? (
                  <>
                    <h3 className="user-dashboard__section-title">
                      {ui?.dashboard?.tabs?.albums ?? 'Albums'}
                    </h3>
                    <div className="user-dashboard__section">
                      {albumsData.length > 0 ? (
                        <>
                          <div className="user-dashboard__albums-list">
                            {albumsData.map((album, index) => {
                              const isExpanded = expandedAlbumId === album.id;
                              return (
                                <React.Fragment key={album.id}>
                                  <div
                                    className={`user-dashboard__album-item ${isExpanded ? 'user-dashboard__album-item--expanded' : ''}`}
                                    onClick={() => toggleAlbum(album.id)}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        toggleAlbum(album.id);
                                      }
                                    }}
                                    aria-label={isExpanded ? 'Collapse album' : 'Expand album'}
                                  >
                                    <div className="user-dashboard__album-thumbnail">
                                      {album.cover ? (
                                        <img
                                          key={`cover-${album.id}-${album.cover}-${album.coverUpdatedAt || ''}`}
                                          src={`${getUserImageUrl(album.cover, 'albums', '-128.webp')}&v=${album.cover}${album.coverUpdatedAt ? `-${album.coverUpdatedAt}` : ''}`}
                                          alt={album.title}
                                          onError={(e) => {
                                            const img = e.target as HTMLImageElement;
                                            // При ошибке загрузки добавляем timestamp для принудительной перезагрузки
                                            const currentSrc = img.src;
                                            if (!currentSrc.includes('&_retry=')) {
                                              img.src = `${currentSrc.split('&v=')[0]}&v=${album.cover}&_retry=${Date.now()}`;
                                            }
                                          }}
                                        />
                                      ) : (
                                        <img
                                          src="/images/album-placeholder.png"
                                          alt={album.title}
                                        />
                                      )}
                                    </div>
                                    <div className="user-dashboard__album-info">
                                      <div className="user-dashboard__album-title">
                                        {album.title}
                                      </div>
                                      {album.releaseDate ? (
                                        <div className="user-dashboard__album-date">
                                          {album.releaseDate}
                                        </div>
                                      ) : (
                                        <div className="user-dashboard__album-year">
                                          {album.year}
                                        </div>
                                      )}
                                    </div>
                                    <div
                                      className={`user-dashboard__album-arrow ${isExpanded ? 'user-dashboard__album-arrow--expanded' : ''}`}
                                    >
                                      {isExpanded ? '⌃' : '›'}
                                    </div>
                                  </div>

                                  {isExpanded && (
                                    <div className="user-dashboard__album-expanded">
                                      {/* Edit Album button */}
                                      <button
                                        type="button"
                                        className="user-dashboard__edit-album-button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEditAlbumModal({ isOpen: true, albumId: album.id });
                                        }}
                                      >
                                        {ui?.dashboard?.editAlbum ?? 'Edit Album'}
                                      </button>

                                      {/* Track upload section */}
                                      <div
                                        className="user-dashboard__track-upload"
                                        onDrop={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          const files = e.dataTransfer.files;
                                          if (files.length > 0) {
                                            handleTrackUpload(album.id, files);
                                          }
                                        }}
                                        onDragOver={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                        }}
                                        onDragEnter={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                        }}
                                      >
                                        {isUploadingTracks[album.id] ? (
                                          <div className="user-dashboard__track-upload-progress">
                                            <div className="user-dashboard__track-upload-text">
                                              Uploading tracks...{' '}
                                              {Math.round(uploadProgress[album.id] || 0)}%
                                            </div>
                                            <div className="user-dashboard__track-upload-progress-bar">
                                              <div
                                                className="user-dashboard__track-upload-progress-fill"
                                                style={{
                                                  width: `${uploadProgress[album.id] || 0}%`,
                                                  transition: 'width 0.3s ease',
                                                }}
                                              />
                                            </div>
                                          </div>
                                        ) : (
                                          <>
                                            <div className="user-dashboard__track-upload-text">
                                              {ui?.dashboard?.dropTracksHere ??
                                                'Drop tracks here or'}
                                            </div>
                                            <input
                                              ref={(el) => {
                                                fileInputRefs.current[album.id] = el;
                                              }}
                                              type="file"
                                              multiple
                                              accept="audio/*"
                                              style={{ display: 'none' }}
                                              onChange={(e) => {
                                                const files = e.target.files;
                                                if (files && files.length > 0) {
                                                  handleTrackUpload(album.id, files);
                                                }
                                                // Сбрасываем input, чтобы можно было загрузить те же файлы снова
                                                if (e.target) {
                                                  e.target.value = '';
                                                }
                                              }}
                                            />
                                            <button
                                              type="button"
                                              className="user-dashboard__choose-files-button"
                                              disabled={isUploadingTracks[album.id]}
                                              onClick={() => {
                                                const input = fileInputRefs.current[album.id];
                                                if (input) {
                                                  input.click();
                                                }
                                              }}
                                            >
                                              {ui?.dashboard?.chooseFiles ?? 'Choose files'}
                                            </button>
                                          </>
                                        )}
                                      </div>

                                      {/* Tracks list with drag-and-drop */}
                                      <DndContext
                                        sensors={sensors}
                                        collisionDetection={closestCenter}
                                        onDragEnd={(event) => handleDragEnd(event, album.id)}
                                      >
                                        <SortableContext
                                          items={album.tracks.map((track) => track.id)}
                                          strategy={verticalListSortingStrategy}
                                        >
                                          <div className="user-dashboard__tracks-list">
                                            {album.tracks.map((track) => (
                                              <SortableTrackItem
                                                key={track.id}
                                                track={track}
                                                albumId={album.albumId}
                                                onDelete={handleDeleteTrack}
                                                onTitleChange={handleTrackTitleChange}
                                              />
                                            ))}
                                          </div>
                                        </SortableContext>
                                      </DndContext>

                                      {/* Lyrics section */}
                                      <div className="user-dashboard__lyrics-section">
                                        <h4 className="user-dashboard__lyrics-title">
                                          {ui?.dashboard?.lyrics ?? 'Lyrics'}
                                        </h4>
                                        <div className="user-dashboard__lyrics-table">
                                          <div className="user-dashboard__lyrics-header">
                                            <div className="user-dashboard__lyrics-header-cell">
                                              {ui?.dashboard?.track ?? 'Track'}
                                            </div>
                                            <div className="user-dashboard__lyrics-header-cell">
                                              {ui?.dashboard?.status ?? 'Status'}
                                            </div>
                                            <div className="user-dashboard__lyrics-header-cell">
                                              {ui?.dashboard?.actions ?? 'Actions'}
                                            </div>
                                          </div>
                                          {album.tracks.map((track) => (
                                            <div
                                              key={track.id}
                                              className="user-dashboard__lyrics-row"
                                            >
                                              <div className="user-dashboard__lyrics-cell">
                                                {track.title}
                                              </div>
                                              <div className="user-dashboard__lyrics-cell">
                                                {getLyricsStatusText(track.lyricsStatus)}
                                              </div>
                                              <div className="user-dashboard__lyrics-cell user-dashboard__lyrics-cell--actions">
                                                {(() => {
                                                  // Вычисляем hasSyncedLyrics для логирования
                                                  const hasSyncedLyrics =
                                                    Array.isArray(track.syncedLyrics) &&
                                                    track.syncedLyrics.length > 0 &&
                                                    track.syncedLyrics.some(
                                                      (line) => line.startTime > 0
                                                    );

                                                  // #region agent log
                                                  if (track.lyricsStatus === 'synced') {
                                                    fetch(
                                                      'http://127.0.0.1:7242/ingest/0d98fd1d-24ff-4297-901e-115ee9f70125',
                                                      {
                                                        method: 'POST',
                                                        headers: {
                                                          'Content-Type': 'application/json',
                                                        },
                                                        body: JSON.stringify({
                                                          location: 'UserDashboard.tsx:1463',
                                                          message:
                                                            'Checking hasSyncedLyrics in dashboard',
                                                          data: {
                                                            albumId: album.albumId,
                                                            trackId: track.id,
                                                            lyricsStatus: track.lyricsStatus,
                                                            hasSyncedLyrics: !!track.syncedLyrics,
                                                            syncedLyricsType: Array.isArray(
                                                              track.syncedLyrics
                                                            )
                                                              ? 'array'
                                                              : typeof track.syncedLyrics,
                                                            syncedLyricsLength: Array.isArray(
                                                              track.syncedLyrics
                                                            )
                                                              ? track.syncedLyrics.length
                                                              : 0,
                                                            hasStartTimeGreaterThanZero:
                                                              hasSyncedLyrics,
                                                            willShowPrev: hasSyncedLyrics,
                                                          },
                                                          timestamp: Date.now(),
                                                          sessionId: 'debug-session',
                                                          runId: 'run1',
                                                          hypothesisId: 'F',
                                                        }),
                                                      }
                                                    ).catch(() => {});
                                                  }
                                                  // #endregion

                                                  return getLyricsActions(
                                                    track.lyricsStatus,
                                                    hasSyncedLyrics
                                                  );
                                                })().map((action, idx) => (
                                                  <button
                                                    key={idx}
                                                    type="button"
                                                    className="user-dashboard__lyrics-action-button"
                                                    onClick={() =>
                                                      handleLyricsAction(
                                                        action.action,
                                                        album.id,
                                                        track.id,
                                                        track.title
                                                      )
                                                    }
                                                  >
                                                    {action.label}
                                                  </button>
                                                ))}
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>

                                      {/* Delete album button - после блока Lyrics, внизу вправо */}
                                      <div className="user-dashboard__delete-album-container">
                                        <button
                                          type="button"
                                          className="user-dashboard__delete-album-button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteAlbum(album.id);
                                          }}
                                          title="Удалить альбом"
                                          aria-label="Удалить альбом"
                                        >
                                          Удалить альбом
                                        </button>
                                      </div>
                                    </div>
                                  )}

                                  {index < albumsData.length - 1 && (
                                    <div className="user-dashboard__album-divider"></div>
                                  )}
                                </React.Fragment>
                              );
                            })}
                          </div>

                          <button
                            type="button"
                            className="user-dashboard__upload-button"
                            onClick={() => setEditAlbumModal({ isOpen: true })}
                          >
                            <span>+</span>
                            <span>{ui?.dashboard?.uploadNewAlbum ?? 'Upload New Album'}</span>
                          </button>
                        </>
                      ) : (
                        <div className="user-dashboard__albums-prompt">
                          <div className="user-dashboard__albums-prompt-text">
                            {ui?.dashboard?.uploadAndPublishAlbums ?? 'Upload and publish albums'}
                          </div>
                          <button
                            type="button"
                            className="user-dashboard__new-album-button"
                            onClick={() => setEditAlbumModal({ isOpen: true })}
                          >
                            {ui?.dashboard?.newAlbum ?? 'New Album'}
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                ) : activeTab === 'posts' ? (
                  <>
                    <h3 className="user-dashboard__section-title">
                      {ui?.dashboard?.tabs?.posts ?? 'Articles'}
                    </h3>
                    <div className="user-dashboard__section">
                      {articlesStatus === 'loading' ? (
                        <ArticlesListSkeleton count={4} />
                      ) : articlesError ? (
                        <div className="user-dashboard__error">
                          {ui?.dashboard?.errorLoadingArticles ?? 'Error loading articles'}:{' '}
                          {articlesError}
                        </div>
                      ) : articlesFromStore && articlesFromStore.length > 0 ? (
                        <>
                          <div className="user-dashboard__albums-list">
                            {articlesFromStore.map((article, index) => {
                              const isExpanded = expandedArticleId === article.articleId;
                              return (
                                <React.Fragment key={article.articleId}>
                                  <div
                                    className={`user-dashboard__album-item ${isExpanded ? 'user-dashboard__album-item--expanded' : ''}`}
                                    onClick={() =>
                                      setExpandedArticleId(isExpanded ? null : article.articleId)
                                    }
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        setExpandedArticleId(isExpanded ? null : article.articleId);
                                      }
                                    }}
                                    aria-label={isExpanded ? 'Collapse article' : 'Expand article'}
                                  >
                                    <div className="user-dashboard__album-thumbnail">
                                      {article.img ? (
                                        <img
                                          src={getUserImageUrl(article.img, 'articles')}
                                          alt={article.nameArticle}
                                          loading="lazy"
                                          decoding="async"
                                          onError={(e) => {
                                            const img = e.target as HTMLImageElement;
                                            const currentSrc = img.src;
                                            if (!currentSrc.includes('&_retry=')) {
                                              img.src = `${currentSrc}&_retry=${Date.now()}`;
                                            }
                                          }}
                                        />
                                      ) : (
                                        <img
                                          src="/images/album-placeholder.png"
                                          alt={article.nameArticle}
                                        />
                                      )}
                                    </div>
                                    <div className="user-dashboard__album-info">
                                      <div className="user-dashboard__album-title">
                                        {article.nameArticle}
                                      </div>
                                      {article.date ? (
                                        <div className="user-dashboard__album-date">
                                          {formatDate(article.date)}
                                        </div>
                                      ) : null}
                                    </div>
                                    <div
                                      className={`user-dashboard__album-arrow ${isExpanded ? 'user-dashboard__album-arrow--expanded' : ''}`}
                                    >
                                      {isExpanded ? '⌃' : '›'}
                                    </div>
                                  </div>

                                  {isExpanded && (
                                    <div className="user-dashboard__album-expanded user-dashboard__album-expanded--article">
                                      {/* Article Cover Upload */}
                                      <div className="user-dashboard__article-cover-section">
                                        <label className="user-dashboard__article-cover-label">
                                          {ui?.dashboard?.articleCover ?? 'Article Cover'}
                                        </label>

                                        <input
                                          type="file"
                                          id={`article-cover-input-${article.articleId}`}
                                          accept="image/*"
                                          className="user-dashboard__article-cover-file-input"
                                          onChange={(e) =>
                                            handleArticleCoverFileInput(article.articleId, e)
                                          }
                                        />

                                        {(() => {
                                          const coverState = articleCoverUpload[article.articleId];
                                          const hasCover = article.img || coverState?.preview;

                                          if (hasCover) {
                                            const previewUrl =
                                              coverState?.preview ||
                                              getUserImageUrl(article.img || '', 'articles');
                                            return (
                                              <div className="user-dashboard__article-cover-wrap">
                                                <div className="user-dashboard__article-cover-preview">
                                                  <img
                                                    src={previewUrl}
                                                    alt="Article cover preview"
                                                    className="user-dashboard__article-cover-image"
                                                  />
                                                </div>

                                                <div className="user-dashboard__article-cover-actions">
                                                  <div className="user-dashboard__article-cover-buttons">
                                                    <label
                                                      htmlFor={`article-cover-input-${article.articleId}`}
                                                      className="user-dashboard__article-cover-button"
                                                    >
                                                      {ui?.dashboard?.replace ?? 'Replace'}
                                                    </label>
                                                  </div>

                                                  {coverState?.status === 'uploading' && (
                                                    <div className="user-dashboard__article-cover-status">
                                                      <div className="user-dashboard__article-cover-progress">
                                                        <div
                                                          className="user-dashboard__article-cover-progress-bar"
                                                          style={{
                                                            width: `${coverState.progress}%`,
                                                          }}
                                                        />
                                                      </div>
                                                      <span className="user-dashboard__article-cover-status-text">
                                                        {ui?.dashboard?.uploading ?? 'Uploading...'}
                                                      </span>
                                                    </div>
                                                  )}

                                                  {coverState?.status === 'uploaded' && (
                                                    <div className="user-dashboard__article-cover-status">
                                                      <span className="user-dashboard__article-cover-status-text user-dashboard__article-cover-status-text--success">
                                                        {ui?.dashboard?.uploaded ?? 'Uploaded'}
                                                      </span>
                                                    </div>
                                                  )}

                                                  {coverState?.status === 'error' &&
                                                    coverState.error && (
                                                      <div className="user-dashboard__article-cover-status">
                                                        <span className="user-dashboard__article-cover-status-text user-dashboard__article-cover-status-text--error">
                                                          {ui?.dashboard?.error ?? 'Error'}:{' '}
                                                          {coverState.error}
                                                        </span>
                                                      </div>
                                                    )}
                                                </div>
                                              </div>
                                            );
                                          }

                                          return (
                                            <div
                                              className={`user-dashboard__article-cover-dropzone ${coverState?.dragActive ? 'user-dashboard__article-cover-dropzone--active' : ''}`}
                                              onDragEnter={(e) =>
                                                handleArticleCoverDrag(article.articleId, e)
                                              }
                                              onDragLeave={(e) =>
                                                handleArticleCoverDrag(article.articleId, e)
                                              }
                                              onDragOver={(e) =>
                                                handleArticleCoverDrag(article.articleId, e)
                                              }
                                              onDrop={(e) =>
                                                handleArticleCoverDrop(article.articleId, e)
                                              }
                                            >
                                              <div className="user-dashboard__article-cover-dropzone-text">
                                                {ui?.dashboard?.dragImageHereOr ??
                                                  'Drag image here or'}
                                              </div>
                                              <label
                                                htmlFor={`article-cover-input-${article.articleId}`}
                                                className="user-dashboard__article-cover-file-label"
                                              >
                                                {ui?.dashboard?.chooseFile ?? 'Choose file'}
                                              </label>
                                            </div>
                                          );
                                        })()}
                                      </div>

                                      {(() => {
                                        const previewText = getArticlePreviewText(article);
                                        return previewText ? (
                                          <div className="user-dashboard__article-description">
                                            {previewText}
                                          </div>
                                        ) : null;
                                      })()}
                                      <div className="user-dashboard__article-actions">
                                        <button
                                          type="button"
                                          className="user-dashboard__edit-button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setEditArticleModal({
                                              isOpen: true,
                                              article: article,
                                            });
                                          }}
                                        >
                                          {ui?.dashboard?.editArticle ?? 'Edit Article'}
                                        </button>
                                        <button
                                          type="button"
                                          className="user-dashboard__delete-article-button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteArticle(article);
                                          }}
                                          title={ui?.dashboard?.deleteArticle ?? 'Delete article'}
                                          aria-label={
                                            ui?.dashboard?.deleteArticle ?? 'Delete article'
                                          }
                                        >
                                          {ui?.dashboard?.deleteArticle ?? 'Delete article'}
                                        </button>
                                      </div>
                                    </div>
                                  )}

                                  {index < articlesFromStore.length - 1 && (
                                    <div className="user-dashboard__album-divider"></div>
                                  )}
                                </React.Fragment>
                              );
                            })}
                          </div>

                          <button
                            type="button"
                            className="user-dashboard__upload-button"
                            onClick={() => {
                              // Создаем новую пустую статью
                              const newArticle: IArticles = {
                                articleId: `new-${Date.now()}`,
                                nameArticle: '',
                                img: '',
                                date: new Date().toISOString().split('T')[0],
                                details: [],
                                description: '',
                                isDraft: true,
                              };
                              setEditArticleModal({
                                isOpen: true,
                                article: newArticle,
                              });
                            }}
                          >
                            <span>+</span>
                            <span>{ui?.dashboard?.uploadNewArticle ?? 'Upload New Article'}</span>
                          </button>
                        </>
                      ) : (
                        <div className="user-dashboard__posts-prompt">
                          <div className="user-dashboard__posts-prompt-text">
                            {ui?.dashboard?.writeAndPublishArticles ?? 'Write and publish articles'}
                          </div>
                          <button
                            type="button"
                            className="user-dashboard__new-post-button"
                            onClick={() => {
                              // Создаем новую пустую статью
                              const newArticle: IArticles = {
                                articleId: `new-${Date.now()}`,
                                nameArticle: '',
                                img: '',
                                date: new Date().toISOString().split('T')[0],
                                details: [],
                                description: '',
                                isDraft: true,
                              };
                              setEditArticleModal({
                                isOpen: true,
                                article: newArticle,
                              });
                            }}
                          >
                            {ui?.dashboard?.newPost ?? 'New Post'}
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <h3 className="user-dashboard__section-title">
                      {ui?.dashboard?.tabs?.posts ?? 'Articles'}
                    </h3>
                    <div className="user-dashboard__section">
                      <div className="user-dashboard__posts-prompt">
                        <div className="user-dashboard__posts-prompt-text">
                          {ui?.dashboard?.writeAndPublishArticles ?? 'Write and publish articles'}
                        </div>
                        <button
                          type="button"
                          className="user-dashboard__new-post-button"
                          onClick={() => {
                            // Создаем новую пустую статью
                            const newArticle: IArticles = {
                              articleId: `new-${Date.now()}`,
                              nameArticle: '',
                              img: '',
                              date: new Date().toISOString().split('T')[0],
                              details: [],
                              description: '',
                              isDraft: true,
                            };
                            setEditArticleModal({
                              isOpen: true,
                              article: newArticle,
                            });
                          }}
                        >
                          {ui?.dashboard?.newPost ?? 'New Post'}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
        <Hamburger isActive={true} onToggle={() => navigate('/')} />
      </Popup>

      {/* Add Lyrics Modal */}
      {addLyricsModal && (
        <AddLyricsModal
          isOpen={addLyricsModal.isOpen}
          trackTitle={addLyricsModal.trackTitle}
          onClose={() => setAddLyricsModal(null)}
          onSave={handleAddLyrics}
        />
      )}

      {/* Edit Lyrics Modal */}
      {editLyricsModal && (
        <EditLyricsModal
          isOpen={editLyricsModal.isOpen}
          initialLyrics={
            editLyricsModal.initialLyrics ??
            getTrackLyricsText(editLyricsModal.albumId, editLyricsModal.trackId)
          }
          initialAuthorship={
            editLyricsModal.initialAuthorship ||
            getTrackAuthorship(editLyricsModal.albumId, editLyricsModal.trackId)
          }
          onClose={() => setEditLyricsModal(null)}
          onSave={handleSaveLyrics}
          onPreview={editLyricsModal.hasSyncedLyrics ? handlePreviewLyrics : undefined}
          onSync={handleSyncLyricsFromEdit}
        />
      )}

      {/* Preview Lyrics Modal */}
      {previewLyricsModal && (
        <PreviewLyricsModal
          isOpen={previewLyricsModal.isOpen}
          lyrics={previewLyricsModal.lyrics}
          syncedLyrics={previewLyricsModal.syncedLyrics}
          authorship={previewLyricsModal.authorship}
          trackSrc={previewLyricsModal.trackSrc}
          onClose={() => setPreviewLyricsModal(null)}
        />
      )}

      {/* Sync Lyrics Modal */}
      {syncLyricsModal && (
        <SyncLyricsModal
          isOpen={syncLyricsModal.isOpen}
          albumId={syncLyricsModal.albumId}
          trackId={syncLyricsModal.trackId}
          trackTitle={syncLyricsModal.trackTitle}
          trackSrc={syncLyricsModal.trackSrc}
          authorship={syncLyricsModal.authorship}
          onClose={() => setSyncLyricsModal(null)}
          onSave={async () => {
            // Перезагружаем альбомы из БД, чтобы получить актуальные синхронизированные тексты
            try {
              await dispatch(fetchAlbums({ lang, force: true })).unwrap();
            } catch (error) {
              console.error('❌ Error reloading albums after sync save:', error);
            }
          }}
        />
      )}

      {/* Edit Album Modal */}
      {editAlbumModal && (
        <EditAlbumModal
          isOpen={editAlbumModal.isOpen}
          albumId={editAlbumModal.albumId}
          onClose={() => setEditAlbumModal(null)}
          onNext={async (formData, updatedAlbum) => {
            if (!editAlbumModal) {
              setEditAlbumModal(null);
              return;
            }

            // Обновляем Redux store из БД
            try {
              console.log('🔄 [UserDashboard] Fetching albums after save...', {
                originalAlbumId: editAlbumModal.albumId,
                updatedAlbumId: updatedAlbum?.albumId,
                isNewAlbum: !editAlbumModal.albumId,
              });
              const result = await dispatch(fetchAlbums({ lang, force: true })).unwrap();
              console.log('✅ [UserDashboard] Albums fetched:', {
                count: result?.length || 0,
                albumIds: result?.map((a: IAlbums) => a.albumId) || [],
              });

              // Проверяем, что обновленный альбом действительно пришел с новыми данными
              // Для новых альбомов используем albumId из updatedAlbum, для существующих - из editAlbumModal
              const searchAlbumId = updatedAlbum?.albumId || editAlbumModal.albumId;
              if (result && result.length > 0 && searchAlbumId) {
                const foundAlbum = result.find((a: IAlbums) => a.albumId === searchAlbumId);
                if (foundAlbum) {
                  console.log('🔍 [UserDashboard] Updated album from fetchAlbums:', {
                    albumId: foundAlbum.albumId,
                    album: foundAlbum.album,
                    artist: foundAlbum.artist,
                    description: foundAlbum.description?.substring(0, 50) || '',
                    cover: foundAlbum.cover,
                    isNewAlbum: !editAlbumModal.albumId,
                  });
                } else {
                  console.warn(
                    '⚠️ [UserDashboard] Updated album not found in fetchAlbums result:',
                    {
                      searchedAlbumId: searchAlbumId,
                      availableIds: result.map((a: IAlbums) => a.albumId),
                      isNewAlbum: !editAlbumModal.albumId,
                    }
                  );
                }
              }

              // Небольшая задержка для гарантии обновления Redux store
              await new Promise((resolve) => setTimeout(resolve, 300));

              // Принудительно обновляем albumsData из результата fetchAlbums
              if (result && result.length > 0) {
                console.log('🔄 [UserDashboard] Updating albumsData from fetchAlbums result...');

                const transformedAlbums = transformAlbumsToAlbumData(result);
                // Добавляем authorship из кеша
                transformedAlbums.forEach((album) => {
                  album.tracks.forEach((track) => {
                    if (!track.authorship) {
                      const cachedAuthorship = getCachedAuthorship(album.albumId, track.id, lang);
                      if (cachedAuthorship) {
                        track.authorship = cachedAuthorship;
                      }
                    }
                  });
                });

                setAlbumsData(transformedAlbums);
                console.log('✅ [UserDashboard] albumsData updated:', {
                  count: transformedAlbums.length,
                  albumIds: transformedAlbums.map((a) => a.id),
                });
              }

              // Закрываем модальное окно после обновления
              // Небольшая задержка для гарантии обновления UI
              await new Promise((resolve) => setTimeout(resolve, 200));
              setEditAlbumModal(null);
            } catch (error: any) {
              // ConditionError - это нормально, condition отменил запрос
              if (error?.name === 'ConditionError') {
                setEditAlbumModal(null);
                return;
              }
              setEditAlbumModal(null);
            }
          }}
        />
      )}

      {/* Confirmation Modal */}
      {confirmationModal && (
        <ConfirmationModal
          isOpen={confirmationModal.isOpen}
          title={confirmationModal.title}
          message={confirmationModal.message}
          variant={confirmationModal.variant}
          onConfirm={confirmationModal.onConfirm}
          onCancel={() => setConfirmationModal(null)}
        />
      )}

      {/* Alert Modal */}
      {alertModal && (
        <AlertModal
          isOpen={alertModal.isOpen}
          title={alertModal.title}
          message={alertModal.message}
          variant={alertModal.variant}
          onClose={() => setAlertModal(null)}
        />
      )}

      {/* Edit Article Modal */}
      {editArticleModal && editArticleModal.article && (
        <EditArticleModalV2
          isOpen={editArticleModal.isOpen}
          article={editArticleModal.article}
          onClose={() => setEditArticleModal(null)}
        />
      )}

      {/* Profile Settings Modal */}
      <ProfileSettingsModal
        isOpen={isProfileSettingsModalOpen}
        onClose={() => setIsProfileSettingsModalOpen(false)}
        userName={user?.name ?? undefined}
        userEmail={user?.email}
      />
    </>
  );
}

export default UserDashboard;
