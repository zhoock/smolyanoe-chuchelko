// src/pages/UserDashboard/components/EditAlbumModal.tsx
import React, { useState, useRef, useEffect } from 'react';
import { Popup } from '@shared/ui/popup';
import { AlertModal } from '@shared/ui/alertModal';
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
  RecordingEntry,
  StreamingLink,
} from './EditAlbumModal.types';
import {
  GENRE_OPTIONS_EN,
  GENRE_OPTIONS_RU,
  MAX_TAGS,
  MIN_TAG_LENGTH,
  MAX_TAG_LENGTH,
  MAX_BAND_MEMBERS,
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
  parseRecordingText,
  buildRecordingText,
} from './EditAlbumModal.utils';
import { EditAlbumModalStep1 } from '../../steps/EditAlbumModalStep1';
import { EditAlbumModalStep2 } from '../../steps/EditAlbumModalStep2';
import { EditAlbumModalStep3 } from '../../steps/EditAlbumModalStep3';
import { EditAlbumModalStep4 } from '../../steps/EditAlbumModalStep4';
import { EditAlbumModalStep5 } from '../../steps/EditAlbumModalStep5';
import './EditAlbumModal.style.scss';

// Re-export types for backward compatibility
export type {
  EditAlbumModalProps,
  BandMember,
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
  const [bandMemberURL, setBandMemberURL] = useState('');
  const [editingBandMemberIndex, setEditingBandMemberIndex] = useState<number | null>(null);

  const [sessionMusicianName, setSessionMusicianName] = useState('');
  const [sessionMusicianRole, setSessionMusicianRole] = useState('');
  const [sessionMusicianURL, setSessionMusicianURL] = useState('');
  const [editingSessionMusicianIndex, setEditingSessionMusicianIndex] = useState<number | null>(
    null
  );

  const [producerName, setProducerName] = useState('');
  const [producerRole, setProducerRole] = useState('');
  const [producerURL, setProducerURL] = useState('');
  const [editingProducerIndex, setEditingProducerIndex] = useState<number | null>(null);

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
  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    title?: string;
    message: string;
    variant?: 'success' | 'error' | 'warning' | 'info';
  } | null>(null);

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
  const handleInputChange = (field: keyof AlbumFormData, value: any) => {
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

    // Парсим details, если это строка (JSONB из базы может приходить как строка)
    // ДОЛЖНО БЫТЬ ПЕРЕД ВСЕМИ ПАРСИНГАМИ!
    let parsedDetails = album.details;
    if (typeof album.details === 'string') {
      try {
        parsedDetails = JSON.parse(album.details);
      } catch (e) {
        console.error('[EditAlbumModal] Error parsing details:', e);
        parsedDetails = [];
      }
    }

    // --- парсинг band members ---
    const bandMembers: BandMember[] = [];
    const bandMembersDetail = Array.isArray(parsedDetails)
      ? parsedDetails.find(
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
            // Удаляем точку в конце role, если она есть (чтобы избежать двойных точек при сохранении)
            const role = match[2].trim().replace(/\.+$/, '');
            const url = item.link ? String(item.link).trim() : undefined;
            if (name && role) bandMembers.push({ name, role, url });
          } else if (fullText.trim()) {
            const url = item.link ? String(item.link).trim() : undefined;
            bandMembers.push({ name: fullText.trim(), role: '', url });
          }
        } else if (typeof item === 'string' && item.trim()) {
          const match = item.match(/^(.+?)\s*—\s*(.+)$/);
          if (match) {
            const name = match[1].trim();
            // Удаляем точку в конце role, если она есть (чтобы избежать двойных точек при сохранении)
            const role = match[2].trim().replace(/\.+$/, '');
            if (name && role) bandMembers.push({ name, role });
          } else {
            bandMembers.push({ name: item.trim(), role: '' });
          }
        }
      }
    }

    // --- парсинг session musicians ---
    const sessionMusicians: BandMember[] = [];
    const sessionMusiciansDetail = Array.isArray(parsedDetails)
      ? parsedDetails.find(
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
            // Удаляем точку в конце role, если она есть (чтобы избежать двойных точек при сохранении)
            const role = match[2].trim().replace(/\.+$/, '');
            const url = item.link ? String(item.link).trim() : undefined;
            if (name && role) sessionMusicians.push({ name, role, url });
          } else if (fullText.trim()) {
            const url = item.link ? String(item.link).trim() : undefined;
            sessionMusicians.push({ name: fullText.trim(), role: '', url });
          }
        } else if (typeof item === 'string' && item.trim()) {
          const match = item.match(/^(.+?)\s*—\s*(.+)$/);
          if (match) {
            const name = match[1].trim();
            // Удаляем точку в конце role, если она есть (чтобы избежать двойных точек при сохранении)
            const role = match[2].trim().replace(/\.+$/, '');
            if (name && role) sessionMusicians.push({ name, role });
          } else {
            sessionMusicians.push({ name: item.trim(), role: '' });
          }
        }
      }
    }

    // --- парсинг Genre из details ---
    const mood: string[] = [];

    // Выбираем список опций жанров в зависимости от языка сайта
    const genreOptions = lang === 'ru' ? GENRE_OPTIONS_RU : GENRE_OPTIONS_EN;

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

    if (genreDetail && (genreDetail as any).content) {
      // Обрабатываем content - новый формат: массив строк в нижнем регистре ["grunge", "alternative rock"]
      // Поддерживаем обратную совместимость со старым форматом (строка с запятыми)
      const content = (genreDetail as any).content;

      if (Array.isArray(content)) {
        content.forEach((item: unknown) => {
          if (typeof item !== 'string' || !item.trim()) return;

          const genreLower = item.toLowerCase().trim();

          // Поддерживаем старый формат: "Grunge, alternative rock." (строка с запятыми и точкой)
          if (genreLower.includes(',')) {
            // Старый формат - разбиваем по запятым
            const parsedGenres = genreLower
              .split(',')
              .map((g: string) => g.trim().replace(/\.$/, ''))
              .filter((g: string) => g.length > 0);

            parsedGenres.forEach((parsedGenre: string) => {
              // Ищем точное совпадение в genreOptions (case-insensitive)
              const matchedOption = genreOptions.find((option) => {
                const optionLower = option.toLowerCase();
                return (
                  optionLower === parsedGenre ||
                  optionLower.replace(/\s+/g, ' ') === parsedGenre.replace(/\s+/g, ' ')
                );
              });

              const finalOption = matchedOption || parsedGenre;
              if (finalOption && !mood.includes(finalOption)) {
                mood.push(finalOption);
              }
            });
          } else {
            // Новый формат - один элемент массива это строка с жанрами через запятую и точкой в конце
            // Например: "Grunge, alternative rock." или "Grunge."
            // Разбиваем по запятым, убираем точку в конце
            const genreWithoutDot = genreLower.replace(/\.$/, '').trim();
            const parsedGenres = genreWithoutDot
              .split(',')
              .map((g: string) => g.trim())
              .filter((g: string) => g.length > 0);

            parsedGenres.forEach((parsedGenre: string) => {
              // Ищем точное совпадение в genreOptions (case-insensitive)
              const matchedOption = genreOptions.find((option) => {
                const optionLower = option.toLowerCase();
                return (
                  optionLower === parsedGenre ||
                  optionLower.replace(/\s+/g, ' ') === parsedGenre.replace(/\s+/g, ' ')
                );
              });

              // Используем matchedOption (с правильным регистром) или parsedGenre как fallback
              const finalOption = matchedOption || parsedGenre;
              if (finalOption && !mood.includes(finalOption)) {
                mood.push(finalOption);
              }
            });
          }
        });
      }
    }

    // --- парсинг Recorded At ---
    const recordedAt: RecordingEntry[] = [];
    const recordedAtDetail = Array.isArray(parsedDetails)
      ? parsedDetails.find(
          (detail) => detail && (detail.title === 'Recorded At' || detail.title === 'Запись')
        )
      : null;

    if (recordedAtDetail && (recordedAtDetail as any).content) {
      for (const item of (recordedAtDetail as any).content) {
        if (!item || typeof item !== 'object' || !item.dateFrom) continue;

        // Новый формат: { dateFrom, dateTo?, studioText, city?, url }
        recordedAt.push({
          text: buildRecordingText(item.dateFrom, item.dateTo, item.studioText, item.city, lang),
          url: item.url || undefined,
          dateFrom: item.dateFrom,
          dateTo: item.dateTo,
          studioText: item.studioText,
          city: item.city,
        });
      }
    }

    // --- парсинг Mixed At ---
    const mixedAt: RecordingEntry[] = [];
    const mixedAtDetail = Array.isArray(parsedDetails)
      ? parsedDetails.find(
          (detail) => detail && (detail.title === 'Mixed At' || detail.title === 'Сведение')
        )
      : null;

    if (mixedAtDetail && (mixedAtDetail as any).content) {
      for (const item of (mixedAtDetail as any).content) {
        if (!item || typeof item !== 'object' || !item.dateFrom) continue;

        // Новый формат: { dateFrom, dateTo?, studioText, city?, url }
        mixedAt.push({
          text: buildRecordingText(item.dateFrom, item.dateTo, item.studioText, item.city, lang),
          url: item.url || undefined,
          dateFrom: item.dateFrom,
          dateTo: item.dateTo,
          studioText: item.studioText,
          city: item.city,
        });
      }
    }

    // --- парсинг Producer ---
    const producer: BandMember[] = [];
    const producingDetail = Array.isArray(parsedDetails)
      ? parsedDetails.find(
          (detail) =>
            detail &&
            (detail.title === 'Producing' ||
              detail.title === 'Продюсирование' ||
              detail.title === 'Продюсер')
        )
      : null;

    if (producingDetail && (producingDetail as any).content) {
      for (const item of (producingDetail as any).content) {
        if (!item) continue;

        // Новый формат: объект с text: ["Имя", "роль"]
        if (typeof item === 'object' && item?.text && Array.isArray(item.text)) {
          const textArray = item.text;

          // Формат ["Имя", "роль"]
          if (textArray.length === 2) {
            const name = String(textArray[0]).trim();
            const role = String(textArray[1]).trim();

            // Пропускаем записи с mastering/мастеринг (они обрабатываются в блоке Mastered By)
            const roleLower = role.toLowerCase();
            if (!roleLower.includes('mastering') && !roleLower.includes('мастеринг')) {
              if (name && role) {
                producer.push({
                  name,
                  role,
                  url: item.link ? String(item.link).trim() : undefined,
                });
              }
            }
          }
          // Старый формат ["", "Имя", " — роль"] для обратной совместимости
          else if (
            textArray.length === 3 &&
            textArray[0] === '' &&
            textArray[2].startsWith(' — ')
          ) {
            const name = String(textArray[1]).trim();
            const role = String(textArray[2]).replace(/^ — /, '').trim();
            const roleLower = role.toLowerCase();
            if (!roleLower.includes('mastering') && !roleLower.includes('мастеринг')) {
              if (name && role) {
                producer.push({
                  name,
                  role,
                  url: item.link ? String(item.link).trim() : undefined,
                });
              }
            }
          }
        }
        // Старый формат: строка (для обратной совместимости)
        else if (typeof item === 'string' && item.trim()) {
          const fullText = item.trim();
          const roleTextLower = fullText.toLowerCase();
          if (!roleTextLower.includes('mastering') && !roleTextLower.includes('мастеринг')) {
            // Пытаемся разбить строку "Имя — роль"
            const match = fullText.match(/^(.+?)\s*—\s*(.+)$/);
            if (match) {
              producer.push({
                name: match[1].trim(),
                role: match[2].trim(),
              });
            } else {
              // Если не удалось разбить, сохраняем как роль без имени
              producer.push({
                name: '',
                role: fullText,
              });
            }
          }
        }
      }
    }

    // --- парсинг Mastered By ---
    const mastering: RecordingEntry[] = [];

    // Ищем отдельный блок "Mastered By" / "Мастеринг"
    const masteredByDetail = Array.isArray(parsedDetails)
      ? parsedDetails.find(
          (detail) => detail && (detail.title === 'Mastered By' || detail.title === 'Мастеринг')
        )
      : null;

    if (masteredByDetail && (masteredByDetail as any).content) {
      for (const item of (masteredByDetail as any).content) {
        if (!item || typeof item !== 'object' || !item.dateFrom) continue;

        // Новый формат: { dateFrom, dateTo?, studioText, city?, url }
        mastering.push({
          text: buildRecordingText(item.dateFrom, item.dateTo, item.studioText, item.city, lang),
          url: item.url || undefined,
          dateFrom: item.dateFrom,
          dateTo: item.dateTo,
          studioText: item.studioText,
          city: item.city,
        });
      }
    }

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
        allowDownloadSale:
          ((release as any).allowDownloadSale as 'no' | 'yes' | 'preorder') ||
          prevForm.allowDownloadSale ||
          'no',
        regularPrice: (release as any).regularPrice || prevForm.regularPrice || '9.99',
        currency: (release as any).currency || prevForm.currency || 'USD',
        preorderReleaseDate: (release as any).preorderReleaseDate
          ? formatDateFromISO((release as any).preorderReleaseDate)
          : prevForm.preorderReleaseDate || '',
        albumCoverPhotographer: (release as any).photographer || prevForm.albumCoverPhotographer,
        albumCoverPhotographerURL:
          (release as any).photographerURL || prevForm.albumCoverPhotographerURL,
        albumCoverDesigner: (release as any).designer || prevForm.albumCoverDesigner,
        albumCoverDesignerURL: (release as any).designerURL || prevForm.albumCoverDesignerURL,
        bandMembers: bandMembers.length > 0 ? bandMembers : prevForm.bandMembers,
        sessionMusicians:
          sessionMusicians.length > 0 ? sessionMusicians : prevForm.sessionMusicians,
        producingCredits: prevForm.producingCredits, // Оставляем для обратной совместимости, но больше не используем
        recordedAt: recordedAt,
        mixedAt: mixedAt,
        producer: producer.length > 0 ? producer : prevForm.producer || [],
        mastering: mastering.length > 0 ? mastering : prevForm.mastering || [],
        showAddBandMemberInputs: false,
        showAddSessionMusicianInputs: false,
        showAddRecordedAtInputs: false,
        showAddMixedAtInputs: false,
        showAddProducerInputs: false,
        showAddMasteringInputs: false,
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

    // Если URL пустой или только пробелы, устанавливаем undefined (не пустую строку)
    const url =
      bandMemberURL?.trim() && bandMemberURL.trim().length > 0 ? bandMemberURL.trim() : undefined;

    if (editingBandMemberIndex !== null) {
      // Редактирование существующего элемента - закрываем поля после сохранения
      setFormData((prev) => {
        const updated = [...(prev.bandMembers || [])];
        updated[editingBandMemberIndex] = {
          name: bandMemberName.trim(),
          role: bandMemberRole.trim(),
          url, // undefined если пустой
        };
        return { ...prev, bandMembers: updated, showAddBandMemberInputs: false };
      });
      setEditingBandMemberIndex(null);
      setBandMemberName('');
      setBandMemberRole('');
      setBandMemberURL('');
    } else {
      // Добавление нового элемента - закрываем поля после добавления
      setFormData((prev) => ({
        ...prev,
        bandMembers: [
          ...(prev.bandMembers || []),
          { name: bandMemberName.trim(), role: bandMemberRole.trim(), url }, // undefined если пустой
        ],
        showAddBandMemberInputs: false,
      }));
      setBandMemberName('');
      setBandMemberRole('');
      setBandMemberURL('');
    }
  };

  const handleEditBandMember = (index: number) => {
    const member = formData.bandMembers[index];
    setBandMemberName(member.name);
    setBandMemberRole(member.role);
    setBandMemberURL(member.url || '');
    setEditingBandMemberIndex(index);
  };

  const handleCancelEditBandMember = () => {
    setBandMemberName('');
    setBandMemberRole('');
    setBandMemberURL('');
    setEditingBandMemberIndex(null);
    handleInputChange('showAddBandMemberInputs', false);
  };

  const handleRemoveBandMember = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      bandMembers: (prev.bandMembers || []).filter((_, i) => i !== index),
    }));
    if (editingBandMemberIndex === index) handleCancelEditBandMember();
  };

  const handleAddProducer = () => {
    if (!producerName.trim() || !producerRole.trim()) return;

    // Если URL пустой или только пробелы, устанавливаем undefined (не пустую строку)
    const url =
      producerURL?.trim() && producerURL.trim().length > 0 ? producerURL.trim() : undefined;

    if (editingProducerIndex !== null) {
      // Редактирование существующего элемента - закрываем поля после сохранения
      setFormData((prev) => {
        const updated = [...(prev.producer || [])];
        updated[editingProducerIndex] = {
          name: producerName.trim(),
          role: producerRole.trim(),
          url, // undefined если пустой
        };
        return { ...prev, producer: updated, showAddProducerInputs: false };
      });
      setEditingProducerIndex(null);
      setProducerName('');
      setProducerRole('');
      setProducerURL('');
    } else {
      // Добавление нового элемента - закрываем поля после добавления
      setFormData((prev) => ({
        ...prev,
        producer: [
          ...(prev.producer || []),
          { name: producerName.trim(), role: producerRole.trim(), url },
        ],
        showAddProducerInputs: false,
      }));
      setProducerName('');
      setProducerRole('');
      setProducerURL('');
    }
  };

  const handleEditProducer = (index: number) => {
    const member = formData.producer[index];
    setProducerName(member.name);
    setProducerRole(member.role);
    setProducerURL(member.url || '');
    setEditingProducerIndex(index);
  };

  const handleCancelEditProducer = () => {
    setProducerName('');
    setProducerRole('');
    setProducerURL('');
    setEditingProducerIndex(null);
    handleInputChange('showAddProducerInputs', false);
  };

  const handleRemoveProducer = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      producer: (prev.producer || []).filter((_, i) => i !== index),
    }));
    if (editingProducerIndex === index) handleCancelEditProducer();
  };

  const handleAddSessionMusician = () => {
    if (!sessionMusicianName.trim() || !sessionMusicianRole.trim()) return;

    // Если URL пустой или только пробелы, устанавливаем undefined (не пустую строку)
    const url =
      sessionMusicianURL?.trim() && sessionMusicianURL.trim().length > 0
        ? sessionMusicianURL.trim()
        : undefined;

    if (editingSessionMusicianIndex !== null) {
      // Редактирование существующего элемента - закрываем поля после сохранения
      setFormData((prev) => {
        const updated = [...(prev.sessionMusicians || [])];
        updated[editingSessionMusicianIndex] = {
          name: sessionMusicianName.trim(),
          role: sessionMusicianRole.trim(),
          url,
        };
        return { ...prev, sessionMusicians: updated, showAddSessionMusicianInputs: false };
      });
      setEditingSessionMusicianIndex(null);
      setSessionMusicianName('');
      setSessionMusicianRole('');
      setSessionMusicianURL('');
    } else {
      // Добавление нового элемента - закрываем поля после добавления
      setFormData((prev) => ({
        ...prev,
        sessionMusicians: [
          ...(prev.sessionMusicians || []),
          { name: sessionMusicianName.trim(), role: sessionMusicianRole.trim(), url },
        ],
        showAddSessionMusicianInputs: false,
      }));
      setSessionMusicianName('');
      setSessionMusicianRole('');
      setSessionMusicianURL('');
    }
  };

  const handleEditSessionMusician = (index: number) => {
    const musician = formData.sessionMusicians[index];
    setSessionMusicianName(musician.name);
    setSessionMusicianRole(musician.role);
    setSessionMusicianURL(musician.url || '');
    setEditingSessionMusicianIndex(index);
  };

  const handleCancelEditSessionMusician = () => {
    setSessionMusicianName('');
    setSessionMusicianRole('');
    setSessionMusicianURL('');
    setEditingSessionMusicianIndex(null);
    handleInputChange('showAddSessionMusicianInputs', false);
  };

  const handleRemoveSessionMusician = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      sessionMusicians: (prev.sessionMusicians || []).filter((_, i) => i !== index),
    }));
    if (editingSessionMusicianIndex === index) handleCancelEditSessionMusician();
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

    if (currentStep < 5) {
      setCurrentStep((s) => s + 1);
    } else if (currentStep === 5) {
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

    // Если albumId не передан, генерируем его из названия альбома и артиста
    let finalAlbumId = albumId;
    if (!finalAlbumId) {
      // Проверяем, что есть минимальные данные для генерации albumId
      if (!formData.artist || !formData.title) {
        setAlertModal({
          isOpen: true,
          title: 'Ошибка',
          message:
            'Ошибка: для создания нового альбома необходимо заполнить поля "Artist / Group name" и "Album title".',
          variant: 'error',
        });
        setIsSaving(false);
        return;
      }

      // Генерируем albumId из названия артиста и альбома
      // Преобразуем в lowercase, транслитерируем кириллицу, заменяем пробелы на дефисы
      const generateAlbumId = (artist: string, title: string): string => {
        // Таблица транслитерации кириллицы в латиницу
        const transliterationMap: Record<string, string> = {
          а: 'a',
          б: 'b',
          в: 'v',
          г: 'g',
          д: 'd',
          е: 'e',
          ё: 'yo',
          ж: 'zh',
          з: 'z',
          и: 'i',
          й: 'y',
          к: 'k',
          л: 'l',
          м: 'm',
          н: 'n',
          о: 'o',
          п: 'p',
          р: 'r',
          с: 's',
          т: 't',
          у: 'u',
          ф: 'f',
          х: 'h',
          ц: 'ts',
          ч: 'ch',
          ш: 'sh',
          щ: 'sch',
          ъ: '',
          ы: 'y',
          ь: '',
          э: 'e',
          ю: 'yu',
          я: 'ya',
        };

        const transliterate = (str: string): string => {
          return str
            .toLowerCase()
            .split('')
            .map((char) => {
              // Если это кириллица, транслитерируем
              if (transliterationMap[char]) {
                return transliterationMap[char];
              }
              // Если это латиница или цифра, оставляем как есть
              if (/[a-z0-9]/.test(char)) {
                return char;
              }
              // Пробелы и дефисы заменяем на дефис
              if (/[\s-]/.test(char)) {
                return '-';
              }
              // Все остальное удаляем
              return '';
            })
            .join('');
        };

        const normalize = (str: string) => {
          const transliterated = transliterate(str.trim());
          return transliterated
            .replace(/-+/g, '-') // Убираем множественные дефисы
            .replace(/^-|-$/g, ''); // Убираем дефисы в начале и конце
        };

        const artistSlug = normalize(artist);
        const titleSlug = normalize(title);

        // Если оба пустые, генерируем на основе timestamp
        if (!artistSlug && !titleSlug) {
          return `album-${Date.now()}`;
        }

        // Если titleSlug пустой, используем только artistSlug
        return titleSlug ? `${artistSlug}-${titleSlug}` : artistSlug;
      };

      finalAlbumId = generateAlbumId(formData.artist, formData.title);
      console.log('🆕 [EditAlbumModal] Generated albumId for new album:', {
        artist: formData.artist,
        title: formData.title,
        generatedAlbumId: finalAlbumId,
      });
    }

    // Проверяем, существует ли версия языка для этого альбома
    const originalAlbum = albumsFromStore.find((a: IAlbums) => a.albumId === finalAlbumId);
    const exists = !!originalAlbum;
    const method = exists ? 'PUT' : 'POST';

    console.log('📋 [EditAlbumModal] Album version check:', {
      originalAlbumId: albumId,
      finalAlbumId,
      lang,
      exists,
      method,
    });

    // Если версии нет, нужен хотя бы минимальный набор данных для создания
    if (!exists && (!formData.artist || !formData.title)) {
      setAlertModal({
        isOpen: true,
        title: 'Ошибка',
        message:
          'Ошибка: для создания новой версии альбома необходимо заполнить поля "Artist / Group name" и "Album title".',
        variant: 'error',
      });
      setIsSaving(false);
      return;
    }

    // Если версия существует, проверяем обязательные поля
    if (exists) {
      if (!formData.artist && !originalAlbum.artist) {
        setAlertModal({
          isOpen: true,
          title: 'Ошибка',
          message:
            'Ошибка: не найдено название группы для альбома. Заполните поле "Artist / Group name" и попробуйте снова.',
          variant: 'error',
        });
        setIsSaving(false);
        return;
      }

      if (!formData.title && !originalAlbum.album) {
        setAlertModal({
          isOpen: true,
          title: 'Ошибка',
          message:
            'Ошибка: не найдено название альбома. Заполните поле "Album title" и попробуйте снова.',
          variant: 'error',
        });
        setIsSaving(false);
        return;
      }
    }

    setIsSaving(true);

    // Если есть незавершенные изменения band member (редактирование или добавление),
    // применяем их к formData перед сохранением
    let finalFormData = formData;
    if (bandMemberName.trim() && bandMemberRole.trim()) {
      const url =
        bandMemberURL?.trim() && bandMemberURL.trim().length > 0 ? bandMemberURL.trim() : undefined;

      if (editingBandMemberIndex !== null) {
        // Редактируем существующего band member
        const updated = [...(formData.bandMembers || [])];
        updated[editingBandMemberIndex] = {
          name: bandMemberName.trim(),
          role: bandMemberRole.trim(),
          url,
        };
        finalFormData = { ...formData, bandMembers: updated };
      } else {
        // Добавляем нового band member
        finalFormData = {
          ...formData,
          bandMembers: [
            ...(formData.bandMembers || []),
            { name: bandMemberName.trim(), role: bandMemberRole.trim(), url },
          ],
        };
      }

      // Обновляем formData для UI
      setFormData(finalFormData);

      // Сбрасываем состояние
      setEditingBandMemberIndex(null);
      setBandMemberName('');
      setBandMemberRole('');
      setBandMemberURL('');
    }

    // Применяем незавершенные изменения session musician
    if (sessionMusicianName.trim() && sessionMusicianRole.trim()) {
      const url =
        sessionMusicianURL?.trim() && sessionMusicianURL.trim().length > 0
          ? sessionMusicianURL.trim()
          : undefined;

      if (editingSessionMusicianIndex !== null) {
        // Редактируем существующего session musician
        const updated = [...(finalFormData.sessionMusicians || [])];
        updated[editingSessionMusicianIndex] = {
          name: sessionMusicianName.trim(),
          role: sessionMusicianRole.trim(),
          url,
        };
        finalFormData = { ...finalFormData, sessionMusicians: updated };
      } else {
        // Добавляем нового session musician
        finalFormData = {
          ...finalFormData,
          sessionMusicians: [
            ...(finalFormData.sessionMusicians || []),
            { name: sessionMusicianName.trim(), role: sessionMusicianRole.trim(), url },
          ],
        };
      }

      // Обновляем formData для UI
      setFormData(finalFormData);

      // Сбрасываем состояние
      setEditingSessionMusicianIndex(null);
      setSessionMusicianName('');
      setSessionMusicianRole('');
      setSessionMusicianURL('');
    }

    // Применяем незавершенные изменения producer
    if (producerName.trim() && producerRole.trim()) {
      const url =
        producerURL?.trim() && producerURL.trim().length > 0 ? producerURL.trim() : undefined;

      if (editingProducerIndex !== null) {
        // Редактируем существующего producer
        const updated = [...(finalFormData.producer || [])];
        updated[editingProducerIndex] = {
          name: producerName.trim(),
          role: producerRole.trim(),
          url,
        };
        finalFormData = { ...finalFormData, producer: updated };
      } else {
        // Добавляем нового producer
        finalFormData = {
          ...finalFormData,
          producer: [
            ...(finalFormData.producer || []),
            { name: producerName.trim(), role: producerRole.trim(), url },
          ],
        };
      }

      // Обновляем formData для UI
      setFormData(finalFormData);

      // Сбрасываем состояние
      setEditingProducerIndex(null);
      setProducerName('');
      setProducerRole('');
      setProducerURL('');
    }

    // Используем lang для сохранения
    const normalizedLang = lang;

    let newCover: string | undefined;
    const currentCoverDraftKey = coverDraftKey;

    if (currentCoverDraftKey) {
      try {
        const commitResult = await commitCover(currentCoverDraftKey, finalAlbumId, {
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

          if (baseName) {
            newCover = baseName;
            console.log('✅ [EditAlbumModal] Cover committed successfully:', { baseName });
          } else {
            console.warn('⚠️ [EditAlbumModal] Cover commit succeeded but baseName not found');
          }
        } else {
          // Не блокируем сохранение альбома, если обложка не закоммитилась
          const errorMessage = !commitResult.success ? commitResult.error : 'Unknown error';
          console.warn('⚠️ [EditAlbumModal] Cover commit failed, continuing without cover:', {
            error: errorMessage,
          });
        }
      } catch (e) {
        // Не блокируем сохранение альбома, если обложка не закоммитилась
        console.warn('⚠️ [EditAlbumModal] Cover commit error, continuing without cover:', {
          error: e instanceof Error ? e.message : 'Unknown error',
        });
      }
    }

    const {
      release,
      buttons,
      details: newDetails,
    } = transformFormDataToAlbumFormat(finalFormData, lang, ui ?? undefined);

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

    // Объединяем details: берем оригинальные и заменяем только те, что редактируются
    const originalDetails = (originalAlbum?.details as Array<{ id: number; title: string }>) || [];
    const mergedDetails = [...originalDetails];

    // Заменяем редактируемые блоки (Genre, Band members, Session musicians, Producing, Recorded At, Mixed At)
    const editableTitles = [
      // Genre
      ui?.dashboard?.genre ?? 'Genre',
      // Band members (только два варианта: Исполнители и Band members)
      ui?.dashboard?.bandMembers ?? 'Band members',
      // Session musicians
      ui?.dashboard?.sessionMusicians ?? 'Session musicians',
      // Producing
      ui?.dashboard?.producing ?? 'Producing',
      // Mastering
      ui?.dashboard?.masteredBy ?? 'Mastered By',
      // Recorded At
      ui?.dashboard?.recordedAt ?? 'Recorded At',
      // Mixed At
      ui?.dashboard?.mixedAt ?? 'Mixed At',
    ];

    // Удаляем старые редактируемые блоки
    editableTitles.forEach((title) => {
      const index = mergedDetails.findIndex((d) => d && d.title === title);
      if (index >= 0) {
        mergedDetails.splice(index, 1);
      }
    });

    // Добавляем новые редактируемые блоки из формы
    newDetails.forEach((newDetail) => {
      const detail = newDetail as { id: number; title: string };
      mergedDetails.push(detail);
    });

    // Сортируем по id
    mergedDetails.sort((a, b) => (a.id || 0) - (b.id || 0));

    const updateData: Record<string, unknown> = {
      albumId: finalAlbumId,
      artist: artistName,
      album: albumTitle,
      fullName,
      description:
        finalFormData.description !== undefined
          ? finalFormData.description
          : originalAlbum?.description || '',
      // Для release делаем полную замену, а не merge, чтобы пустые URL поля корректно удалялись
      release: release,
      buttons:
        exists && originalAlbum?.buttons
          ? { ...(originalAlbum.buttons as any), ...buttons }
          : buttons,
      details: mergedDetails.length > 0 ? mergedDetails : [],
      lang: normalizedLang,
      // Для новых альбомов устанавливаем isPublic: true, чтобы они отображались в списке
      isPublic: !exists ? true : undefined,
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
        setAlertModal({
          isOpen: true,
          title: 'Ошибка',
          message: 'Ошибка: вы не авторизованы. Пожалуйста, войдите в систему.',
          variant: 'error',
        });
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
        hasToken: !!token,
        tokenLength: token?.length || 0,
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

      // Проверяем, является ли ошибка ошибкой авторизации
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const isAuthError = errorMessage.includes('Unauthorized') || errorMessage.includes('401');

      setAlertModal({
        isOpen: true,
        title: 'Ошибка',
        message: isAuthError
          ? 'Ошибка авторизации: ваша сессия истекла. Пожалуйста, обновите страницу и войдите в систему снова.'
          : `Ошибка при сохранении альбома: ${errorMessage}`,
        variant: 'error',
      });
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
              {ui?.dashboard?.editAlbumModal?.fieldLabels?.artistGroupName ?? 'Artist / Group name'}
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
              {ui?.dashboard?.editAlbumModal?.fieldLabels?.albumTitle ?? 'Album title'}
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
              {ui?.dashboard?.editAlbumModal?.fieldLabels?.releaseDate ?? 'Release date'}
            </label>
            <input
              id="release-date"
              name="release-date"
              type="text"
              autoComplete="off"
              className="edit-album-modal__input"
              placeholder={ui?.dashboard?.editAlbumModal?.placeholders?.releaseDate ?? 'DD/MM/YYYY'}
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
              {ui?.dashboard?.editAlbumModal?.fieldLabels?.upcEan ?? 'UPC / EAN'}
            </label>
            <input
              id="upc-ean"
              name="upc-ean"
              type="text"
              autoComplete="off"
              className="edit-album-modal__input"
              placeholder={ui?.dashboard?.editAlbumModal?.placeholders?.upcEan ?? 'UPC / EAN'}
              required
              value={formData.upcEan ?? ''}
              onChange={(e) => setFormData((s) => ({ ...s, upcEan: e.target.value }))}
            />
          </div>

          <div className="edit-album-modal__field">
            <label className="edit-album-modal__label">
              {ui?.dashboard?.editAlbumModal?.fieldLabels?.albumArt ?? 'Album art'}
            </label>

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
                      {ui?.dashboard?.editAlbumModal?.buttons?.replace ?? 'Replace'}
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
                      <span className="edit-album-modal__art-status-text">
                        {ui?.dashboard?.editAlbumModal?.status?.uploading ?? 'Uploading...'}
                      </span>
                    </div>
                  )}

                  {uploadStatus === 'uploaded' && (
                    <div className="edit-album-modal__art-status">
                      <span className="edit-album-modal__art-status-text edit-album-modal__art-status-text--success">
                        {ui?.dashboard?.editAlbumModal?.status?.uploaded ?? 'Uploaded (draft)'}
                      </span>
                    </div>
                  )}

                  {uploadStatus === 'error' && uploadError && (
                    <div className="edit-album-modal__art-status">
                      <span className="edit-album-modal__art-status-text edit-album-modal__art-status-text--error">
                        {ui?.dashboard?.editAlbumModal?.status?.error ?? 'Error'}: {uploadError}
                      </span>
                    </div>
                  )}

                  {!coverDraftKey && albumArtPreview && uploadStatus === 'idle' && (
                    <div className="edit-album-modal__art-status">
                      <span className="edit-album-modal__art-status-text">
                        {ui?.dashboard?.editAlbumModal?.status?.publishedCover ?? 'Published cover'}
                      </span>
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
                <div className="edit-album-modal__dropzone-text">
                  {ui?.dashboard?.editAlbumModal?.placeholders?.dragImageHere ?? 'Drag image here'}
                </div>
                <label htmlFor="album-art-input" className="edit-album-modal__file-label">
                  {ui?.dashboard?.editAlbumModal?.placeholders?.chooseFile ?? 'Choose file'}
                </label>
              </div>
            )}
          </div>

          <div className="edit-album-modal__field">
            <label htmlFor="description" className="edit-album-modal__label">
              {ui?.dashboard?.editAlbumModal?.fieldLabels?.description ?? 'Description'}
            </label>
            <textarea
              id="description"
              name="description"
              autoComplete="off"
              className="edit-album-modal__textarea"
              placeholder={
                ui?.dashboard?.editAlbumModal?.placeholders?.description ??
                'Short story about the album, credits highlights, mood, etc.'
              }
              required
              value={formData.description ?? ''}
              onChange={(e) => setFormData((s) => ({ ...s, description: e.target.value }))}
            />
          </div>

          <div className="edit-album-modal__field">
            <label className="edit-album-modal__label">
              {ui?.dashboard?.editAlbumModal?.fieldLabels?.visibleOnAlbumPage ??
                'Visible on album page'}
            </label>
            <div className="edit-album-modal__checkbox-wrapper">
              <input
                type="checkbox"
                id="visible-on-page"
                className="edit-album-modal__checkbox"
                checked={formData.visibleOnAlbumPage}
                onChange={(e) => handleInputChange('visibleOnAlbumPage', e.target.checked)}
              />
              <label htmlFor="visible-on-page" className="edit-album-modal__checkbox-label">
                {ui?.dashboard?.editAlbumModal?.fieldLabels?.visibleOnAlbumPage ??
                  'Visible on album page'}
              </label>
            </div>
          </div>

          <div className="edit-album-modal__field">
            <label className="edit-album-modal__label">
              {ui?.dashboard?.editAlbumModal?.fieldLabels?.allowDownloadSale ??
                'Allow download / sale'}
            </label>
            <div className="edit-album-modal__help-text">
              {ui?.dashboard?.editAlbumModal?.helpText?.controlDownloadSale ??
                'Control whether fans can buy/download this album.'}
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
                  {ui?.dashboard?.editAlbumModal?.radioOptions?.no ?? 'No'}
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
                  {ui?.dashboard?.editAlbumModal?.radioOptions?.yes ?? 'Yes'}
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
                  {ui?.dashboard?.editAlbumModal?.radioOptions?.acceptPreorders ??
                    'Accept pre-orders'}
                </label>
              </div>
            </div>

            {formData.allowDownloadSale === 'preorder' && (
              <div className="edit-album-modal__preorder-help">
                {ui?.dashboard?.editAlbumModal?.helpText?.fansCanBuyNow ??
                  'Fans can buy now, download after release date'}
              </div>
            )}
          </div>

          {showPriceFields && (
            <div className="edit-album-modal__field">
              <label className="edit-album-modal__label">
                {ui?.dashboard?.editAlbumModal?.fieldLabels?.regularPrice ?? 'Regular price'}
              </label>
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
                {ui?.dashboard?.editAlbumModal?.fieldLabels?.preorderReleaseDate ??
                  'Pre-order release date'}
              </label>
              <input
                id="preorder-date"
                name="preorder-date"
                type="text"
                autoComplete="off"
                className="edit-album-modal__input"
                placeholder={
                  ui?.dashboard?.editAlbumModal?.placeholders?.preorderDate ?? 'DD/MM/YYYY'
                }
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
          ui={ui ?? undefined}
        />
      );
    }

    if (currentStep === 3) {
      return (
        <EditAlbumModalStep3
          formData={formData}
          onFormDataChange={handleInputChange}
          ui={ui ?? undefined}
        />
      );
    }

    if (currentStep === 4) {
      return (
        <EditAlbumModalStep4
          formData={formData}
          bandMemberName={bandMemberName}
          bandMemberRole={bandMemberRole}
          bandMemberURL={bandMemberURL}
          editingBandMemberIndex={editingBandMemberIndex}
          sessionMusicianName={sessionMusicianName}
          sessionMusicianRole={sessionMusicianRole}
          sessionMusicianURL={sessionMusicianURL}
          editingSessionMusicianIndex={editingSessionMusicianIndex}
          onFormDataChange={handleInputChange}
          onBandMemberNameChange={setBandMemberName}
          onBandMemberRoleChange={setBandMemberRole}
          onBandMemberURLChange={setBandMemberURL}
          onAddBandMember={handleAddBandMember}
          onEditBandMember={handleEditBandMember}
          onRemoveBandMember={handleRemoveBandMember}
          onCancelEditBandMember={handleCancelEditBandMember}
          onSessionMusicianNameChange={setSessionMusicianName}
          onSessionMusicianRoleChange={setSessionMusicianRole}
          onSessionMusicianURLChange={setSessionMusicianURL}
          onAddSessionMusician={handleAddSessionMusician}
          onEditSessionMusician={handleEditSessionMusician}
          onRemoveSessionMusician={handleRemoveSessionMusician}
          onCancelEditSessionMusician={handleCancelEditSessionMusician}
          producerName={producerName}
          producerRole={producerRole}
          producerURL={producerURL}
          editingProducerIndex={editingProducerIndex}
          onProducerNameChange={setProducerName}
          onProducerRoleChange={setProducerRole}
          onProducerURLChange={setProducerURL}
          onAddProducer={handleAddProducer}
          onEditProducer={handleEditProducer}
          onRemoveProducer={handleRemoveProducer}
          onCancelEditProducer={handleCancelEditProducer}
          ui={ui ?? undefined}
        />
      );
    }

    if (currentStep === 5) {
      return (
        <EditAlbumModalStep5
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
          ui={ui ?? undefined}
        />
      );
    }

    return null;
  };

  const getStepTitle = () => {
    switch (currentStep) {
      case 1:
        return ui?.dashboard?.editAlbumModal?.stepTitles?.step1 ?? 'Step 1 of 5: Basic Info';
      case 2:
        return ui?.dashboard?.editAlbumModal?.stepTitles?.step2 ?? 'Step 2 of 5: Music Details';
      case 3:
        return (
          ui?.dashboard?.editAlbumModal?.stepTitles?.step3 ?? 'Step 3 of 5: Recorded/Mixed/Mastered'
        );
      case 4:
        return ui?.dashboard?.editAlbumModal?.stepTitles?.step4 ?? 'Step 4 of 5: Credits';
      case 5:
        return ui?.dashboard?.editAlbumModal?.stepTitles?.step5 ?? 'Step 5 of 5: Links';
      default:
        return `Step ${currentStep} of 5`;
    }
  };

  return (
    <>
      <Popup isActive={isOpen} onClose={handleClose}>
        <div className="edit-album-modal">
          <div className="edit-album-modal__card">
            <div className="edit-album-modal__header">
              <h2 className="edit-album-modal__title">{getStepTitle()}</h2>
              <button
                type="button"
                className="edit-album-modal__close"
                onClick={handleClose}
                aria-label={ui?.dashboard?.close ?? 'Close'}
              >
                ×
              </button>
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
                    {ui?.dashboard?.editAlbumModal?.buttons?.previous ?? 'Previous'}
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

                {currentStep === 5 ? (
                  <button
                    type="button"
                    className="edit-album-modal__button edit-album-modal__button--primary"
                    onClick={handlePublish}
                    disabled={isSaving}
                  >
                    {isSaving
                      ? (ui?.dashboard?.editAlbumModal?.buttons?.saving ?? 'Saving...')
                      : albumId && albumsFromStore?.some((a: IAlbums) => a.albumId === albumId)
                        ? (ui?.dashboard?.editAlbumModal?.buttons?.saveChanges ?? 'Save changes')
                        : (ui?.dashboard?.editAlbumModal?.buttons?.publishAlbum ?? 'Publish album')}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="edit-album-modal__button edit-album-modal__button--primary"
                    onClick={handleNext}
                  >
                    {ui?.dashboard?.editAlbumModal?.buttons?.next ?? 'Next'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </Popup>

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
    </>
  );
}
