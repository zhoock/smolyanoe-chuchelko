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
import './EditAlbumModal.style.scss';

type ContentLang = 'ru' | 'en';

interface EditAlbumModalProps {
  isOpen: boolean;
  albumId?: string;
  onClose: () => void;
  onNext?: (data: AlbumFormData, updatedAlbum?: IAlbums) => void;
  contentLang?: 'ru' | 'en';
  onContentLangChange?: (lang: 'ru' | 'en') => void;
}

export interface BandMember {
  name: string;
  role: string;
}

export interface ProducingCredits {
  [creditType: string]: BandMember[];
}

export interface StreamingLink {
  service: string;
  url: string;
}

export interface AlbumFormData {
  artist: string;
  title: string;
  releaseDate: string;
  upcEan: string;
  albumArt: File | null;
  description: string;
  visibleOnAlbumPage: boolean;
  allowDownloadSale: 'no' | 'yes' | 'preorder';
  regularPrice: string;
  currency: string;
  preorderReleaseDate: string;
  mood: string[];
  tags: string[];
  albumCoverPhotographer: string;
  albumCoverDesigner: string;
  bandMembers: BandMember[];
  sessionMusicians: BandMember[];
  producingCredits: ProducingCredits;
  purchaseLinks: StreamingLink[];
  streamingLinks: StreamingLink[];
}

const GENRE_OPTIONS = [
  // English
  'Grunge',
  'Alternative rock',
  'Punk',
  'Indie rock',
  'Post-rock',
  'Shoegaze',
  'Noise rock',
  // Russian
  'Гранж',
  'Альтернативный рок',
  'Панк',
  'Инди рок',
  'Инди-рок',
  'Пост-рок',
  'Шугейз',
  'Нойз рок',
  'Нойз-рок',
];

const MAX_TAGS = 10;
const MIN_TAG_LENGTH = 2;
const MAX_TAG_LENGTH = 30;
const MAX_BAND_MEMBERS = 20;
const DEFAULT_PRODUCING_CREDIT_TYPES = ['Producer', 'Recording/Mixing', 'Mastering'];

const PURCHASE_SERVICES = [
  { id: 'apple', name: 'Apple', icon: 'icon-apple' },
  { id: 'bandcamp', name: 'Bandcamp', icon: 'icon-bandcamp' },
  { id: 'amazon', name: 'Amazon', icon: 'icon-amazon' },
  { id: 'physical', name: 'Physical store', icon: '' },
];

const STREAMING_SERVICES = [
  { id: 'applemusic', name: 'Apple Music', icon: 'icon-applemusic' },
  { id: 'vk', name: 'VK', icon: 'icon-vk' },
  { id: 'youtube', name: 'YouTube', icon: 'icon-youtube' },
  { id: 'spotify', name: 'Spotify', icon: 'icon-spotify' },
  { id: 'yandex', name: 'Yandex Music', icon: 'icon-yandex' },
  { id: 'tidal', name: 'TIDAL', icon: 'icon-tidal' },
  { id: 'deezer', name: 'Deezer', icon: 'icon-deezer' },
  { id: 'googleplay', name: 'Google Play', icon: 'icon-googleplay' },
];

