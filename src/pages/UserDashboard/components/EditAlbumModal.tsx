// src/pages/UserDashboard/components/EditAlbumModal.tsx
import React, { useState, useRef, useEffect } from 'react';
import { Popup } from '@shared/ui/popup';
import { useAppSelector } from '@shared/lib/hooks/useAppSelector';
import { useAppDispatch } from '@shared/lib/hooks/useAppDispatch';
import { selectUiDictionaryFirst } from '@shared/model/uiDictionary';
import { selectAlbumsData, fetchAlbums } from '@entities/album';
import { useLang } from '@app/providers/lang';
import { getToken } from '@shared/lib/auth';
import { getUserImageUrl } from '@shared/api/albums';
import { uploadCoverDraft, commitCover } from '@shared/api/albums/cover';
import type { IAlbums } from '@models';
import type {
  EditAlbumModalProps,
  AlbumFormData,
  BandMember,
  ProducingCredits,
  StreamingLink,
} from './EditAlbumModal.types';
import {
  GENRE_OPTIONS_EN,
  GENRE_OPTIONS_RU,
  MAX_TAGS,
  MIN_TAG_LENGTH,
  MAX_TAG_LENGTH,
  MAX_BAND_MEMBERS,
  DEFAULT_PRODUCING_CREDIT_TYPES,
  PURCHASE_SERVICES,
  STREAMING_SERVICES,
} from './EditAlbumModal.constants';
import {
  makeEmptyForm,
  validateStep,
  transformFormDataToAlbumFormat,
  formatDateFromISO,
  formatDateToISO,
  formatDateInput,
} from './EditAlbumModal.utils';
import { EditAlbumModalStep1 } from './steps/EditAlbumModalStep1';
import { EditAlbumModalStep2 } from './steps/EditAlbumModalStep2';
import { EditAlbumModalStep3 } from './steps/EditAlbumModalStep3';
import { EditAlbumModalStep4 } from './steps/EditAlbumModalStep4';
import './EditAlbumModal.style.scss';

// Re-export types for backward compatibility
export type {
  EditAlbumModalProps,
  BandMember,
  ProducingCredits,
  StreamingLink,
  AlbumFormData,
} from './EditAlbumModal.types';