export function EditAlbumModal({
  isOpen,
  albumId,
  onClose,
  onNext,
  contentLang: externalContentLang,
  onContentLangChange,
}: EditAlbumModalProps): JSX.Element | null {
  const { lang } = useLang();
  const dispatch = useAppDispatch();
  const ui = useAppSelector((state) => selectUiDictionaryFirst(state, lang));

  // Получаем альбомы для обоих языков контента
  const albumsRu = useAppSelector((state) => selectAlbumsData(state, 'ru'));
  const albumsEn = useAppSelector((state) => selectAlbumsData(state, 'en'));

  // Язык редактируемого контента (отдельно от языка UI)
  // Используем внешний contentLang если передан, иначе локальный
  const [internalContentLang, setInternalContentLang] = useState<ContentLang>(
    lang === 'ru' ? 'ru' : 'en'
  );
  const contentLang = externalContentLang ?? internalContentLang;
  const setContentLang = onContentLangChange ?? setInternalContentLang;
  const albumsForContent = contentLang === 'ru' ? albumsRu : albumsEn;

  // Контроль инициализации - чтобы не перетирать ввод пользователя (по языкам контента)
  const didInitRef = useRef<Record<ContentLang, boolean>>({ ru: false, en: false });

  const [currentStep, setCurrentStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);

  // Вспомогательная функция для создания пустой формы
  const makeEmptyForm = (): AlbumFormData => ({
    artist: '',
    title: '',
    releaseDate: '',
    upcEan: '',
    albumArt: null,
    description: '',
    visibleOnAlbumPage: true,
    allowDownloadSale: 'no',
    regularPrice: '9.99',
    currency: 'USD',
    preorderReleaseDate: '',
    mood: [],
    tags: [],
    albumCoverPhotographer: '',
    albumCoverDesigner: '',
    bandMembers: [],
    sessionMusicians: [],
    producingCredits: {
      Producer: [],
      'Recording/Mixing': [],
      Mastering: [],
    } as ProducingCredits,
    purchaseLinks: [],
    streamingLinks: [],
  });

  // Храним черновики формы отдельно для RU и EN
  const [formByLang, setFormByLang] = useState<Record<ContentLang, AlbumFormData>>({
    ru: makeEmptyForm(),
    en: makeEmptyForm(),
  });

  // Текущие данные формы для выбранного языка контента
  const formData = formByLang[contentLang];

  // Функция для обновления формы текущего языка контента
  const setFormDataForLang = (updater: (prev: AlbumFormData) => AlbumFormData) => {
    setFormByLang((prev) => ({ ...prev, [contentLang]: updater(prev[contentLang]) }));
  };

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
  // Но основные поля теперь используют прямой setFormDataForLang
  const handleInputChange = (field: keyof AlbumFormData, value: string | boolean | File | null) => {
    setFormDataForLang((prev) => ({ ...prev, [field]: value as never }));
  };

  // Загружаем данные альбома при открытии модального окна
  useEffect(() => {
    // Сбрасываем флаги инициализации при закрытии модалки
    if (!isOpen) {
      didInitRef.current = { ru: false, en: false };
      return;
    }

    // Инициализируем только если еще не инициализировали для этого языка контента
    if (didInitRef.current[contentLang]) {
      return;
    }

    if (!albumId) return;
    if (!albumsForContent || !Array.isArray(albumsForContent)) return;

    const album = albumsForContent.find((a: IAlbums) => a && a.albumId === albumId);
    if (!album) return;

    // Устанавливаем флаг инициализации для этого языка
    didInitRef.current[contentLang] = true;

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

          // Ищем точное совпадение в GENRE_OPTIONS (case-insensitive)
          const matchedOption = GENRE_OPTIONS.find((option) => {
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

    // Заполняем поля из данных альбома (только при первой инициализации для этого языка)
    setFormByLang((prev) => ({
      ...prev,
      [contentLang]: (() => {
        const prevForm = prev[contentLang];
        const release = album.release && typeof album.release === 'object' ? album.release : {};
        const releaseDate = (release as any).date || '';
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
      })(),
    }));

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
    // ВАЖНО: Инициализация происходит только один раз для каждого языка контента
  }, [isOpen, albumId, contentLang, albumsForContent]);

  // Сбрасываем форму при закрытии модального окна
  useEffect(() => {
    if (isOpen) return;

    setFormByLang({
      ru: makeEmptyForm(),
      en: makeEmptyForm(),
    });

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
        ? albumsForContent.find((a: IAlbums) => a.albumId === albumId)
        : null;

      // Получаем оригинальный альбом для fallback значений
      const originalAlbum = albumId
        ? albumsForContent.find((a: IAlbums) => a.albumId === albumId)
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
    setFormDataForLang((prev) => {
      const currentMood = prev.mood || [];
      if (currentMood.includes(mood)) {
        return { ...prev, mood: currentMood.filter((m) => m !== mood) };
      }
      return { ...prev, mood: [...currentMood, mood] };
    });
  };

  const handleRemoveMood = (mood: string) => {
    setFormDataForLang((prev) => ({ ...prev, mood: (prev.mood || []).filter((m) => m !== mood) }));
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

    setFormDataForLang((prev) => ({ ...prev, tags: [...(prev.tags || []), normalizedTag] }));
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
    setFormDataForLang((prev) => ({ ...prev, tags: (prev.tags || []).filter((t) => t !== tag) }));
  };

  const handleAddBandMember = () => {
    if (!bandMemberName.trim() || !bandMemberRole.trim()) return;

    if (editingBandMemberIndex !== null) {
      setFormDataForLang((prev) => {
        const updated = [...(prev.bandMembers || [])];
        updated[editingBandMemberIndex] = {
          name: bandMemberName.trim(),
          role: bandMemberRole.trim(),
        };
        return { ...prev, bandMembers: updated };
      });
      setEditingBandMemberIndex(null);
    } else {
      setFormDataForLang((prev) => ({
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
    setFormDataForLang((prev) => ({
      ...prev,
      bandMembers: (prev.bandMembers || []).filter((_, i) => i !== index),
    }));
    if (editingBandMemberIndex === index) handleCancelEditBandMember();
  };

  const handleAddSessionMusician = () => {
    if (!sessionMusicianName.trim() || !sessionMusicianRole.trim()) return;

    if (editingSessionMusicianIndex !== null) {
      setFormDataForLang((prev) => {
        const updated = [...(prev.sessionMusicians || [])];
        updated[editingSessionMusicianIndex] = {
          name: sessionMusicianName.trim(),
          role: sessionMusicianRole.trim(),
        };
        return { ...prev, sessionMusicians: updated };
      });
      setEditingSessionMusicianIndex(null);
    } else {
      setFormDataForLang((prev) => ({
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
    setFormDataForLang((prev) => ({
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
      setFormDataForLang((prev) => {
        const updated = { ...prev.producingCredits };
        const members = [...(updated[creditType] || [])];
        members[editingProducingCredit.nameIndex] = { name, role };
        updated[creditType] = members;
        return { ...prev, producingCredits: updated };
      });
      setEditingProducingCredit(null);
    } else {
      setFormDataForLang((prev) => {
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
    setFormDataForLang((prev) => {
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

    setFormDataForLang((prev) => ({
      ...prev,
      producingCredits: { ...prev.producingCredits, [trimmedType]: [] },
    }));

    setNewCreditType('');
  };

  const handleRemoveCreditType = (creditType: string) => {
    if (DEFAULT_PRODUCING_CREDIT_TYPES.includes(creditType)) return;

    setFormDataForLang((prev) => {
      const updated = { ...prev.producingCredits };
      delete updated[creditType];
      return { ...prev, producingCredits: updated };
    });

    if (editingProducingCredit?.creditType === creditType) handleCancelEditProducingCredit();
  };

  const handleAddPurchaseLink = () => {
    if (!purchaseLinkService.trim() || !purchaseLinkUrl.trim()) return;

    if (editingPurchaseLink !== null) {
      setFormDataForLang((prev) => {
        const links = [...prev.purchaseLinks];
        links[editingPurchaseLink] = {
          service: purchaseLinkService.trim(),
          url: purchaseLinkUrl.trim(),
        };
        return { ...prev, purchaseLinks: links };
      });
      setEditingPurchaseLink(null);
    } else {
      setFormDataForLang((prev) => ({
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
    setFormDataForLang((prev) => ({
      ...prev,
      purchaseLinks: prev.purchaseLinks.filter((_, i) => i !== index),
    }));
    if (editingPurchaseLink === index) handleCancelEditPurchaseLink();
  };

  const handleAddStreamingLink = () => {
    if (!streamingLinkService.trim() || !streamingLinkUrl.trim()) return;

    if (editingStreamingLink !== null) {
      setFormDataForLang((prev) => {
        const links = [...prev.streamingLinks];
        links[editingStreamingLink] = {
          service: streamingLinkService.trim(),
          url: streamingLinkUrl.trim(),
        };
        return { ...prev, streamingLinks: links };
      });
      setEditingStreamingLink(null);
    } else {
      setFormDataForLang((prev) => ({
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
    setFormDataForLang((prev) => ({
      ...prev,
      streamingLinks: prev.streamingLinks.filter((_, i) => i !== index),
    }));
    if (editingStreamingLink === index) handleCancelEditStreamingLink();
  };

  // Валидация полей для каждого шага
  const validateStep = (step: number): boolean => {
    if (step === 1) {
      // Шаг 1: Basic Info
      const errors: string[] = [];
      if (!formData.artist || !formData.artist.trim()) {
        errors.push('Artist / Group name');
      }
      if (!formData.title || !formData.title.trim()) {
        errors.push('Album title');
      }
      if (!formData.releaseDate || !formData.releaseDate.trim()) {
        errors.push('Release date');
      }
      if (!formData.description || !formData.description.trim()) {
        errors.push('Description');
      }
      // Regular price обязателен только если продажа включена
      if (
        formData.allowDownloadSale !== 'no' &&
        (!formData.regularPrice || !formData.regularPrice.trim())
      ) {
        errors.push('Regular price');
      }
      // Pre-order release date обязателен только если pre-order включен
      if (
        formData.allowDownloadSale === 'preorder' &&
        (!formData.preorderReleaseDate || !formData.preorderReleaseDate.trim())
      ) {
        errors.push('Pre-order release date');
      }
      if (errors.length > 0) {
        alert(`Пожалуйста, заполните обязательные поля:\n${errors.join('\n')}`);
        return false;
      }
      return true;
    }

    if (step === 2) {
      // Шаг 2: Music Details - Genre обязателен
      if (!formData.mood || formData.mood.length === 0) {
        alert('Пожалуйста, выберите хотя бы один жанр (Genre).');
        return false;
      }
      return true;
    }

    if (step === 3) {
      // Шаг 3: Credits
      const errors: string[] = [];
      if (!formData.albumCoverPhotographer || !formData.albumCoverPhotographer.trim()) {
        errors.push('Album Cover Photographer');
      }
      if (!formData.albumCoverDesigner || !formData.albumCoverDesigner.trim()) {
        errors.push('Album Cover Designer');
      }
      if (!formData.bandMembers || formData.bandMembers.length === 0) {
        errors.push('Band Members (хотя бы один участник)');
      }
      // Проверяем, что есть хотя бы один Producer в producingCredits
      if (!formData.producingCredits.Producer || formData.producingCredits.Producer.length === 0) {
        errors.push('Producer (хотя бы один продюсер)');
      }
      if (errors.length > 0) {
        alert(`Пожалуйста, заполните обязательные поля:\n${errors.join('\n')}`);
        return false;
      }
      return true;
    }

    // Шаг 4 (Links) - нет обязательных полей
    return true;
  };

  const handleNext = () => {
    // Валидируем текущий шаг перед переходом
    if (!validateStep(currentStep)) {
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

  const transformFormDataToAlbumFormat = (): {
    release: Record<string, string>;
    buttons: Record<string, string>;
    details: unknown[];
  } => {
    const release: Record<string, string> = {
      date: formData.releaseDate,
      UPC: formData.upcEan,
    };

    if (formData.albumCoverPhotographer) release.photographer = formData.albumCoverPhotographer;
    if (formData.albumCoverDesigner) release.designer = formData.albumCoverDesigner;

    const buttons: Record<string, string> = {};

    formData.purchaseLinks.forEach((link) => {
      const purchaseKeyMap: Record<string, string> = {
        apple: 'itunes',
        bandcamp: 'bandcamp',
        amazon: 'amazon',
      };
      const key = purchaseKeyMap[link.service] || link.service;
      if (link.url) buttons[key] = link.url;
    });

    formData.streamingLinks.forEach((link) => {
      const streamingKeyMap: Record<string, string> = {
        applemusic: 'apple',
        vk: 'vk',
        youtube: 'youtube',
        spotify: 'spotify',
        yandex: 'yandex',
        deezer: 'deezer',
        tidal: 'tidal',
        googleplay: 'googleplay',
      };
      const key = streamingKeyMap[link.service] || link.service;
      if (link.url) buttons[key] = link.url;
    });

    const details: unknown[] = [];

    if (formData.bandMembers.length > 0) {
      details.push({
        id: details.length + 1,
        title: contentLang === 'ru' ? 'Исполнители' : 'Band members',
        content: formData.bandMembers.map((m) => `${m.name} — ${m.role}.`),
      });
    }

    if (formData.sessionMusicians.length > 0) {
      details.push({
        id: details.length + 1,
        title: contentLang === 'ru' ? 'Сессионные музыканты' : 'Session musicians',
        content: formData.sessionMusicians.map((m) => `${m.name} — ${m.role}.`),
      });
    }

    // Обрабатываем Producing, Recording/Mixing и Mastering отдельно
    const producingContent: unknown[] = [];
    const recordingMixingContent: unknown[] = [];
    const masteringContent: unknown[] = [];

    Object.entries(formData.producingCredits).forEach(([creditType, members]) => {
      if (members.length > 0) {
        members.forEach((member) => {
          const role = member.role || creditType;
          const creditText = `${member.name} — ${role}.`;

          if (creditType === 'Recording/Mixing') {
            recordingMixingContent.push(creditText);
          } else if (creditType === 'Mastering') {
            masteringContent.push(creditText);
          } else {
            producingContent.push(creditText);
          }
        });
      }
    });

    if (producingContent.length > 0) {
      details.push({
        id: details.length + 1,
        title: contentLang === 'ru' ? 'Продюсирование' : 'Producing',
        content: producingContent,
      });
    }

    if (recordingMixingContent.length > 0) {
      details.push({
        id: details.length + 1,
        title: contentLang === 'ru' ? 'Запись/сведение' : 'Recording/Mixing',
        content: recordingMixingContent,
      });
    }

    if (masteringContent.length > 0) {
      details.push({
        id: details.length + 1,
        title: contentLang === 'ru' ? 'Мастеринг' : 'Mastering',
        content: masteringContent,
      });
    }

    return { release, buttons, details };
  };

  const handlePublish = async () => {
    console.log('🚀 [EditAlbumModal] handlePublish called', {
      albumId,
      hasAlbumId: !!albumId,
      contentLang,
      albumsForContentLength: albumsForContent.length,
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
    const originalAlbum = albumsForContent.find((a: IAlbums) => a.albumId === albumId);
    const exists = !!originalAlbum;
    const method = exists ? 'PUT' : 'POST';

    console.log('📋 [EditAlbumModal] Album version check:', {
      albumId,
      contentLang,
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

    // Используем contentLang для сохранения
    const normalizedLang = contentLang;

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

    const { release, buttons, details } = transformFormDataToAlbumFormat();

    // Формируем fullName из artist и album
    const artistName = formData.artist || originalAlbum?.artist || '';
    const albumTitle = formData.title || originalAlbum?.album || '';
    const fullName = `${artistName} — ${albumTitle}`;

    console.log('📝 [EditAlbumModal] Form data before save:', {
      method,
      contentLang,
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
        contentLang: normalizedLang,
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
      console.log('🔄 [EditAlbumModal] Forcing fetchAlbums for contentLang:', contentLang);
      try {
        await dispatch(fetchAlbums({ lang: contentLang, force: true })).unwrap();
        console.log('✅ [EditAlbumModal] Redux store updated for', contentLang);
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
              onChange={(e) => setFormDataForLang((s) => ({ ...s, artist: e.target.value }))}
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
              onChange={(e) => setFormDataForLang((s) => ({ ...s, title: e.target.value }))}
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
              required
              value={formData.releaseDate ?? ''}
              onChange={(e) => setFormDataForLang((s) => ({ ...s, releaseDate: e.target.value }))}
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
              placeholder="Optional"
              value={formData.upcEan ?? ''}
              onChange={(e) => setFormDataForLang((s) => ({ ...s, upcEan: e.target.value }))}
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
              onChange={(e) => setFormDataForLang((s) => ({ ...s, description: e.target.value }))}
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
                value={formData.preorderReleaseDate}
                onChange={(e) => handleInputChange('preorderReleaseDate', e.target.value)}
              />
            </div>
          )}
        </>
      );
    }

    if (currentStep === 2) {
      return (
        <>
          <div className="edit-album-modal__divider" />

          <div className="edit-album-modal__field">
            <label className="edit-album-modal__label">Genre</label>

            <div className="edit-album-modal__multiselect" ref={moodDropdownRef}>
              <div
                className="edit-album-modal__multiselect-input"
                onClick={() => setMoodDropdownOpen(!moodDropdownOpen)}
              >
                {formData.mood.length > 0 ? (
                  <div className="edit-album-modal__tags-container">
                    {formData.mood.map((mood) => (
                      <span key={mood} className="edit-album-modal__tag">
                        {mood}
                        <button
                          type="button"
                          className="edit-album-modal__tag-remove"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveMood(mood);
                          }}
                          aria-label={`Remove ${mood}`}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="edit-album-modal__multiselect-placeholder">
                    Select genres...
                  </span>
                )}

                <span className="edit-album-modal__multiselect-arrow">
                  {moodDropdownOpen ? '⌃' : '⌄'}
                </span>
              </div>

              {moodDropdownOpen && (
                <div className="edit-album-modal__multiselect-dropdown">
                  {GENRE_OPTIONS.map((mood) => (
                    <label key={mood} className="edit-album-modal__multiselect-option">
                      <input
                        type="checkbox"
                        checked={formData.mood.includes(mood)}
                        onChange={() => handleMoodToggle(mood)}
                      />
                      <span>{mood}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="edit-album-modal__field">
            <label className="edit-album-modal__label">Tags</label>

            <div className="edit-album-modal__tags-input-wrapper">
              {formData.tags.length > 0 && (
                <div className="edit-album-modal__tags-container">
                  {formData.tags.map((tag) => (
                    <span key={tag} className="edit-album-modal__tag">
                      {tag}
                      <button
                        type="button"
                        className="edit-album-modal__tag-remove"
                        onClick={() => handleRemoveTag(tag)}
                        aria-label={`Remove ${tag}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <div className="edit-album-modal__tags-input-group">
                <input
                  ref={tagInputRef}
                  name="tag-input"
                  type="text"
                  autoComplete="off"
                  className="edit-album-modal__input edit-album-modal__input--tags"
                  placeholder="Add a tag..."
                  value={tagInput}
                  onChange={(e) => {
                    setTagInput(e.target.value);
                    setTagError('');
                  }}
                  onKeyDown={handleTagInputKeyDown}
                  disabled={formData.tags.length >= MAX_TAGS}
                />
                <button
                  type="button"
                  className="edit-album-modal__add-tag-button"
                  onClick={handleAddTag}
                  disabled={formData.tags.length >= MAX_TAGS || !tagInput.trim()}
                >
                  Add +
                </button>
              </div>

              {tagError && <div className="edit-album-modal__error">{tagError}</div>}
              {formData.tags.length >= MAX_TAGS && (
                <div className="edit-album-modal__help-text">Maximum {MAX_TAGS} tags reached</div>
              )}
            </div>
          </div>
        </>
      );
    }

    if (currentStep === 3) {
      return (
        <>
          <div className="edit-album-modal__divider" />

          <div className="edit-album-modal__field">
            <label className="edit-album-modal__label">Album Cover</label>
            <div className="edit-album-modal__two-column-inputs">
              <input
                name="album-cover-photographer"
                type="text"
                autoComplete="name"
                className="edit-album-modal__input"
                placeholder="Photographer"
                required
                value={formData.albumCoverPhotographer}
                onChange={(e) => handleInputChange('albumCoverPhotographer', e.target.value)}
              />
              <input
                name="album-cover-designer"
                type="text"
                autoComplete="name"
                className="edit-album-modal__input"
                placeholder="Designer"
                required
                value={formData.albumCoverDesigner}
                onChange={(e) => handleInputChange('albumCoverDesigner', e.target.value)}
              />
            </div>
          </div>

          <div className="edit-album-modal__field">
            <label className="edit-album-modal__label">Band Members</label>

            {formData.bandMembers.length > 0 && (
              <div className="edit-album-modal__list">
                {formData.bandMembers.map((member, index) => (
                  <div key={index} className="edit-album-modal__list-item">
                    <div className="edit-album-modal__list-item-content">
                      <span className="edit-album-modal__list-item-name">{member.name}</span>
                      <span className="edit-album-modal__list-item-role">{member.role}</span>
                    </div>
                    <div className="edit-album-modal__list-item-actions">
                      <button
                        type="button"
                        className="edit-album-modal__list-item-edit"
                        onClick={() => handleEditBandMember(index)}
                        aria-label={`Edit ${member.name}`}
                      >
                        ✎
                      </button>
                      <button
                        type="button"
                        className="edit-album-modal__list-item-remove"
                        onClick={() => handleRemoveBandMember(index)}
                        aria-label={`Remove ${member.name}`}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {formData.bandMembers.length >= MAX_BAND_MEMBERS && (
              <div className="edit-album-modal__help-text">
                Maximum {MAX_BAND_MEMBERS} band members reached
              </div>
            )}

            {formData.bandMembers.length < MAX_BAND_MEMBERS && (
              <>
                <div className="edit-album-modal__two-column-inputs">
                  <input
                    name="band-member-name"
                    type="text"
                    autoComplete="name"
                    className="edit-album-modal__input"
                    placeholder="Name"
                    value={bandMemberName}
                    onChange={(e) => setBandMemberName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && bandMemberName.trim() && bandMemberRole.trim()) {
                        e.preventDefault();
                        handleAddBandMember();
                      }
                      if (e.key === 'Escape' && editingBandMemberIndex !== null) {
                        handleCancelEditBandMember();
                      }
                    }}
                  />
                  <input
                    name="band-member-role"
                    type="text"
                    autoComplete="organization-title"
                    className="edit-album-modal__input"
                    placeholder="Role"
                    value={bandMemberRole}
                    onChange={(e) => setBandMemberRole(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && bandMemberName.trim() && bandMemberRole.trim()) {
                        e.preventDefault();
                        handleAddBandMember();
                      }
                      if (e.key === 'Escape' && editingBandMemberIndex !== null) {
                        handleCancelEditBandMember();
                      }
                    }}
                  />
                </div>

                <div className="edit-album-modal__add-button-group">
                  <button
                    type="button"
                    className="edit-album-modal__add-button"
                    onClick={handleAddBandMember}
                    disabled={!bandMemberName.trim() || !bandMemberRole.trim()}
                  >
                    {editingBandMemberIndex !== null ? 'Save' : '+ Add member'}
                  </button>

                  {editingBandMemberIndex !== null && (
                    <button
                      type="button"
                      className="edit-album-modal__cancel-button"
                      onClick={handleCancelEditBandMember}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="edit-album-modal__field">
            <label className="edit-album-modal__label">Session Musicians</label>

            {formData.sessionMusicians.length > 0 && (
              <div className="edit-album-modal__list">
                {formData.sessionMusicians.map((musician, index) => (
                  <div key={index} className="edit-album-modal__list-item">
                    <div className="edit-album-modal__list-item-content">
                      <span className="edit-album-modal__list-item-name">{musician.name}</span>
                      <span className="edit-album-modal__list-item-role">{musician.role}</span>
                    </div>
                    <div className="edit-album-modal__list-item-actions">
                      <button
                        type="button"
                        className="edit-album-modal__list-item-edit"
                        onClick={() => handleEditSessionMusician(index)}
                        aria-label={`Edit ${musician.name}`}
                      >
                        ✎
                      </button>
                      <button
                        type="button"
                        className="edit-album-modal__list-item-remove"
                        onClick={() => handleRemoveSessionMusician(index)}
                        aria-label={`Remove ${musician.name}`}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {formData.sessionMusicians.length >= MAX_BAND_MEMBERS && (
              <div className="edit-album-modal__help-text">
                Maximum {MAX_BAND_MEMBERS} session musicians reached
              </div>
            )}

            {formData.sessionMusicians.length < MAX_BAND_MEMBERS && (
              <>
                <div className="edit-album-modal__two-column-inputs">
                  <input
                    name="session-musician-name"
                    type="text"
                    autoComplete="name"
                    className="edit-album-modal__input"
                    placeholder="Name"
                    value={sessionMusicianName}
                    onChange={(e) => setSessionMusicianName(e.target.value)}
                    onKeyDown={(e) => {
                      if (
                        e.key === 'Enter' &&
                        sessionMusicianName.trim() &&
                        sessionMusicianRole.trim()
                      ) {
                        e.preventDefault();
                        handleAddSessionMusician();
                      }
                      if (e.key === 'Escape' && editingSessionMusicianIndex !== null) {
                        handleCancelEditSessionMusician();
                      }
                    }}
                  />
                  <input
                    name="session-musician-role"
                    type="text"
                    autoComplete="organization-title"
                    className="edit-album-modal__input"
                    placeholder="Role"
                    value={sessionMusicianRole}
                    onChange={(e) => setSessionMusicianRole(e.target.value)}
                    onKeyDown={(e) => {
                      if (
                        e.key === 'Enter' &&
                        sessionMusicianName.trim() &&
                        sessionMusicianRole.trim()
                      ) {
                        e.preventDefault();
                        handleAddSessionMusician();
                      }
                      if (e.key === 'Escape' && editingSessionMusicianIndex !== null) {
                        handleCancelEditSessionMusician();
                      }
                    }}
                  />
                </div>

                <div className="edit-album-modal__add-button-group">
                  <button
                    type="button"
                    className="edit-album-modal__add-button"
                    onClick={handleAddSessionMusician}
                    disabled={!sessionMusicianName.trim() || !sessionMusicianRole.trim()}
                  >
                    {editingSessionMusicianIndex !== null ? 'Save' : '+ Add musician'}
                  </button>

                  {editingSessionMusicianIndex !== null && (
                    <button
                      type="button"
                      className="edit-album-modal__cancel-button"
                      onClick={handleCancelEditSessionMusician}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="edit-album-modal__field">
            <label className="edit-album-modal__label">Producing</label>

            {DEFAULT_PRODUCING_CREDIT_TYPES.map((creditType) => {
              const members = formData.producingCredits[creditType] || [];
              const isEditing = editingProducingCredit?.creditType === creditType;

              return (
                <div key={creditType} className="edit-album-modal__producing-type-section">
                  <div className="edit-album-modal__producing-type-header">
                    <label className="edit-album-modal__producing-type-label">{creditType}</label>
                  </div>

                  {members.length > 0 && (
                    <div className="edit-album-modal__list">
                      {members.map((member, memberIndex) => (
                        <div key={memberIndex} className="edit-album-modal__list-item">
                          <div className="edit-album-modal__list-item-content">
                            <span className="edit-album-modal__list-item-name">{member.name}</span>
                            {member.role && (
                              <span className="edit-album-modal__list-item-role">
                                {member.role}
                              </span>
                            )}
                          </div>
                          <div className="edit-album-modal__list-item-actions">
                            <button
                              type="button"
                              className="edit-album-modal__list-item-edit"
                              onClick={() => handleEditProducingCredit(creditType, memberIndex)}
                              aria-label={`Edit ${member.name}`}
                            >
                              ✎
                            </button>
                            <button
                              type="button"
                              className="edit-album-modal__list-item-remove"
                              onClick={() => handleRemoveProducingCredit(creditType, memberIndex)}
                              aria-label={`Remove ${member.name}`}
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {isEditing ? (
                    <div className="edit-album-modal__producing-input-group">
                      <div className="edit-album-modal__two-column-inputs">
                        <input
                          name={`producing-${creditType}-name`}
                          type="text"
                          autoComplete="name"
                          className="edit-album-modal__input"
                          placeholder="Name"
                          value={producingNames[creditType] || ''}
                          onChange={(e) =>
                            setProducingNames((prev) => ({ ...prev, [creditType]: e.target.value }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && producingNames[creditType]?.trim()) {
                              e.preventDefault();
                              handleAddProducingCredit(creditType);
                            }
                            if (e.key === 'Escape') handleCancelEditProducingCredit();
                          }}
                          autoFocus
                        />
                        <input
                          name={`producing-${creditType}-role`}
                          type="text"
                          autoComplete="organization-title"
                          className="edit-album-modal__input"
                          placeholder="Role"
                          value={producingRoles[creditType] || ''}
                          onChange={(e) =>
                            setProducingRoles((prev) => ({ ...prev, [creditType]: e.target.value }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && producingNames[creditType]?.trim()) {
                              e.preventDefault();
                              handleAddProducingCredit(creditType);
                            }
                            if (e.key === 'Escape') handleCancelEditProducingCredit();
                          }}
                        />
                      </div>

                      <div className="edit-album-modal__add-button-group">
                        <button
                          type="button"
                          className="edit-album-modal__add-button"
                          onClick={() => handleAddProducingCredit(creditType)}
                          disabled={!producingNames[creditType]?.trim()}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          className="edit-album-modal__cancel-button"
                          onClick={handleCancelEditProducingCredit}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="edit-album-modal__producing-input-group">
                      <div className="edit-album-modal__two-column-inputs">
                        <input
                          name={`producing-${creditType}-name`}
                          type="text"
                          autoComplete="name"
                          className="edit-album-modal__input"
                          placeholder="Name"
                          value={producingNames[creditType] || ''}
                          onChange={(e) =>
                            setProducingNames((prev) => ({ ...prev, [creditType]: e.target.value }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && producingNames[creditType]?.trim()) {
                              e.preventDefault();
                              handleAddProducingCredit(creditType);
                            }
                          }}
                        />
                        <input
                          name={`producing-${creditType}-role`}
                          type="text"
                          autoComplete="organization-title"
                          className="edit-album-modal__input"
                          placeholder="Role"
                          value={producingRoles[creditType] || ''}
                          onChange={(e) =>
                            setProducingRoles((prev) => ({ ...prev, [creditType]: e.target.value }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && producingNames[creditType]?.trim()) {
                              e.preventDefault();
                              handleAddProducingCredit(creditType);
                            }
                          }}
                        />
                      </div>
                      <button
                        type="button"
                        className="edit-album-modal__add-button"
                        onClick={() => handleAddProducingCredit(creditType)}
                        disabled={!producingNames[creditType]?.trim()}
                      >
                        + Add
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {Object.keys(formData.producingCredits)
              .filter((type) => !DEFAULT_PRODUCING_CREDIT_TYPES.includes(type))
              .map((creditType) => {
                const members = formData.producingCredits[creditType] || [];
                const isEditing = editingProducingCredit?.creditType === creditType;

                return (
                  <div key={creditType} className="edit-album-modal__producing-type-section">
                    <div className="edit-album-modal__producing-type-header">
                      <label className="edit-album-modal__producing-type-label">{creditType}</label>
                      <button
                        type="button"
                        className="edit-album-modal__remove-type-button"
                        onClick={() => handleRemoveCreditType(creditType)}
                        aria-label={`Remove ${creditType} type`}
                      >
                        ×
                      </button>
                    </div>

                    {members.length > 0 && (
                      <div className="edit-album-modal__list">
                        {members.map((member, memberIndex) => (
                          <div key={memberIndex} className="edit-album-modal__list-item">
                            <div className="edit-album-modal__list-item-content">
                              <span className="edit-album-modal__list-item-name">
                                {member.name}
                              </span>
                              {member.role && (
                                <span className="edit-album-modal__list-item-role">
                                  {member.role}
                                </span>
                              )}
                            </div>
                            <div className="edit-album-modal__list-item-actions">
                              <button
                                type="button"
                                className="edit-album-modal__list-item-edit"
                                onClick={() => handleEditProducingCredit(creditType, memberIndex)}
                                aria-label={`Edit ${member.name}`}
                              >
                                ✎
                              </button>
                              <button
                                type="button"
                                className="edit-album-modal__list-item-remove"
                                onClick={() => handleRemoveProducingCredit(creditType, memberIndex)}
                                aria-label={`Remove ${member.name}`}
                              >
                                ×
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {isEditing ? (
                      <div className="edit-album-modal__producing-input-group">
                        <div className="edit-album-modal__two-column-inputs">
                          <input
                            name={`producing-${creditType}-name`}
                            type="text"
                            autoComplete="name"
                            className="edit-album-modal__input"
                            placeholder="Name"
                            value={producingNames[creditType] || ''}
                            onChange={(e) =>
                              setProducingNames((prev) => ({
                                ...prev,
                                [creditType]: e.target.value,
                              }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && producingNames[creditType]?.trim()) {
                                e.preventDefault();
                                handleAddProducingCredit(creditType);
                              }
                              if (e.key === 'Escape') handleCancelEditProducingCredit();
                            }}
                            autoFocus
                          />
                          <input
                            name={`producing-${creditType}-role`}
                            type="text"
                            autoComplete="organization-title"
                            className="edit-album-modal__input"
                            placeholder="Role"
                            value={producingRoles[creditType] || ''}
                            onChange={(e) =>
                              setProducingRoles((prev) => ({
                                ...prev,
                                [creditType]: e.target.value,
                              }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && producingNames[creditType]?.trim()) {
                                e.preventDefault();
                                handleAddProducingCredit(creditType);
                              }
                              if (e.key === 'Escape') handleCancelEditProducingCredit();
                            }}
                          />
                        </div>

                        <div className="edit-album-modal__add-button-group">
                          <button
                            type="button"
                            className="edit-album-modal__add-button"
                            onClick={() => handleAddProducingCredit(creditType)}
                            disabled={!producingNames[creditType]?.trim()}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            className="edit-album-modal__cancel-button"
                            onClick={handleCancelEditProducingCredit}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="edit-album-modal__producing-input-group">
                        <div className="edit-album-modal__two-column-inputs">
                          <input
                            name={`producing-${creditType}-name`}
                            type="text"
                            autoComplete="name"
                            className="edit-album-modal__input"
                            placeholder="Name"
                            value={producingNames[creditType] || ''}
                            onChange={(e) =>
                              setProducingNames((prev) => ({
                                ...prev,
                                [creditType]: e.target.value,
                              }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && producingNames[creditType]?.trim()) {
                                e.preventDefault();
                                handleAddProducingCredit(creditType);
                              }
                            }}
                          />
                          <input
                            name={`producing-${creditType}-role`}
                            type="text"
                            autoComplete="organization-title"
                            className="edit-album-modal__input"
                            placeholder="Role"
                            value={producingRoles[creditType] || ''}
                            onChange={(e) =>
                              setProducingRoles((prev) => ({
                                ...prev,
                                [creditType]: e.target.value,
                              }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && producingNames[creditType]?.trim()) {
                                e.preventDefault();
                                handleAddProducingCredit(creditType);
                              }
                            }}
                          />
                        </div>
                        <button
                          type="button"
                          className="edit-album-modal__add-button"
                          onClick={() => handleAddProducingCredit(creditType)}
                          disabled={!producingNames[creditType]?.trim()}
                        >
                          + Add
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

            <div className="edit-album-modal__producing-new-type">
              <div className="edit-album-modal__producing-input-group">
                <input
                  name="new-credit-type"
                  type="text"
                  autoComplete="off"
                  className="edit-album-modal__input"
                  placeholder="New credit type"
                  value={newCreditType}
                  onChange={(e) => setNewCreditType(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newCreditType.trim()) {
                      e.preventDefault();
                      handleAddNewCreditType();
                    }
                  }}
                />
                <button
                  type="button"
                  className="edit-album-modal__add-button"
                  onClick={handleAddNewCreditType}
                  disabled={!newCreditType.trim()}
                >
                  + Add type
                </button>
              </div>
            </div>
          </div>
        </>
      );
    }

    if (currentStep === 4) {
      return (
        <>
          <div className="edit-album-modal__divider" />

          <div className="edit-album-modal__links-container">
            <div className="edit-album-modal__links-column">
              <label className="edit-album-modal__links-label">Purchase</label>

              <div className="edit-album-modal__links-list">
                {formData.purchaseLinks.map((link, index) => {
                  const service = PURCHASE_SERVICES.find((s) => s.id === link.service);
                  const isEditing = editingPurchaseLink === index;

                  return (
                    <div key={index} className="edit-album-modal__link-item">
                      {isEditing ? (
                        <div className="edit-album-modal__link-edit">
                          <select
                            name="purchase-link-service"
                            autoComplete="off"
                            className="edit-album-modal__link-select"
                            value={purchaseLinkService}
                            onChange={(e) => setPurchaseLinkService(e.target.value)}
                          >
                            <option value="">Select service</option>
                            {PURCHASE_SERVICES.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                          </select>

                          <input
                            name="purchase-link-url"
                            type="url"
                            autoComplete="url"
                            className="edit-album-modal__link-input"
                            placeholder="URL"
                            value={purchaseLinkUrl}
                            onChange={(e) => setPurchaseLinkUrl(e.target.value)}
                            onKeyDown={(e) => {
                              if (
                                e.key === 'Enter' &&
                                purchaseLinkService.trim() &&
                                purchaseLinkUrl.trim()
                              ) {
                                e.preventDefault();
                                handleAddPurchaseLink();
                              }
                              if (e.key === 'Escape') handleCancelEditPurchaseLink();
                            }}
                            autoFocus
                          />

                          <div className="edit-album-modal__link-actions">
                            <button
                              type="button"
                              className="edit-album-modal__link-save"
                              onClick={handleAddPurchaseLink}
                              disabled={!purchaseLinkService.trim() || !purchaseLinkUrl.trim()}
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              className="edit-album-modal__link-cancel"
                              onClick={handleCancelEditPurchaseLink}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="edit-album-modal__link-content">
                            {service && (
                              <span className={`edit-album-modal__link-icon ${service.icon}`} />
                            )}
                            <span className="edit-album-modal__link-name">
                              {service ? service.name : link.service}
                            </span>
                          </div>
                          <div className="edit-album-modal__link-item-actions">
                            <button
                              type="button"
                              className="edit-album-modal__list-item-edit"
                              onClick={() => handleEditPurchaseLink(index)}
                              aria-label={`Edit ${service ? service.name : link.service}`}
                            >
                              ✎
                            </button>
                            <button
                              type="button"
                              className="edit-album-modal__list-item-remove"
                              onClick={() => handleRemovePurchaseLink(index)}
                              aria-label={`Remove ${service ? service.name : link.service}`}
                            >
                              ×
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>

              {editingPurchaseLink === null && (
                <div className="edit-album-modal__link-add">
                  <select
                    name="purchase-link-service"
                    autoComplete="off"
                    className="edit-album-modal__link-select"
                    value={purchaseLinkService}
                    onChange={(e) => setPurchaseLinkService(e.target.value)}
                  >
                    <option value="">Select service</option>
                    {PURCHASE_SERVICES.filter(
                      (s) => !formData.purchaseLinks.some((l) => l.service === s.id)
                    ).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>

                  <input
                    name="purchase-link-url"
                    type="url"
                    autoComplete="url"
                    className="edit-album-modal__link-input"
                    placeholder="URL"
                    value={purchaseLinkUrl}
                    onChange={(e) => setPurchaseLinkUrl(e.target.value)}
                    onKeyDown={(e) => {
                      if (
                        e.key === 'Enter' &&
                        purchaseLinkService.trim() &&
                        purchaseLinkUrl.trim()
                      ) {
                        e.preventDefault();
                        handleAddPurchaseLink();
                      }
                    }}
                  />

                  <button
                    type="button"
                    className="edit-album-modal__add-button"
                    onClick={handleAddPurchaseLink}
                    disabled={!purchaseLinkService.trim() || !purchaseLinkUrl.trim()}
                  >
                    + Add
                  </button>
                </div>
              )}
            </div>

            <div className="edit-album-modal__links-column">
              <label className="edit-album-modal__links-label">Streaming</label>

              <div className="edit-album-modal__links-list">
                {formData.streamingLinks.map((link, index) => {
                  const service = STREAMING_SERVICES.find((s) => s.id === link.service);
                  const isEditing = editingStreamingLink === index;

                  return (
                    <div key={index} className="edit-album-modal__link-item">
                      {isEditing ? (
                        <div className="edit-album-modal__link-edit">
                          <select
                            name="streaming-link-service"
                            autoComplete="off"
                            className="edit-album-modal__link-select"
                            value={streamingLinkService}
                            onChange={(e) => setStreamingLinkService(e.target.value)}
                          >
                            <option value="">Select service</option>
                            {STREAMING_SERVICES.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                          </select>

                          <input
                            name="streaming-link-url"
                            type="url"
                            autoComplete="url"
                            className="edit-album-modal__link-input"
                            placeholder="URL"
                            value={streamingLinkUrl}
                            onChange={(e) => setStreamingLinkUrl(e.target.value)}
                            onKeyDown={(e) => {
                              if (
                                e.key === 'Enter' &&
                                streamingLinkService.trim() &&
                                streamingLinkUrl.trim()
                              ) {
                                e.preventDefault();
                                handleAddStreamingLink();
                              }
                              if (e.key === 'Escape') handleCancelEditStreamingLink();
                            }}
                            autoFocus
                          />

                          <div className="edit-album-modal__link-actions">
                            <button
                              type="button"
                              className="edit-album-modal__link-save"
                              onClick={handleAddStreamingLink}
                              disabled={!streamingLinkService.trim() || !streamingLinkUrl.trim()}
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              className="edit-album-modal__link-cancel"
                              onClick={handleCancelEditStreamingLink}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="edit-album-modal__link-content">
                            {service && (
                              <span className={`edit-album-modal__link-icon ${service.icon}`} />
                            )}
                            <span className="edit-album-modal__link-name">
                              {service ? service.name : link.service}
                            </span>
                          </div>
                          <div className="edit-album-modal__link-item-actions">
                            <button
                              type="button"
                              className="edit-album-modal__list-item-edit"
                              onClick={() => handleEditStreamingLink(index)}
                              aria-label={`Edit ${service ? service.name : link.service}`}
                            >
                              ✎
                            </button>
                            <button
                              type="button"
                              className="edit-album-modal__list-item-remove"
                              onClick={() => handleRemoveStreamingLink(index)}
                              aria-label={`Remove ${service ? service.name : link.service}`}
                            >
                              ×
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>

              {editingStreamingLink === null && (
                <div className="edit-album-modal__link-add">
                  <select
                    name="streaming-link-service"
                    autoComplete="off"
                    className="edit-album-modal__link-select"
                    value={streamingLinkService}
                    onChange={(e) => setStreamingLinkService(e.target.value)}
                  >
                    <option value="">Select service</option>
                    {STREAMING_SERVICES.filter(
                      (s) => !formData.streamingLinks.some((l) => l.service === s.id)
                    ).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>

                  <input
                    name="streaming-link-url"
                    type="url"
                    autoComplete="url"
                    className="edit-album-modal__link-input"
                    placeholder="URL"
                    value={streamingLinkUrl}
                    onChange={(e) => setStreamingLinkUrl(e.target.value)}
                    onKeyDown={(e) => {
                      if (
                        e.key === 'Enter' &&
                        streamingLinkService.trim() &&
                        streamingLinkUrl.trim()
                      ) {
                        e.preventDefault();
                        handleAddStreamingLink();
                      }
                    }}
                  />

                  <button
                    type="button"
                    className="edit-album-modal__add-button"
                    onClick={handleAddStreamingLink}
                    disabled={!streamingLinkService.trim() || !streamingLinkUrl.trim()}
                  >
                    + Add
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
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
                    : albumId && albumsForContent?.some((a: IAlbums) => a.albumId === albumId)
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