export function EditAlbumModal({
  isOpen,
  albumId,
  onClose,
  onNext,
}: EditAlbumModalProps): JSX.Element | null {
  const { lang } = useLang();
  const dispatch = useAppDispatch();
  const ui = useAppSelector((state) => selectUiDictionaryFirst(state, lang));

  // Получаем альбомы для текущего языка сайта
  const albumsFromStore = useAppSelector((state) => selectAlbumsData(state, lang));

  // Контроль инициализации - чтобы не перетирать ввод пользователя
  const didInitRef = useRef(false);

  const [currentStep, setCurrentStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);

  // Данные формы
  const [formData, setFormData] = useState<AlbumFormData>(makeEmptyForm());

  const [dragActive, setDragActive] = useState(false);
  const [moodDropdownOpen, setMoodDropdownOpen] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [tagError, setTagError] = useState('');

  const moodDropdownRef = useRef<HTMLDivElement>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);

  const [bandMemberName, setBandMemberName] = useState('');
  const [bandMemberRole, setBandMemberRole] = useState('');
  const [editingBandMemberIndex, setEditingBandMemberIndex] = useState<number | null>(null);

  const [sessionMusicianName, setSessionMusicianName] = useState('');
  const [sessionMusicianRole, setSessionMusicianRole] = useState('');
  const [editingSessionMusicianIndex, setEditingSessionMusicianIndex] = useState<number | null>(
    null
  );

  const [producingNames, setProducingNames] = useState<Record<string, string>>({});
  const [producingRoles, setProducingRoles] = useState<Record<string, string>>({});
  const [editingProducingCredit, setEditingProducingCredit] = useState<{
    creditType: string;
    nameIndex: number;
  } | null>(null);

  const [newCreditType, setNewCreditType] = useState('');

  const [editingPurchaseLink, setEditingPurchaseLink] = useState<number | null>(null);
  const [purchaseLinkService, setPurchaseLinkService] = useState('');
  const [purchaseLinkUrl, setPurchaseLinkUrl] = useState('');

  const [editingStreamingLink, setEditingStreamingLink] = useState<number | null>(null);
  const [streamingLinkService, setStreamingLinkService] = useState('');
  const [streamingLinkUrl, setStreamingLinkUrl] = useState('');

  const [albumArtPreview, setAlbumArtPreview] = useState<string | null>(null);
  const [coverDraftKey, setCoverDraftKey] = useState<string | null>(null);

  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'uploaded' | 'error'>(
    'idle'
  );
  const [uploadError, setUploadError] = useState<string | null>(null);

  // ========= FIX: objectURL lifecycle =========
  const localPreviewUrlRef = useRef<string | null>(null);

  const setLocalPreview = (file: File) => {
    if (localPreviewUrlRef.current) {
      URL.revokeObjectURL(localPreviewUrlRef.current);
    }
    const url = URL.createObjectURL(file);
    localPreviewUrlRef.current = url;
    setAlbumArtPreview(url);
  };

  useEffect(() => {
    return () => {
      if (localPreviewUrlRef.current) {
        URL.revokeObjectURL(localPreviewUrlRef.current);
        localPreviewUrlRef.current = null;
      }
    };
  }, []);
  // ===========================================

  // Упрощенный handleInputChange для совместимости со старым кодом
  const handleInputChange = (field: keyof AlbumFormData, value: string | boolean | File | null) => {
    setFormData((prev) => ({ ...prev, [field]: value as never }));
  };

  // Загружаем данные альбома при открытии модального окна
  useEffect(() => {
    // Сбрасываем флаг инициализации при закрытии модалки
    if (!isOpen) {
      didInitRef.current = false;
      return;
    }

    // Инициализируем только если еще не инициализировали
    if (didInitRef.current) {
      return;
    }

    if (!albumId) return;
    if (!albumsFromStore || !Array.isArray(albumsFromStore)) return;

    const album = albumsFromStore.find((a: IAlbums) => a && a.albumId === albumId);
    if (!album) return;

    // Устанавливаем флаг инициализации
    didInitRef.current = true;

    // --- парсинг band members ---
    const bandMembers: BandMember[] = [];
    const bandMembersDetail = Array.isArray(album.details)
      ? album.details.find(
          (detail) =>
            detail &&
            (detail.title === 'Band members' ||
              detail.title === 'Участники группы' ||
              detail.title === 'Исполнители')
        )
      : null;

    if (bandMembersDetail && (bandMembersDetail as any).content) {
      for (const item of (bandMembersDetail as any).content) {
        if (typeof item === 'string' && item.trim() === '') continue;

        if (typeof item === 'object' && item?.text && Array.isArray(item.text)) {
          const fullText = item.text.join('');
          const match = fullText.match(/^(.+?)\s*—\s*(.+)$/);
          if (match) {
            const name = match[1].trim();
            const role = match[2].trim();
            if (name && role) bandMembers.push({ name, role });
          } else if (fullText.trim()) {
            bandMembers.push({ name: fullText.trim(), role: '' });
          }
        } else if (typeof item === 'string' && item.trim()) {
          const match = item.match(/^(.+?)\s*—\s*(.+)$/);
          if (match) {
            const name = match[1].trim();
            const role = match[2].trim();
            if (name && role) bandMembers.push({ name, role });
          } else {
            bandMembers.push({ name: item.trim(), role: '' });
          }
        }
      }
    }

    // --- парсинг session musicians ---
    const sessionMusicians: BandMember[] = [];
    const sessionMusiciansDetail = Array.isArray(album.details)
      ? album.details.find(
          (detail) =>
            detail &&
            (detail.title === 'Session musicians' ||
              detail.title === 'Сессионные музыканты' ||
              detail.title === 'Session Musicians')
        )
      : null;

    if (sessionMusiciansDetail && (sessionMusiciansDetail as any).content) {
      for (const item of (sessionMusiciansDetail as any).content) {
        if (typeof item === 'string' && item.trim() === '') continue;

        if (typeof item === 'object' && item?.text && Array.isArray(item.text)) {
          const fullText = item.text.join('');
          const match = fullText.match(/^(.+?)\s*—\s*(.+)$/);
          if (match) {
            const name = match[1].trim();
            const role = match[2].trim();
            if (name && role) sessionMusicians.push({ name, role });
          } else if (fullText.trim()) {
            sessionMusicians.push({ name: fullText.trim(), role: '' });
          }
        } else if (typeof item === 'string' && item.trim()) {
          const match = item.match(/^(.+?)\s*—\s*(.+)$/);
          if (match) {
            const name = match[1].trim();
            const role = match[2].trim();
            if (name && role) sessionMusicians.push({ name, role });
          } else {
            sessionMusicians.push({ name: item.trim(), role: '' });
          }
        }
      }
    }

    // --- парсинг producing ---
    const producingCredits: ProducingCredits = {
      Producer: [],
      'Recording/Mixing': [],
      Mastering: [],
    };

    const producingDetail = Array.isArray(album.details)
      ? album.details.find(
          (detail) => detail && (detail.title === 'Producing' || detail.title === 'Продюсирование')
        )
      : null;

    if (producingDetail && (producingDetail as any).content) {
      const creditTypeMap: Record<string, string> = {
        продюсер: 'Producer',
        producer: 'Producer',
        'запись/сведение': 'Recording/Mixing',
        'recording/mixing': 'Recording/Mixing',
        запись: 'Recording/Mixing',
        сведение: 'Recording/Mixing',
        мастеринг: 'Mastering',
        mastering: 'Mastering',
      };

      for (const item of (producingDetail as any).content) {
        if (typeof item === 'string' && item.trim() === '') continue;

        let fullText = '';
        if (typeof item === 'object' && item?.text && Array.isArray(item.text)) {
          fullText = item.text.join('');
        } else if (typeof item === 'string') {
          fullText = item;
        }

        if (!fullText.trim()) continue;

        const match = fullText.match(/^(.+?)\s*—\s*(.+?)(?:\.|$)/);
        if (!match) continue;

        const name = match[1].trim();
        const roleTextLower = match[2].trim().toLowerCase();

        let creditType = 'Producer';
        for (const [key, value] of Object.entries(creditTypeMap)) {
          if (roleTextLower.includes(key)) {
            creditType = value;
            break;
          }
        }

        const role = match[2].trim().replace(/\.$/, '');

        const existingIndex = (producingCredits[creditType] || []).findIndex(
          (m) => m.name === name && m.role === role
        );

        if (existingIndex === -1) {
          producingCredits[creditType] = [...(producingCredits[creditType] || []), { name, role }];
        }
      }
    }

    // --- парсинг Genre из details ---
    const mood: string[] = [];

    // Выбираем список опций жанров в зависимости от языка сайта
    const genreOptions = lang === 'ru' ? GENRE_OPTIONS_RU : GENRE_OPTIONS_EN;

    // Парсим details, если это строка (JSONB из базы может приходить как строка)
    let parsedDetails = album.details;
    if (typeof album.details === 'string') {
      try {
        parsedDetails = JSON.parse(album.details);
      } catch (e) {
        console.error('[EditAlbumModal] Error parsing details:', e);
        parsedDetails = [];
      }
    }

    console.log('[EditAlbumModal] Album details:', {
      originalDetails: album.details,
      parsedDetails,
      detailsType: typeof album.details,
      parsedType: typeof parsedDetails,
      isArray: Array.isArray(parsedDetails) ? 'true' : 'false',
      detailsLength: Array.isArray(parsedDetails) ? parsedDetails.length : 0,
      firstDetail:
        Array.isArray(parsedDetails) && parsedDetails.length > 0 ? parsedDetails[0] : null,
    });

    const genreDetail = Array.isArray(parsedDetails)
      ? parsedDetails.find(
          (detail) =>
            detail &&
            (detail.title === 'Genre' ||
              detail.title === 'Genres' ||
              detail.title === 'Жанр' ||
              detail.title === 'Жанры')
        )
      : null;

    console.log('[EditAlbumModal] Genre detail found:', {
      genreDetail,
      hasContent: !!(genreDetail && (genreDetail as any).content),
      content: genreDetail ? (genreDetail as any).content : null,
    });

    if (genreDetail && (genreDetail as any).content) {
      // Обрабатываем content - может быть массивом строк или объектов с text
      for (const item of (genreDetail as any).content) {
        let text = '';
        if (typeof item === 'string') {
          text = item;
        } else if (typeof item === 'object' && item?.text && Array.isArray(item.text)) {
          text = item.text.join('');
        }

        if (!text.trim()) continue;

        // Разбиваем строку по запятым и убираем точки в конце
        const parsedGenres = text
          .split(',')
          .map((g: string) => g.trim().replace(/\.$/, ''))
          .filter((g: string) => g.length > 0);

        console.log('[EditAlbumModal] Parsing genres from text:', {
          originalText: text,
          parsedGenres,
        });

        // Сопоставляем с опциями из GENRE_OPTIONS (case-insensitive)
        // Используем жанры как есть (русские или английские в зависимости от языка контента)
        parsedGenres.forEach((parsedGenre: string) => {
          const parsedTrimmed = parsedGenre.trim();
          const parsedLower = parsedTrimmed.toLowerCase();

          // Ищем точное совпадение в genreOptions (case-insensitive)
          const matchedOption = genreOptions.find((option) => {
            const optionLower = option.toLowerCase();
            // Точное совпадение
            if (optionLower === parsedLower) return true;
            // Совпадение с учетом пробелов
            if (optionLower.replace(/\s+/g, ' ') === parsedLower.replace(/\s+/g, ' ')) return true;
            return false;
          });

          // Если точного совпадения нет, используем то, что пришло (нормализуем первую букву)
          const finalOption = matchedOption || parsedTrimmed;

          console.log('[EditAlbumModal] Genre matching:', {
            parsedGenre: parsedTrimmed,
            parsedLower,
            matchedOption,
            finalOption,
          });

          if (finalOption && !mood.includes(finalOption)) {
            mood.push(finalOption);
          }
        });
      }
    }

    console.log('[EditAlbumModal] Final parsed mood array:', mood);

    // Заполняем поля из данных альбома (только при первой инициализации)
    setFormData((prevForm) => {
      const release = album.release && typeof album.release === 'object' ? album.release : {};
      // Конвертируем дату из ISO формата (YYYY-MM-DD) в формат для отображения (DD/MM/YYYY)
      const releaseDateISO = (release as any).date || '';
      const releaseDate = releaseDateISO ? formatDateFromISO(releaseDateISO) : '';
      const upc = (release as any).UPC || '';

      const purchaseLinks: StreamingLink[] = (() => {
        const links: StreamingLink[] = [];
        if (album.buttons && typeof album.buttons === 'object') {
          const purchaseMap: Record<string, string> = {
            itunes: 'apple',
            bandcamp: 'bandcamp',
            amazon: 'amazon',
          };

          for (const [key, url] of Object.entries(album.buttons as Record<string, unknown>)) {
            const serviceId = purchaseMap[key.toLowerCase()];
            if (serviceId && typeof url === 'string' && url.trim()) {
              links.push({ service: serviceId, url: url.trim() });
            }
          }
        }
        return links;
      })();

      const streamingLinks: StreamingLink[] = (() => {
        const links: StreamingLink[] = [];
        if (album.buttons && typeof album.buttons === 'object') {
          const streamingMap: Record<string, string> = {
            apple: 'applemusic',
            vk: 'vk',
            youtube: 'youtube',
            spotify: 'spotify',
            yandex: 'yandex',
            deezer: 'deezer',
            tidal: 'tidal',
            applemusic: 'applemusic',
            googleplay: 'googleplay',
          };

          for (const [key, url] of Object.entries(album.buttons as Record<string, unknown>)) {
            const serviceId = streamingMap[key.toLowerCase()];
            if (serviceId && typeof url === 'string' && url.trim()) {
              links.push({ service: serviceId, url: url.trim() });
            }
          }
        }
        return links;
      })();

      return {
        ...prevForm,
        artist: album.artist || prevForm.artist,
        title: album.album || prevForm.title,
        releaseDate: releaseDate || prevForm.releaseDate,
        upcEan: upc || prevForm.upcEan,
        description: album.description || prevForm.description,
        mood: mood.length > 0 ? mood : prevForm.mood || [],
        albumCoverPhotographer: (release as any).photographer || prevForm.albumCoverPhotographer,
        albumCoverDesigner: (release as any).designer || prevForm.albumCoverDesigner,
        bandMembers: bandMembers.length > 0 ? bandMembers : prevForm.bandMembers,
        sessionMusicians:
          sessionMusicians.length > 0 ? sessionMusicians : prevForm.sessionMusicians,
        producingCredits: Object.keys(producingCredits).some(
          (k) => (producingCredits[k] || []).length
        )
          ? producingCredits
          : prevForm.producingCredits,
        purchaseLinks: purchaseLinks.length ? purchaseLinks : prevForm.purchaseLinks,
        streamingLinks: streamingLinks.length ? streamingLinks : prevForm.streamingLinks,
      };
    });

    // Показываем существующую обложку
    const coverName =
      typeof (album as any).cover === 'string'
        ? (album as any).cover
        : (album as any).cover && typeof (album as any).cover === 'object'
          ? (album as any).cover.img
          : null;

    if (coverName) {
      // Убираем расширение из coverName если есть (на всякий случай)
      const stripExt = (s: string) => s.replace(/\.(webp|jpg|jpeg|png)$/i, '');

      // Собираем имя с суффиксом размера и передаём расширение отдельно
      const base = stripExt(coverName); // "my-cover" или "my-cover-448" -> "my-cover" или "my-cover-448"
      const coverUrl = getUserImageUrl(`${base}-448`, 'albums', '.webp', false);

      if (coverUrl) {
        setAlbumArtPreview(`${coverUrl}${coverUrl.includes('?') ? '&' : '?'}v=${Date.now()}`);
      }
    }
    // ВАЖНО: Инициализация происходит только один раз
  }, [isOpen, albumId, lang, albumsFromStore]);

  // Сбрасываем форму при закрытии модального окна
  useEffect(() => {
    if (isOpen) return;

    setFormData(makeEmptyForm());

    setCurrentStep(1);

    setAlbumArtPreview(null);
    setCoverDraftKey(null);
    setUploadProgress(0);
    setUploadStatus('idle');
    setUploadError(null);

    setDragActive(false);
    setMoodDropdownOpen(false);
    setTagInput('');
    setTagError('');
    setBandMemberName('');
    setBandMemberRole('');
    setEditingBandMemberIndex(null);
    setSessionMusicianName('');
    setSessionMusicianRole('');
    setEditingSessionMusicianIndex(null);
    setProducingNames({});
    setProducingRoles({});
    setEditingProducingCredit(null);
    setNewCreditType('');
    setEditingPurchaseLink(null);
    setPurchaseLinkService('');
    setPurchaseLinkUrl('');
    setEditingStreamingLink(null);
    setStreamingLinkService('');
    setStreamingLinkUrl('');

    if (localPreviewUrlRef.current) {
      URL.revokeObjectURL(localPreviewUrlRef.current);
      localPreviewUrlRef.current = null;
    }
  }, [isOpen]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (file) await handleFileUpload(file);
  };

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await handleFileUpload(file);
  };

  const handleFileUpload = async (file: File | null) => {
    if (!file) return;

    // Защита от двойного вызова
    if (uploadStatus === 'uploading') {
      return;
    }

    try {
      // сохраняем в форме (если где-то ещё используется)
      handleInputChange('albumArt', file);

      // сброс
      setUploadProgress(0);
      setUploadStatus('uploading');
      setUploadError(null);
      setCoverDraftKey(null);

      // локальное превью (не течёт)
      setLocalPreview(file);

      const albumData = albumId
        ? albumsFromStore.find((a: IAlbums) => a.albumId === albumId)
        : null;

      // Получаем оригинальный альбом для fallback значений
      const originalAlbum = albumId
        ? albumsFromStore.find((a: IAlbums) => a.albumId === albumId)
        : null;

      // Подготавливаем параметры для uploadCoverDraft
      const uploadArtist = formData.artist || albumData?.artist || originalAlbum?.artist || '';
      const uploadAlbum = formData.title || albumData?.album || originalAlbum?.album || '';
      const uploadAlbumId = albumId || undefined;

      // Проверяем, что у нас есть минимально необходимые данные
      if (!uploadArtist || !uploadAlbum) {
        const errorMsg = `Missing required data: artist="${uploadArtist}", album="${uploadAlbum}"`;
        console.error('Error uploading cover draft:', errorMsg);
        setUploadStatus('error');
        setUploadError(errorMsg);
        return;
      }

      const result = await uploadCoverDraft(
        file,
        uploadAlbumId,
        uploadArtist,
        uploadAlbum,
        (progress) => setUploadProgress(progress)
      );

      if (result.success && result.data) {
        setCoverDraftKey(result.data.draftKey);

        // освобождаем objectURL
        if (localPreviewUrlRef.current) {
          URL.revokeObjectURL(localPreviewUrlRef.current);
          localPreviewUrlRef.current = null;
        }

        const url = result.data.url;
        setAlbumArtPreview(`${url}${url.includes('?') ? '&' : '?'}v=${Date.now()}`);
        setUploadStatus('uploaded');
      } else if (!result.success) {
        setUploadStatus('error');
        setUploadError(result.error || 'Failed to upload cover');
      }
    } catch (error) {
      console.error('Error uploading cover draft:', error);
      setUploadStatus('error');
      setUploadError(error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (!bytes || Number.isNaN(bytes)) return '';
    const units = ['B', 'KB', 'MB', 'GB'];
    const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / 1024 ** exponent;
    return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
  };

  // Закрытие dropdown при клике вне него
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (moodDropdownRef.current && !moodDropdownRef.current.contains(event.target as Node)) {
        setMoodDropdownOpen(false);
      }
    };

    if (moodDropdownOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [moodDropdownOpen]);

  const handleMoodToggle = (mood: string) => {
    setFormData((prev) => {
      const currentMood = prev.mood || [];
      if (currentMood.includes(mood)) {
        return { ...prev, mood: currentMood.filter((m) => m !== mood) };
      }
      return { ...prev, mood: [...currentMood, mood] };
    });
  };

  const handleRemoveMood = (mood: string) => {
    setFormData((prev) => ({ ...prev, mood: (prev.mood || []).filter((m) => m !== mood) }));
  };

  const validateTag = (tag: string): string | null => {
    const trimmedTag = tag.trim();
    if (!trimmedTag) return 'Tag cannot be empty';
    if (trimmedTag.length < MIN_TAG_LENGTH)
      return `Tag must be at least ${MIN_TAG_LENGTH} characters`;
    if (trimmedTag.length > MAX_TAG_LENGTH)
      return `Tag must be no more than ${MAX_TAG_LENGTH} characters`;

    const tagWithoutHash = trimmedTag.startsWith('#') ? trimmedTag.slice(1) : trimmedTag;
    if (tagWithoutHash.length < MIN_TAG_LENGTH) {
      return `Tag must be at least ${MIN_TAG_LENGTH} characters (without #)`;
    }

    const normalizedTag = `#${tagWithoutHash.toLowerCase()}`;
    if (formData.tags.includes(normalizedTag)) return 'This tag already exists';
    if (formData.tags.length >= MAX_TAGS) return `Maximum ${MAX_TAGS} tags allowed`;
    return null;
  };

  const handleAddTag = () => {
    const error = validateTag(tagInput);
    if (error) {
      setTagError(error);
      return;
    }

    const trimmed = tagInput.trim();
    const tagWithoutHash = trimmed.startsWith('#') ? trimmed.slice(1) : trimmed;
    const normalizedTag = `#${tagWithoutHash.toLowerCase()}`;

    setFormData((prev) => ({ ...prev, tags: [...(prev.tags || []), normalizedTag] }));
    setTagInput('');
    setTagError('');
    tagInputRef.current?.focus();
  };

  const handleTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleRemoveTag = (tag: string) => {
    setFormData((prev) => ({ ...prev, tags: (prev.tags || []).filter((t) => t !== tag) }));
  };

  const handleAddBandMember = () => {
    if (!bandMemberName.trim() || !bandMemberRole.trim()) return;

    if (editingBandMemberIndex !== null) {
      setFormData((prev) => {
        const updated = [...(prev.bandMembers || [])];
        updated[editingBandMemberIndex] = {
          name: bandMemberName.trim(),
          role: bandMemberRole.trim(),
        };
        return { ...prev, bandMembers: updated };
      });
      setEditingBandMemberIndex(null);
    } else {
      setFormData((prev) => ({
        ...prev,
        bandMembers: [
          ...(prev.bandMembers || []),
          { name: bandMemberName.trim(), role: bandMemberRole.trim() },
        ],
      }));
    }

    setBandMemberName('');
    setBandMemberRole('');
  };

  const handleEditBandMember = (index: number) => {
    const member = formData.bandMembers[index];
    setBandMemberName(member.name);
    setBandMemberRole(member.role);
    setEditingBandMemberIndex(index);
  };

  const handleCancelEditBandMember = () => {
    setBandMemberName('');
    setBandMemberRole('');
    setEditingBandMemberIndex(null);
  };

  const handleRemoveBandMember = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      bandMembers: (prev.bandMembers || []).filter((_, i) => i !== index),
    }));
    if (editingBandMemberIndex === index) handleCancelEditBandMember();
  };

  const handleAddSessionMusician = () => {
    if (!sessionMusicianName.trim() || !sessionMusicianRole.trim()) return;

    if (editingSessionMusicianIndex !== null) {
      setFormData((prev) => {
        const updated = [...(prev.sessionMusicians || [])];
        updated[editingSessionMusicianIndex] = {
          name: sessionMusicianName.trim(),
          role: sessionMusicianRole.trim(),
        };
        return { ...prev, sessionMusicians: updated };
      });
      setEditingSessionMusicianIndex(null);
    } else {
      setFormData((prev) => ({
        ...prev,
        sessionMusicians: [
          ...(prev.sessionMusicians || []),
          { name: sessionMusicianName.trim(), role: sessionMusicianRole.trim() },
        ],
      }));
    }

    setSessionMusicianName('');
    setSessionMusicianRole('');
  };

  const handleEditSessionMusician = (index: number) => {
    const musician = formData.sessionMusicians[index];
    setSessionMusicianName(musician.name);
    setSessionMusicianRole(musician.role);
    setEditingSessionMusicianIndex(index);
  };

  const handleCancelEditSessionMusician = () => {
    setSessionMusicianName('');
    setSessionMusicianRole('');
    setEditingSessionMusicianIndex(null);
  };

  const handleRemoveSessionMusician = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      sessionMusicians: (prev.sessionMusicians || []).filter((_, i) => i !== index),
    }));
    if (editingSessionMusicianIndex === index) handleCancelEditSessionMusician();
  };

  const handleAddProducingCredit = (creditType: string) => {
    const name = producingNames[creditType]?.trim();
    const role = producingRoles[creditType]?.trim() || '';
    if (!name) return;

    if (editingProducingCredit && editingProducingCredit.creditType === creditType) {
      setFormData((prev) => {
        const updated = { ...prev.producingCredits };
        const members = [...(updated[creditType] || [])];
        members[editingProducingCredit.nameIndex] = { name, role };
        updated[creditType] = members;
        return { ...prev, producingCredits: updated };
      });
      setEditingProducingCredit(null);
    } else {
      setFormData((prev) => {
        const updated = { ...prev.producingCredits };
        updated[creditType] = [...(updated[creditType] || []), { name, role }];
        return { ...prev, producingCredits: updated };
      });
    }

    setProducingNames((prev) => ({ ...prev, [creditType]: '' }));
    setProducingRoles((prev) => ({ ...prev, [creditType]: '' }));
  };

  const handleEditProducingCredit = (creditType: string, nameIndex: number) => {
    const members = formData.producingCredits[creditType] || [];
    const member = members[nameIndex];
    setProducingNames((prev) => ({ ...prev, [creditType]: member?.name || '' }));
    setProducingRoles((prev) => ({ ...prev, [creditType]: member?.role || '' }));
    setEditingProducingCredit({ creditType, nameIndex });
  };

  const handleCancelEditProducingCredit = () => {
    if (editingProducingCredit) {
      setProducingNames((prev) => ({ ...prev, [editingProducingCredit.creditType]: '' }));
      setProducingRoles((prev) => ({ ...prev, [editingProducingCredit.creditType]: '' }));
    }
    setEditingProducingCredit(null);
  };

  const handleRemoveProducingCredit = (creditType: string, nameIndex: number) => {
    setFormData((prev) => {
      const updated = { ...prev.producingCredits };
      updated[creditType] = (updated[creditType] || []).filter((_, i) => i !== nameIndex);
      return { ...prev, producingCredits: updated };
    });

    if (
      editingProducingCredit?.creditType === creditType &&
      editingProducingCredit.nameIndex === nameIndex
    ) {
      handleCancelEditProducingCredit();
    }
  };

  const handleAddNewCreditType = () => {
    if (!newCreditType.trim()) return;
    const trimmedType = newCreditType.trim();
    if (formData.producingCredits[trimmedType]) return;

    setFormData((prev) => ({
      ...prev,
      producingCredits: { ...prev.producingCredits, [trimmedType]: [] },
    }));

    setNewCreditType('');
  };

  const handleRemoveCreditType = (creditType: string) => {
    if (DEFAULT_PRODUCING_CREDIT_TYPES.includes(creditType)) return;

    setFormData((prev) => {
      const updated = { ...prev.producingCredits };
      delete updated[creditType];
      return { ...prev, producingCredits: updated };
    });

    if (editingProducingCredit?.creditType === creditType) handleCancelEditProducingCredit();
  };

  const handleAddPurchaseLink = () => {
    if (!purchaseLinkService.trim() || !purchaseLinkUrl.trim()) return;

    if (editingPurchaseLink !== null) {
      setFormData((prev) => {
        const links = [...prev.purchaseLinks];
        links[editingPurchaseLink] = {
          service: purchaseLinkService.trim(),
          url: purchaseLinkUrl.trim(),
        };
        return { ...prev, purchaseLinks: links };
      });
      setEditingPurchaseLink(null);
    } else {
      setFormData((prev) => ({
        ...prev,
        purchaseLinks: [
          ...prev.purchaseLinks,
          { service: purchaseLinkService.trim(), url: purchaseLinkUrl.trim() },
        ],
      }));
    }

    setPurchaseLinkService('');
    setPurchaseLinkUrl('');
  };

  const handleEditPurchaseLink = (index: number) => {
    const link = formData.purchaseLinks[index];
    setPurchaseLinkService(link.service);
    setPurchaseLinkUrl(link.url);
    setEditingPurchaseLink(index);
  };

  const handleCancelEditPurchaseLink = () => {
    setPurchaseLinkService('');
    setPurchaseLinkUrl('');
    setEditingPurchaseLink(null);
  };

  const handleRemovePurchaseLink = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      purchaseLinks: prev.purchaseLinks.filter((_, i) => i !== index),
    }));
    if (editingPurchaseLink === index) handleCancelEditPurchaseLink();
  };

  const handleAddStreamingLink = () => {
    if (!streamingLinkService.trim() || !streamingLinkUrl.trim()) return;

    if (editingStreamingLink !== null) {
      setFormData((prev) => {
        const links = [...prev.streamingLinks];
        links[editingStreamingLink] = {
          service: streamingLinkService.trim(),
          url: streamingLinkUrl.trim(),
        };
        return { ...prev, streamingLinks: links };
      });
      setEditingStreamingLink(null);
    } else {
      setFormData((prev) => ({
        ...prev,
        streamingLinks: [
          ...prev.streamingLinks,
          { service: streamingLinkService.trim(), url: streamingLinkUrl.trim() },
        ],
      }));
    }

    setStreamingLinkService('');
    setStreamingLinkUrl('');
  };

  const handleEditStreamingLink = (index: number) => {
    const link = formData.streamingLinks[index];
    setStreamingLinkService(link.service);
    setStreamingLinkUrl(link.url);
    setEditingStreamingLink(index);
  };

  const handleCancelEditStreamingLink = () => {
    setStreamingLinkService('');
    setStreamingLinkUrl('');
    setEditingStreamingLink(null);
  };

  const handleRemoveStreamingLink = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      streamingLinks: prev.streamingLinks.filter((_, i) => i !== index),
    }));
    if (editingStreamingLink === index) handleCancelEditStreamingLink();
  };

  // Валидация полей для каждого шага

  const handleNext = () => {
    // Валидируем текущий шаг перед переходом
    if (!validateStep(currentStep, formData)) {
      return; // Останавливаем переход, если валидация не прошла
    }

    if (currentStep < 4) {
      setCurrentStep((s) => s + 1);
    } else if (currentStep === 4) {
      handlePublish();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) setCurrentStep((s) => s - 1);
  };

  const handlePublish = async () => {
    console.log('🚀 [EditAlbumModal] handlePublish called', {
      albumId,
      hasAlbumId: !!albumId,
      lang,
      albumsFromStoreLength: albumsFromStore.length,
    });

    // Проверка наличия albumId обязательна
    if (!albumId) {
      console.error('❌ [EditAlbumModal] No albumId provided. Cannot save album without albumId.');
      alert(
        'Ошибка: невозможно сохранить альбом без ID. Пожалуйста, выберите существующий альбом для редактирования.'
      );
      setIsSaving(false);
      return;
    }

    // Проверяем, существует ли версия языка для этого альбома
    const originalAlbum = albumsFromStore.find((a: IAlbums) => a.albumId === albumId);
    const exists = !!originalAlbum;
    const method = exists ? 'PUT' : 'POST';

    console.log('📋 [EditAlbumModal] Album version check:', {
      albumId,
      lang,
      exists,
      method,
    });

    // Если версии нет, нужен хотя бы минимальный набор данных для создания
    if (!exists && (!formData.artist || !formData.title)) {
      alert(
        'Ошибка: для создания новой версии альбома необходимо заполнить поля "Artist / Group name" и "Album title".'
      );
      setIsSaving(false);
      return;
    }

    // Если версия существует, проверяем обязательные поля
    if (exists) {
      if (!formData.artist && !originalAlbum.artist) {
        alert(
          'Ошибка: не найдено название группы для альбома. Заполните поле "Artist / Group name" и попробуйте снова.'
        );
        setIsSaving(false);
        return;
      }

      if (!formData.title && !originalAlbum.album) {
        alert(
          'Ошибка: не найдено название альбома. Заполните поле "Album title" и попробуйте снова.'
        );
        setIsSaving(false);
        return;
      }
    }

    setIsSaving(true);

    // Используем lang для сохранения
    const normalizedLang = lang;

    let newCover: string | undefined;
    const currentCoverDraftKey = coverDraftKey;

    if (currentCoverDraftKey) {
      try {
        const commitResult = await commitCover(currentCoverDraftKey, albumId, {
          artist: formData.artist || originalAlbum?.artist || '',
          album: formData.title || originalAlbum?.album || '',
          lang: normalizedLang,
        });

        if (commitResult.success && commitResult.data) {
          const data = commitResult.data as any;

          const fromFile = (name?: string) =>
            name
              ? name.replace(/\.(webp|jpg)$/i, '').replace(/-(64|128|448|896|1344)$/i, '')
              : undefined;

          const baseName =
            data?.baseName ||
            fromFile(data?.storagePath?.split('/').pop()) ||
            fromFile(data?.url?.split('/').pop());

          if (!baseName) {
            alert('Ошибка: не удалось получить имя обложки. Попробуй снова.');
            setIsSaving(false);
            return;
          }

          newCover = baseName;
        } else if (!commitResult.success) {
          alert(`Ошибка при сохранении обложки: ${commitResult.error || 'Unknown error'}`);
          setIsSaving(false);
          return;
        }
      } catch (e) {
        alert(`Ошибка при сохранении обложки: ${e instanceof Error ? e.message : 'Unknown error'}`);
        setIsSaving(false);
        return;
      }
    }

    const { release, buttons, details } = transformFormDataToAlbumFormat(formData, lang);

    // Формируем fullName из artist и album
    const artistName = formData.artist || originalAlbum?.artist || '';
    const albumTitle = formData.title || originalAlbum?.album || '';
    const fullName = `${artistName} — ${albumTitle}`;

    console.log('📝 [EditAlbumModal] Form data before save:', {
      method,
      lang,
      formDataTitle: formData.title,
      formDataArtist: formData.artist,
      originalAlbumTitle: originalAlbum?.album,
      originalAlbumArtist: originalAlbum?.artist,
    });

    const updateData: Record<string, unknown> = {
      albumId,
      artist: artistName,
      album: albumTitle,
      fullName,
      description:
        formData.description !== undefined
          ? formData.description
          : originalAlbum?.description || '',
      release:
        exists && originalAlbum?.release
          ? { ...(originalAlbum.release as any), ...release }
          : release,
      buttons:
        exists && originalAlbum?.buttons
          ? { ...(originalAlbum.buttons as any), ...buttons }
          : buttons,
      details: details.length > 0 ? details : originalAlbum?.details || [],
      lang: normalizedLang,
      ...(newCover ? { cover: newCover } : {}),
    };

    console.log('📦 [EditAlbumModal] Update data prepared:', {
      albumId: updateData.albumId,
      album: updateData.album,
      artist: updateData.artist,
      fullName: updateData.fullName,
      description: updateData.description,
      hasRelease: !!updateData.release,
      hasButtons: !!updateData.buttons,
      detailsCount: Array.isArray(updateData.details) ? updateData.details.length : 0,
    });

    try {
      const token = getToken();
      console.log('🔐 [EditAlbumModal] Token check:', {
        hasToken: !!token,
        tokenLength: token?.length || 0,
        tokenPreview: token ? `${token.substring(0, 20)}...` : 'null',
      });

      if (!token) {
        console.error('❌ [EditAlbumModal] No token found! Cannot save album.');
        alert('Ошибка: вы не авторизованы. Пожалуйста, войдите в систему.');
        setIsSaving(false);
        return;
      }

      console.log('📤 [EditAlbumModal] Sending request:', {
        url: '/api/albums',
        method,
        lang: normalizedLang,
        albumId: updateData.albumId,
        album: updateData.album,
        artist: updateData.artist,
        hasDescription: !!updateData.description,
        hasCover: !!updateData.cover,
      });

      const response = await fetch('/api/albums', {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updateData),
      });

      console.log('📥 [EditAlbumModal] Response received:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        contentType: response.headers.get('content-type'),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ [EditAlbumModal] Response error:', {
          status: response.status,
          statusText: response.statusText,
          errorData,
        });
        throw new Error((errorData as any)?.error || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ [EditAlbumModal] Success:', {
        success: result.success,
        hasData: !!result.data,
        dataLength: Array.isArray(result.data) ? result.data.length : 'not array',
      });

      // Детально логируем что вернул сервер
      if (result.data && Array.isArray(result.data) && result.data.length > 0) {
        const returnedAlbum = result.data[0];
        console.log('📋 [EditAlbumModal] Album returned from server:', {
          albumId: returnedAlbum.albumId,
          album: returnedAlbum.album, // Должно быть "32"
          artist: returnedAlbum.artist,
          description: returnedAlbum.description?.substring(0, 50) || '',
          cover: returnedAlbum.cover,
        });
      }

      // ВАЖНО: Форсим обновление Redux store для языка контента ПЕРЕД вызовом onNext
      console.log('🔄 [EditAlbumModal] Forcing fetchAlbums for lang:', lang);
      try {
        await dispatch(fetchAlbums({ lang: lang, force: true })).unwrap();
        console.log('✅ [EditAlbumModal] Redux store updated for', lang);
      } catch (fetchError) {
        console.error('❌ [EditAlbumModal] Failed to update Redux store:', fetchError);
        // Продолжаем выполнение даже если fetchAlbums не удался
      }

      // Передаём обновленный альбом в onNext для обновления UI
      const updatedAlbum: IAlbums | undefined =
        result.data && Array.isArray(result.data) ? result.data[0] : undefined;

      if (onNext) {
        await onNext(formData, updatedAlbum);
      }

      // Небольшая задержка перед закрытием модалки для гарантии обновления UI
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Закрываем модалку
      handleClose();

      return result;
    } catch (error) {
      console.error('❌ Error updating album:', error);
      alert(
        `Ошибка при сохранении альбома: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    if (localPreviewUrlRef.current) {
      URL.revokeObjectURL(localPreviewUrlRef.current);
      localPreviewUrlRef.current = null;
    }
    onClose();
  };

  const showPriceFields =
    formData.allowDownloadSale === 'yes' || formData.allowDownloadSale === 'preorder';
  const showPreorderDate = formData.allowDownloadSale === 'preorder';

  const renderStepContent = () => {
    if (currentStep === 1) {
      return (
        <>
          <div className="edit-album-modal__divider" />

          <div className="edit-album-modal__field">
            <label htmlFor="artist-name" className="edit-album-modal__label">
              Artist / Group name
            </label>
            <input
              id="artist-name"
              name="artist"
              type="text"
              autoComplete="organization"
              className="edit-album-modal__input"
              required
              value={formData.artist ?? ''}
              onChange={(e) => setFormData((s) => ({ ...s, artist: e.target.value }))}
            />
          </div>

          <div className="edit-album-modal__field">
            <label htmlFor="album-title" className="edit-album-modal__label">
              Album title
            </label>
            <input
              id="album-title"
              name="album-title"
              type="text"
              autoComplete="off"
              className="edit-album-modal__input"
              required
              value={formData.title ?? ''}
              onChange={(e) => setFormData((s) => ({ ...s, title: e.target.value }))}
            />
          </div>

          <div className="edit-album-modal__field">
            <label htmlFor="release-date" className="edit-album-modal__label">
              Release date
            </label>
            <input
              id="release-date"
              name="release-date"
              type="text"
              autoComplete="off"
              className="edit-album-modal__input"
              placeholder="DD/MM/YYYY"
              maxLength={10}
              required
              value={formData.releaseDate ?? ''}
              onChange={(e) => {
                const formatted = formatDateInput(e.target.value);
                setFormData((s) => ({ ...s, releaseDate: formatted }));
              }}
              onBlur={(e) => {
                // При потере фокуса валидируем дату
                const value = e.target.value.trim();
                if (value && value.length === 10) {
                  const parts = value.split('/');
                  if (parts.length === 3) {
                    const [day, month, year] = parts.map((p) => parseInt(p, 10));
                    if (
                      day >= 1 &&
                      day <= 31 &&
                      month >= 1 &&
                      month <= 12 &&
                      year >= 1900 &&
                      year <= 2100
                    ) {
                      const date = new Date(year, month - 1, day);
                      if (
                        date.getDate() === day &&
                        date.getMonth() === month - 1 &&
                        date.getFullYear() === year
                      ) {
                        const formatted = formatDateInput(value);
                        setFormData((s) => ({ ...s, releaseDate: formatted }));
                      }
                    }
                  }
                }
              }}
            />
          </div>

          <div className="edit-album-modal__field">
            <label htmlFor="upc-ean" className="edit-album-modal__label">
              UPC / EAN
            </label>
            <input
              id="upc-ean"
              name="upc-ean"
              type="text"
              autoComplete="off"
              className="edit-album-modal__input"
              placeholder="UPC / EAN"
              required
              value={formData.upcEan ?? ''}
              onChange={(e) => setFormData((s) => ({ ...s, upcEan: e.target.value }))}
            />
          </div>

          <div className="edit-album-modal__field">
            <label className="edit-album-modal__label">Album art</label>

            <input
              type="file"
              id="album-art-input"
              accept="image/*"
              className="edit-album-modal__file-input"
              onChange={handleFileInput}
            />

            {albumArtPreview ? (
              <div className="edit-album-modal__art-wrap">
                <div className="edit-album-modal__art-preview">
                  <img
                    src={albumArtPreview}
                    alt="Album art preview"
                    className="edit-album-modal__art-image"
                  />
                </div>

                <div className="edit-album-modal__art-actions">
                  <div className="edit-album-modal__art-buttons">
                    <label htmlFor="album-art-input" className="edit-album-modal__art-button">
                      Replace
                    </label>
                  </div>

                  {formData.albumArt && formData.albumArt instanceof File && (
                    <div className="edit-album-modal__art-meta">
                      {formData.albumArt.type || 'Image'} • {formatFileSize(formData.albumArt.size)}
                    </div>
                  )}

                  {uploadStatus === 'uploading' && (
                    <div className="edit-album-modal__art-status">
                      <div className="edit-album-modal__art-progress">
                        <div
                          className="edit-album-modal__art-progress-bar"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                      <span className="edit-album-modal__art-status-text">Uploading...</span>
                    </div>
                  )}

                  {uploadStatus === 'uploaded' && (
                    <div className="edit-album-modal__art-status">
                      <span className="edit-album-modal__art-status-text edit-album-modal__art-status-text--success">
                        Uploaded (draft)
                      </span>
                    </div>
                  )}

                  {uploadStatus === 'error' && uploadError && (
                    <div className="edit-album-modal__art-status">
                      <span className="edit-album-modal__art-status-text edit-album-modal__art-status-text--error">
                        Error: {uploadError}
                      </span>
                    </div>
                  )}

                  {!coverDraftKey && albumArtPreview && uploadStatus === 'idle' && (
                    <div className="edit-album-modal__art-status">
                      <span className="edit-album-modal__art-status-text">Published cover</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div
                className={`edit-album-modal__dropzone ${dragActive ? 'edit-album-modal__dropzone--active' : ''}`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <div className="edit-album-modal__dropzone-text">Drag image here</div>
                <label htmlFor="album-art-input" className="edit-album-modal__file-label">
                  Choose file
                </label>
              </div>
            )}
          </div>

          <div className="edit-album-modal__field">
            <label htmlFor="description" className="edit-album-modal__label">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              autoComplete="off"
              className="edit-album-modal__textarea"
              placeholder="Short story about the album, credits highlights, mood, etc."
              required
              value={formData.description ?? ''}
              onChange={(e) => setFormData((s) => ({ ...s, description: e.target.value }))}
            />
          </div>

          <div className="edit-album-modal__field">
            <label className="edit-album-modal__label">Visible on album page</label>
            <div className="edit-album-modal__checkbox-wrapper">
              <input
                type="checkbox"
                id="visible-on-page"
                className="edit-album-modal__checkbox"
                checked={formData.visibleOnAlbumPage}
                onChange={(e) => handleInputChange('visibleOnAlbumPage', e.target.checked)}
              />
              <label htmlFor="visible-on-page" className="edit-album-modal__checkbox-label">
                Visible on album page
              </label>
            </div>
          </div>

          <div className="edit-album-modal__field">
            <label className="edit-album-modal__label">Allow download / sale</label>
            <div className="edit-album-modal__help-text">
              Control whether fans can buy/download this album.
            </div>
            <div className="edit-album-modal__radio-group">
              <div className="edit-album-modal__radio-wrapper">
                <input
                  type="radio"
                  id="download-no"
                  name="allow-download-sale"
                  className="edit-album-modal__radio"
                  checked={formData.allowDownloadSale === 'no'}
                  onChange={() => handleInputChange('allowDownloadSale', 'no')}
                />
                <label htmlFor="download-no" className="edit-album-modal__radio-label">
                  No
                </label>
              </div>

              <div className="edit-album-modal__radio-wrapper">
                <input
                  type="radio"
                  id="download-yes"
                  name="allow-download-sale"
                  className="edit-album-modal__radio"
                  checked={formData.allowDownloadSale === 'yes'}
                  onChange={() => handleInputChange('allowDownloadSale', 'yes')}
                />
                <label htmlFor="download-yes" className="edit-album-modal__radio-label">
                  Yes
                </label>
              </div>

              <div className="edit-album-modal__radio-wrapper">
                <input
                  type="radio"
                  id="download-preorder"
                  name="allow-download-sale"
                  className="edit-album-modal__radio"
                  checked={formData.allowDownloadSale === 'preorder'}
                  onChange={() => handleInputChange('allowDownloadSale', 'preorder')}
                />
                <label htmlFor="download-preorder" className="edit-album-modal__radio-label">
                  Accept pre-orders
                </label>
              </div>
            </div>

            {formData.allowDownloadSale === 'preorder' && (
              <div className="edit-album-modal__preorder-help">
                Fans can buy now, download after release date
              </div>
            )}
          </div>

          {showPriceFields && (
            <div className="edit-album-modal__field">
              <label className="edit-album-modal__label">Regular price</label>
              <div className="edit-album-modal__price-group">
                <select
                  name="currency"
                  autoComplete="off"
                  className="edit-album-modal__select"
                  value={formData.currency}
                  onChange={(e) => handleInputChange('currency', e.target.value)}
                >
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="RUB">RUB</option>
                </select>

                <input
                  name="regular-price"
                  type="text"
                  autoComplete="off"
                  className="edit-album-modal__input edit-album-modal__input--price"
                  value={formData.regularPrice}
                  onChange={(e) => handleInputChange('regularPrice', e.target.value)}
                  disabled={formData.allowDownloadSale === 'no'}
                />
              </div>
            </div>
          )}

          {showPreorderDate && (
            <div className="edit-album-modal__field">
              <label htmlFor="preorder-date" className="edit-album-modal__label">
                Pre-order release date
              </label>
              <input
                id="preorder-date"
                name="preorder-date"
                type="text"
                autoComplete="off"
                className="edit-album-modal__input"
                placeholder="DD/MM/YYYY"
                maxLength={10}
                value={formData.preorderReleaseDate}
                onChange={(e) => {
                  const formatted = formatDateInput(e.target.value);
                  handleInputChange('preorderReleaseDate', formatted);
                }}
                onBlur={(e) => {
                  // При потере фокуса валидируем дату
                  const value = e.target.value.trim();
                  if (value && value.length === 10) {
                    const parts = value.split('/');
                    if (parts.length === 3) {
                      const [day, month, year] = parts.map((p) => parseInt(p, 10));
                      if (
                        day >= 1 &&
                        day <= 31 &&
                        month >= 1 &&
                        month <= 12 &&
                        year >= 1900 &&
                        year <= 2100
                      ) {
                        const date = new Date(year, month - 1, day);
                        if (
                          date.getDate() === day &&
                          date.getMonth() === month - 1 &&
                          date.getFullYear() === year
                        ) {
                          const formatted = formatDateInput(value);
                          handleInputChange('preorderReleaseDate', formatted);
                        }
                      }
                    }
                  }
                }}
              />
            </div>
          )}
        </>
      );
    }

    if (currentStep === 2) {
      return (
        <EditAlbumModalStep2
          formData={formData}
          lang={lang}
          moodDropdownOpen={moodDropdownOpen}
          tagInput={tagInput}
          tagError={tagError}
          moodDropdownRef={moodDropdownRef}
          tagInputRef={tagInputRef}
          onMoodDropdownToggle={() => setMoodDropdownOpen(!moodDropdownOpen)}
          onMoodToggle={handleMoodToggle}
          onRemoveMood={handleRemoveMood}
          onTagInputChange={(value) => {
            setTagInput(value);
            setTagError('');
          }}
          onTagInputKeyDown={handleTagInputKeyDown}
          onAddTag={handleAddTag}
          onRemoveTag={handleRemoveTag}
        />
      );
    }

    if (currentStep === 3) {
      return (
        <EditAlbumModalStep3
          formData={formData}
          bandMemberName={bandMemberName}
          bandMemberRole={bandMemberRole}
          editingBandMemberIndex={editingBandMemberIndex}
          sessionMusicianName={sessionMusicianName}
          sessionMusicianRole={sessionMusicianRole}
          editingSessionMusicianIndex={editingSessionMusicianIndex}
          producingNames={producingNames}
          producingRoles={producingRoles}
          editingProducingCredit={editingProducingCredit}
          newCreditType={newCreditType}
          onFormDataChange={handleInputChange}
          onBandMemberNameChange={setBandMemberName}
          onBandMemberRoleChange={setBandMemberRole}
          onAddBandMember={handleAddBandMember}
          onEditBandMember={handleEditBandMember}
          onRemoveBandMember={handleRemoveBandMember}
          onCancelEditBandMember={handleCancelEditBandMember}
          onSessionMusicianNameChange={setSessionMusicianName}
          onSessionMusicianRoleChange={setSessionMusicianRole}
          onAddSessionMusician={handleAddSessionMusician}
          onEditSessionMusician={handleEditSessionMusician}
          onRemoveSessionMusician={handleRemoveSessionMusician}
          onCancelEditSessionMusician={handleCancelEditSessionMusician}
          onProducingNameChange={(creditType, value) =>
            setProducingNames((prev) => ({ ...prev, [creditType]: value }))
          }
          onProducingRoleChange={(creditType, value) =>
            setProducingRoles((prev) => ({ ...prev, [creditType]: value }))
          }
          onAddProducingCredit={handleAddProducingCredit}
          onEditProducingCredit={handleEditProducingCredit}
          onRemoveProducingCredit={handleRemoveProducingCredit}
          onCancelEditProducingCredit={handleCancelEditProducingCredit}
          onNewCreditTypeChange={setNewCreditType}
          onAddNewCreditType={handleAddNewCreditType}
          onRemoveCreditType={handleRemoveCreditType}
        />
      );
    }

    if (currentStep === 4) {
      return (
        <EditAlbumModalStep4
          formData={formData}
          editingPurchaseLink={editingPurchaseLink}
          purchaseLinkService={purchaseLinkService}
          purchaseLinkUrl={purchaseLinkUrl}
          editingStreamingLink={editingStreamingLink}
          streamingLinkService={streamingLinkService}
          streamingLinkUrl={streamingLinkUrl}
          onPurchaseLinkServiceChange={setPurchaseLinkService}
          onPurchaseLinkUrlChange={setPurchaseLinkUrl}
          onAddPurchaseLink={handleAddPurchaseLink}
          onEditPurchaseLink={handleEditPurchaseLink}
          onRemovePurchaseLink={handleRemovePurchaseLink}
          onCancelEditPurchaseLink={handleCancelEditPurchaseLink}
          onStreamingLinkServiceChange={setStreamingLinkService}
          onStreamingLinkUrlChange={setStreamingLinkUrl}
          onAddStreamingLink={handleAddStreamingLink}
          onEditStreamingLink={handleEditStreamingLink}
          onRemoveStreamingLink={handleRemoveStreamingLink}
          onCancelEditStreamingLink={handleCancelEditStreamingLink}
        />
      );
    }

    return null;
  };

  const getStepTitle = () => {
    switch (currentStep) {
      case 1:
        return 'Step 1 of 4: Basic Info';
      case 2:
        return 'Step 2 of 4: Music Details';
      case 3:
        return 'Step 3 of 4: Credits';
      case 4:
        return 'Step 4 of 4: Links';
      default:
        return `Step ${currentStep} of 4`;
    }
  };

  return (
    <Popup isActive={isOpen} onClose={handleClose}>
      <div className="edit-album-modal">
        <div className="edit-album-modal__card">
          <div className="edit-album-modal__header">
            <h2 className="edit-album-modal__title">{getStepTitle()}</h2>
          </div>

          <div className="edit-album-modal__form">
            {renderStepContent()}

            <div className="edit-album-modal__actions">
              {currentStep > 1 ? (
                <button
                  type="button"
                  className="edit-album-modal__button edit-album-modal__button--secondary"
                  onClick={handlePrevious}
                >
                  Previous
                </button>
              ) : (
                <button
                  type="button"
                  className="edit-album-modal__button edit-album-modal__button--cancel"
                  onClick={handleClose}
                >
                  {ui?.dashboard?.cancel ?? 'Cancel'}
                </button>
              )}

              {currentStep === 4 ? (
                <button
                  type="button"
                  className="edit-album-modal__button edit-album-modal__button--primary"
                  onClick={handlePublish}
                  disabled={isSaving}
                >
                  {isSaving
                    ? 'Saving...'
                    : albumId && albumsFromStore?.some((a: IAlbums) => a.albumId === albumId)
                      ? 'Save changes'
                      : 'Publish album'}
                </button>
              ) : (
                <button
                  type="button"
                  className="edit-album-modal__button edit-album-modal__button--primary"
                  onClick={handleNext}
                >
                  Next
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </Popup>
  );
}
