// src/pages/UserDashboard/components/EditAlbumModal.tsx
import React, { useState, useRef, useEffect } from 'react';
import { Popup } from '@shared/ui/popup';
import { useAppSelector } from '@shared/lib/hooks/useAppSelector';
import { selectUiDictionaryFirst } from '@shared/model/uiDictionary';
import { selectAlbumsData } from '@entities/album';
import { useLang } from '@app/providers/lang';
import { getToken } from '@shared/lib/auth';
import type { IAlbums } from '@models';
import './EditAlbumModal.style.scss';

interface EditAlbumModalProps {
  isOpen: boolean;
  albumId?: string;
  onClose: () => void;
  onNext?: (data: AlbumFormData) => void;
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

const MOOD_OPTIONS = [
  'Ambient',
  'Melancholic',
  'Dreamy',
  'Dark',
  'Energetic',
  'Calm',
  'Intense',
  'Peaceful',
];
const MAX_TAGS = 10;
const MIN_TAG_LENGTH = 2;
const MAX_TAG_LENGTH = 30;
const MAX_BAND_MEMBERS = 20;
const MAX_PRODUCING_CREDITS = 30;
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
}: EditAlbumModalProps): JSX.Element | null {
  const { lang } = useLang();
  const ui = useAppSelector((state) => selectUiDictionaryFirst(state, lang));
  const albumsFromStore = useAppSelector((state) => selectAlbumsData(state, lang));
  const [currentStep, setCurrentStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<AlbumFormData>({
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

  // Загружаем данные альбома при открытии модального окна
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (!albumId) {
      console.warn('⚠️ EditAlbumModal: albumId is missing');
      return;
    }

    if (!albumsFromStore || !Array.isArray(albumsFromStore)) {
      console.warn('⚠️ EditAlbumModal: albumsFromStore is not available or not an array');
      return;
    }

    try {
      const album = albumsFromStore.find((a: IAlbums) => a && a.albumId === albumId);
      if (!album) {
        console.warn(`⚠️ EditAlbumModal: Album with id "${albumId}" not found`);
        return;
      }
      // Парсим данные о членах группы из details
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

      if (bandMembersDetail && bandMembersDetail.content) {
        for (const item of bandMembersDetail.content) {
          // Пропускаем пустые строки
          if (typeof item === 'string' && item.trim() === '') {
            continue;
          }

          // Обрабатываем объекты с text и link
          if (typeof item === 'object' && item.text && Array.isArray(item.text)) {
            // Объединяем все части текста
            const fullText = item.text.join('');

            // Парсим строку вида "Yaroslav Zhuk — lead vocals, backing vocals, words and music."
            // или "Ярослав Жук — вокал, бэк-вокал, слова и музыка."
            const match = fullText.match(/^(.+?)\s*—\s*(.+)$/);
            if (match) {
              const name = match[1].trim();
              const role = match[2].trim();
              if (name && role) {
                bandMembers.push({ name, role });
              }
            } else if (fullText.trim()) {
              // Если нет разделителя "—", используем весь текст как имя
              bandMembers.push({ name: fullText.trim(), role: '' });
            }
          } else if (typeof item === 'string' && item.trim()) {
            // Обрабатываем простые строки
            const match = item.match(/^(.+?)\s*—\s*(.+)$/);
            if (match) {
              const name = match[1].trim();
              const role = match[2].trim();
              if (name && role) {
                bandMembers.push({ name, role });
              }
            } else {
              bandMembers.push({ name: item.trim(), role: '' });
            }
          }
        }
      }

      // Парсим данные о сессионных музыкантах из details
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

      if (sessionMusiciansDetail && sessionMusiciansDetail.content) {
        for (const item of sessionMusiciansDetail.content) {
          // Пропускаем пустые строки
          if (typeof item === 'string' && item.trim() === '') {
            continue;
          }

          // Обрабатываем объекты с text и link
          if (typeof item === 'object' && item.text && Array.isArray(item.text)) {
            // Объединяем все части текста
            const fullText = item.text.join('');

            // Парсим строку вида "Name — role."
            const match = fullText.match(/^(.+?)\s*—\s*(.+)$/);
            if (match) {
              const name = match[1].trim();
              const role = match[2].trim();
              if (name && role) {
                sessionMusicians.push({ name, role });
              }
            } else if (fullText.trim()) {
              // Если нет разделителя "—", используем весь текст как имя
              sessionMusicians.push({ name: fullText.trim(), role: '' });
            }
          } else if (typeof item === 'string' && item.trim()) {
            // Обрабатываем простые строки
            const match = item.match(/^(.+?)\s*—\s*(.+)$/);
            if (match) {
              const name = match[1].trim();
              const role = match[2].trim();
              if (name && role) {
                sessionMusicians.push({ name, role });
              }
            } else {
              sessionMusicians.push({ name: item.trim(), role: '' });
            }
          }
        }
      }

      // Парсим данные о продюсировании из details
      const producingCredits: ProducingCredits = {
        Producer: [],
        'Recording/Mixing': [],
        Mastering: [],
      };
      const producingDetail = Array.isArray(album.details)
        ? album.details.find(
            (detail) =>
              detail && (detail.title === 'Producing' || detail.title === 'Продюсирование')
          )
        : null;

      if (producingDetail && producingDetail.content) {
        // Маппинг русских названий на английские ключи
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

        for (const item of producingDetail.content) {
          // Пропускаем пустые строки
          if (typeof item === 'string' && item.trim() === '') {
            continue;
          }

          let fullText = '';
          if (typeof item === 'object' && item.text && Array.isArray(item.text)) {
            fullText = item.text.join('');
          } else if (typeof item === 'string') {
            fullText = item;
          }

          if (fullText.trim()) {
            // Парсим строку вида "Ярослав Жук — продюсер." или "Илья Marvel Горохводацкий — запись/сведение."
            const match = fullText.match(/^(.+?)\s*—\s*(.+?)(?:\.|$)/);
            if (match) {
              const name = match[1].trim();
              const roleText = match[2].trim().toLowerCase();

              // Определяем тип кредита по роли
              let creditType = 'Producer'; // По умолчанию
              for (const [key, value] of Object.entries(creditTypeMap)) {
                if (roleText.includes(key)) {
                  creditType = value;
                  break;
                }
              }

              // Добавляем имя и роль в соответствующий массив
              if (!producingCredits[creditType]) {
                producingCredits[creditType] = [];
              }

              // Сохраняем оригинальную роль (без точки в конце)
              const role = match[2].trim().replace(/\.$/, '');

              // Проверяем, нет ли уже такого имени с такой же ролью
              const existingIndex = producingCredits[creditType].findIndex(
                (member) => member.name === name && member.role === role
              );
              if (existingIndex === -1) {
                producingCredits[creditType].push({ name, role });
              }
            }
          }
        }
      }

      // Заполняем поля из данных альбома
      setFormData((prev) => {
        const release = album.release && typeof album.release === 'object' ? album.release : {};
        const releaseDate = release.date || '';
        const upc = release.UPC || '';

        return {
          ...prev,
          title: album.album || prev.title,
          releaseDate: releaseDate || prev.releaseDate,
          upcEan: upc || prev.upcEan,
          description: album.description || prev.description,
          albumCoverPhotographer: release.photographer || prev.albumCoverPhotographer,
          albumCoverDesigner: release.designer || prev.albumCoverDesigner,
          bandMembers: bandMembers.length > 0 ? bandMembers : prev.bandMembers,
          sessionMusicians: sessionMusicians.length > 0 ? sessionMusicians : prev.sessionMusicians,
          producingCredits: Object.keys(producingCredits).some(
            (key) => producingCredits[key].length > 0
          )
            ? producingCredits
            : prev.producingCredits,
          // Парсим ссылки из buttons
          purchaseLinks: (() => {
            const links: StreamingLink[] = [];
            if (album.buttons && typeof album.buttons === 'object') {
              // Маппинг ключей из JSON на ID сервисов покупки
              const purchaseMap: Record<string, string> = {
                itunes: 'apple',
                bandcamp: 'bandcamp',
                amazon: 'amazon',
              };

              for (const [key, url] of Object.entries(album.buttons)) {
                const serviceId = purchaseMap[key.toLowerCase()];
                if (serviceId && url && typeof url === 'string' && url.trim() !== '') {
                  links.push({ service: serviceId, url: url.trim() });
                }
              }
            }
            return links.length > 0 ? links : prev.purchaseLinks;
          })(),
          streamingLinks: (() => {
            const links: StreamingLink[] = [];
            if (album.buttons && typeof album.buttons === 'object') {
              // Маппинг ключей из JSON на ID сервисов стриминга
              const streamingMap: Record<string, string> = {
                apple: 'applemusic',
                vk: 'vk',
                youtube: 'youtube',
                spotify: 'spotify',
                yandex: 'yandex',
                deezer: 'deezer',
                tidal: 'tidal',
                applemusic: 'applemusic',
              };

              for (const [key, url] of Object.entries(album.buttons)) {
                const serviceId = streamingMap[key.toLowerCase()];
                if (serviceId && url && typeof url === 'string' && url.trim() !== '') {
                  links.push({ service: serviceId, url: url.trim() });
                }
              }
            }
            return links.length > 0 ? links : prev.streamingLinks;
          })(),
        };
      });
    } catch (error) {
      console.error('❌ Error loading album data in EditAlbumModal:', error);
    }
  }, [isOpen, albumId, albumsFromStore, lang]);

  // Сбрасываем форму при закрытии модального окна
  useEffect(() => {
    if (!isOpen) {
      // Сбрасываем форму при закрытии
      setFormData({
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
        },
        purchaseLinks: [],
        streamingLinks: [],
      });
      setCurrentStep(1);
    }
  }, [isOpen]);

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

  const handleInputChange = (field: keyof AlbumFormData, value: string | boolean | File | null) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleInputChange('albumArt', e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleInputChange('albumArt', e.target.files[0]);
    }
  };

  // Закрытие dropdown при клике вне его
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (moodDropdownRef.current && !moodDropdownRef.current.contains(event.target as Node)) {
        setMoodDropdownOpen(false);
      }
    };

    if (moodDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [moodDropdownOpen]);

  const handleMoodToggle = (mood: string) => {
    setFormData((prev) => {
      const currentMood = prev.mood || [];
      if (currentMood.includes(mood)) {
        return { ...prev, mood: currentMood.filter((m) => m !== mood) };
      } else {
        return { ...prev, mood: [...currentMood, mood] };
      }
    });
  };

  const handleRemoveMood = (mood: string) => {
    setFormData((prev) => ({
      ...prev,
      mood: (prev.mood || []).filter((m) => m !== mood),
    }));
  };

  const validateTag = (tag: string): string | null => {
    const trimmedTag = tag.trim();

    if (!trimmedTag) {
      return 'Tag cannot be empty';
    }

    if (trimmedTag.length < MIN_TAG_LENGTH) {
      return `Tag must be at least ${MIN_TAG_LENGTH} characters`;
    }

    if (trimmedTag.length > MAX_TAG_LENGTH) {
      return `Tag must be no more than ${MAX_TAG_LENGTH} characters`;
    }

    const tagWithoutHash = trimmedTag.startsWith('#') ? trimmedTag.slice(1) : trimmedTag;
    if (tagWithoutHash.length < MIN_TAG_LENGTH) {
      return `Tag must be at least ${MIN_TAG_LENGTH} characters (without #)`;
    }

    const normalizedTag = `#${tagWithoutHash.toLowerCase()}`;
    if (formData.tags.includes(normalizedTag)) {
      return 'This tag already exists';
    }

    if (formData.tags.length >= MAX_TAGS) {
      return `Maximum ${MAX_TAGS} tags allowed`;
    }

    return null;
  };

  const handleAddTag = () => {
    const error = validateTag(tagInput);
    if (error) {
      setTagError(error);
      return;
    }

    const trimmedTag = tagInput.trim();
    const tagWithoutHash = trimmedTag.startsWith('#') ? trimmedTag.slice(1) : trimmedTag;
    const normalizedTag = `#${tagWithoutHash.toLowerCase()}`;

    setFormData((prev) => ({
      ...prev,
      tags: [...(prev.tags || []), normalizedTag],
    }));

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
    setFormData((prev) => ({
      ...prev,
      tags: (prev.tags || []).filter((t) => t !== tag),
    }));
  };

  const handleAddBandMember = () => {
    if (!bandMemberName.trim() || !bandMemberRole.trim()) {
      return;
    }

    if (editingBandMemberIndex !== null) {
      // Редактирование существующего участника
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
      // Добавление нового участника
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
    if (editingBandMemberIndex === index) {
      handleCancelEditBandMember();
    }
  };

  const handleAddSessionMusician = () => {
    if (!sessionMusicianName.trim() || !sessionMusicianRole.trim()) {
      return;
    }

    if (editingSessionMusicianIndex !== null) {
      // Редактирование существующего участника
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
      // Добавление нового участника
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
    if (editingSessionMusicianIndex === index) {
      handleCancelEditSessionMusician();
    }
  };

  const handleAddProducingCredit = (creditType: string) => {
    const name = producingNames[creditType]?.trim();
    const role = producingRoles[creditType]?.trim() || '';
    if (!name) {
      return;
    }

    if (editingProducingCredit && editingProducingCredit.creditType === creditType) {
      // Редактирование существующего имени
      setFormData((prev) => {
        const updated = { ...prev.producingCredits };
        const members = [...(updated[creditType] || [])];
        members[editingProducingCredit.nameIndex] = { name, role };
        updated[creditType] = members;
        return { ...prev, producingCredits: updated };
      });
      setEditingProducingCredit(null);
    } else {
      // Добавление нового имени
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
    if (!newCreditType.trim()) {
      return;
    }

    const trimmedType = newCreditType.trim();
    if (formData.producingCredits[trimmedType]) {
      return; // Тип уже существует
    }

    setFormData((prev) => ({
      ...prev,
      producingCredits: {
        ...prev.producingCredits,
        [trimmedType]: [],
      },
    }));

    setNewCreditType('');
  };

  const handleRemoveCreditType = (creditType: string) => {
    // Нельзя удалять предустановленные типы
    if (DEFAULT_PRODUCING_CREDIT_TYPES.includes(creditType)) {
      return;
    }

    setFormData((prev) => {
      const updated = { ...prev.producingCredits };
      delete updated[creditType];
      return { ...prev, producingCredits: updated };
    });

    if (editingProducingCredit?.creditType === creditType) {
      handleCancelEditProducingCredit();
    }
  };

  const handleAddPurchaseLink = () => {
    if (!purchaseLinkService.trim() || !purchaseLinkUrl.trim()) {
      return;
    }

    if (editingPurchaseLink !== null) {
      // Редактирование существующей ссылки
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
      // Добавление новой ссылки
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

    if (editingPurchaseLink === index) {
      handleCancelEditPurchaseLink();
    }
  };

  const handleAddStreamingLink = () => {
    if (!streamingLinkService.trim() || !streamingLinkUrl.trim()) {
      return;
    }

    if (editingStreamingLink !== null) {
      // Редактирование существующей ссылки
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
      // Добавление новой ссылки
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

    if (editingStreamingLink === index) {
      handleCancelEditStreamingLink();
    }
  };

  const handleNext = () => {
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
    } else if (currentStep === 4) {
      handlePublish();
    }
  };

  /**
   * Преобразует данные формы в формат для API
   */
  const transformFormDataToAlbumFormat = (): {
    release: Record<string, string>;
    buttons: Record<string, string>;
    details: unknown[];
  } => {
    // Преобразуем release
    const release: Record<string, string> = {
      date: formData.releaseDate,
      UPC: formData.upcEan,
    };
    if (formData.albumCoverPhotographer) {
      release.photographer = formData.albumCoverPhotographer;
    }
    if (formData.albumCoverDesigner) {
      release.designer = formData.albumCoverDesigner;
    }

    // Преобразуем buttons (purchase и streaming links)
    const buttons: Record<string, string> = {};

    // Purchase links
    formData.purchaseLinks.forEach((link) => {
      // Маппинг ID сервисов обратно в ключи JSON
      const purchaseKeyMap: Record<string, string> = {
        apple: 'itunes',
        bandcamp: 'bandcamp',
        amazon: 'amazon',
      };
      const key = purchaseKeyMap[link.service] || link.service;
      if (link.url) {
        buttons[key] = link.url;
      }
    });

    // Streaming links
    formData.streamingLinks.forEach((link) => {
      // Маппинг ID сервисов обратно в ключи JSON
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
      if (link.url) {
        buttons[key] = link.url;
      }
    });

    // Преобразуем details
    const details: unknown[] = [];

    // Band Members
    if (formData.bandMembers.length > 0) {
      const bandMembersContent: unknown[] = formData.bandMembers.map((member) => {
        // Формат: объект с text и link (если есть ссылка) или строка
        // Пока используем простой формат строки
        return `${member.name} — ${member.role}.`;
      });
      details.push({
        id: details.length + 1,
        title: lang === 'ru' ? 'Исполнители' : 'Band members',
        content: bandMembersContent,
      });
    }

    // Producing Credits
    const producingContent: unknown[] = [];
    Object.entries(formData.producingCredits).forEach(([creditType, members]) => {
      if (members.length > 0) {
        members.forEach((member) => {
          // Если роль указана, используем её, иначе используем тип кредита как роль
          const role = member.role || creditType;
          // Формат: "Name — role." (как в исходном JSON)
          producingContent.push(`${member.name} — ${role}.`);
        });
      }
    });

    if (producingContent.length > 0) {
      details.push({
        id: details.length + 1,
        title: lang === 'ru' ? 'Продюсирование' : 'Producing',
        content: producingContent,
      });
    }

    return { release, buttons, details };
  };

  const handlePublish = async () => {
    if (!albumId) {
      console.error('Album ID is required');
      return;
    }

    // Находим исходный альбом для получения artist и cover
    const originalAlbum = albumsFromStore.find((a: IAlbums) => a.albumId === albumId);
    if (!originalAlbum) {
      console.error('Original album not found');
      return;
    }

    setIsSaving(true);

    const { release, buttons, details } = transformFormDataToAlbumFormat();

    // Подготавливаем данные для API
    // Включаем существующие данные, которые не редактируются в форме
    const updateData = {
      albumId,
      album: formData.title,
      description: formData.description,
      release: {
        ...originalAlbum.release,
        ...release, // Перезаписываем только изменённые поля
      },
      buttons: {
        ...originalAlbum.buttons,
        ...buttons, // Перезаписываем только изменённые поля
      },
      details: details.length > 0 ? details : originalAlbum.details, // Используем новые details, если они есть
      lang,
    };

    console.log('📤 Sending update data:', {
      albumId: updateData.albumId,
      album: updateData.album,
      hasRelease: !!updateData.release,
      hasButtons: !!updateData.buttons,
      detailsCount: Array.isArray(updateData.details) ? updateData.details.length : 0,
    });

    try {
      // Получаем токен
      const token = getToken();
      if (!token) {
        console.error('No auth token found');
        setIsSaving(false);
        return;
      }

      // Отправляем запрос на обновление
      const response = await fetch('/api/albums', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Album updated successfully:', result);

      // Вызываем onNext для закрытия модального окна
      if (onNext) {
        onNext(formData);
      }
    } catch (error) {
      console.error('❌ Error updating album:', error);
      alert(
        `Ошибка при сохранении альбома: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleClose = () => {
    setFormData({
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
      },
      purchaseLinks: [],
      streamingLinks: [],
    });
    setCurrentStep(1);
    setDragActive(false);
    setMoodDropdownOpen(false);
    setTagInput('');
    setTagError('');
    setBandMemberName('');
    setBandMemberRole('');
    setEditingBandMemberIndex(null);
    setProducingNames({});
    setEditingProducingCredit(null);
    setNewCreditType('');
    setEditingPurchaseLink(null);
    setPurchaseLinkService('');
    setPurchaseLinkUrl('');
    setEditingStreamingLink(null);
    setStreamingLinkService('');
    setStreamingLinkUrl('');
    onClose();
  };

  const showPriceFields =
    formData.allowDownloadSale === 'yes' || formData.allowDownloadSale === 'preorder';
  const showPreorderDate = formData.allowDownloadSale === 'preorder';

  const renderStepContent = () => {
    if (currentStep === 1) {
      return (
        <>
          <div className="edit-album-modal__divider"></div>
          {/* Album title */}
          <div className="edit-album-modal__field">
            <label htmlFor="album-title" className="edit-album-modal__label">
              Album title
            </label>
            <input
              id="album-title"
              type="text"
              className="edit-album-modal__input"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
            />
          </div>

          {/* Release date */}
          <div className="edit-album-modal__field">
            <label htmlFor="release-date" className="edit-album-modal__label">
              Release date
            </label>
            <input
              id="release-date"
              type="text"
              className="edit-album-modal__input"
              placeholder="DD/MM/YYYY"
              value={formData.releaseDate}
              onChange={(e) => handleInputChange('releaseDate', e.target.value)}
            />
          </div>

          {/* UPC / EAN */}
          <div className="edit-album-modal__field">
            <label htmlFor="upc-ean" className="edit-album-modal__label">
              UPC / EAN
            </label>
            <input
              id="upc-ean"
              type="text"
              className="edit-album-modal__input"
              placeholder="Optional"
              value={formData.upcEan}
              onChange={(e) => handleInputChange('upcEan', e.target.value)}
            />
          </div>

          {/* Album art */}
          <div className="edit-album-modal__field">
            <label className="edit-album-modal__label">Album art</label>
            <div
              className={`edit-album-modal__dropzone ${dragActive ? 'edit-album-modal__dropzone--active' : ''}`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <div className="edit-album-modal__dropzone-text">Drag image here</div>
              <input
                type="file"
                id="album-art-input"
                accept="image/*"
                className="edit-album-modal__file-input"
                onChange={handleFileInput}
              />
              <label htmlFor="album-art-input" className="edit-album-modal__file-label">
                Choose file
              </label>
              {formData.albumArt && (
                <div className="edit-album-modal__file-name">{formData.albumArt.name}</div>
              )}
            </div>
          </div>

          {/* Description */}
          <div className="edit-album-modal__field">
            <label htmlFor="description" className="edit-album-modal__label">
              Description
            </label>
            <textarea
              id="description"
              className="edit-album-modal__textarea"
              placeholder="Short story about the album, credits highlights, mood, etc."
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
            />
          </div>

          {/* Visible on album page */}
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

          {/* Allow download / sale */}
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

          {/* Regular price - shown when Yes or Pre-order is selected */}
          {showPriceFields && (
            <div className="edit-album-modal__field">
              <label className="edit-album-modal__label">Regular price</label>
              <div className="edit-album-modal__price-group">
                <select
                  className="edit-album-modal__select"
                  value={formData.currency}
                  onChange={(e) => handleInputChange('currency', e.target.value)}
                >
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="RUB">RUB</option>
                </select>
                <input
                  type="text"
                  className="edit-album-modal__input edit-album-modal__input--price"
                  value={formData.regularPrice}
                  onChange={(e) => handleInputChange('regularPrice', e.target.value)}
                  disabled={formData.allowDownloadSale === 'no'}
                />
              </div>
            </div>
          )}

          {/* Pre-order release date - shown when Pre-order is selected */}
          {showPreorderDate && (
            <div className="edit-album-modal__field">
              <label htmlFor="preorder-date" className="edit-album-modal__label">
                Pre-order release date
              </label>
              <input
                id="preorder-date"
                type="text"
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
          <div className="edit-album-modal__divider"></div>
          {/* Mood Section */}
          <div className="edit-album-modal__field">
            <label className="edit-album-modal__label">Mood</label>
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
                  <span className="edit-album-modal__multiselect-placeholder">Select moods...</span>
                )}
                <span className="edit-album-modal__multiselect-arrow">
                  {moodDropdownOpen ? '⌃' : '⌄'}
                </span>
              </div>
              {moodDropdownOpen && (
                <div className="edit-album-modal__multiselect-dropdown">
                  {MOOD_OPTIONS.map((mood) => (
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

          {/* Tags Section */}
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
                  type="text"
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
          <div className="edit-album-modal__divider"></div>
          {/* Album Cover Section */}
          <div className="edit-album-modal__field">
            <label className="edit-album-modal__label">Album Cover</label>
            <div className="edit-album-modal__two-column-inputs">
              <input
                type="text"
                className="edit-album-modal__input"
                placeholder="Photographer"
                value={formData.albumCoverPhotographer}
                onChange={(e) => handleInputChange('albumCoverPhotographer', e.target.value)}
              />
              <input
                type="text"
                className="edit-album-modal__input"
                placeholder="Designer"
                value={formData.albumCoverDesigner}
                onChange={(e) => handleInputChange('albumCoverDesigner', e.target.value)}
              />
            </div>
          </div>

          {/* Band Members Section */}
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
                    type="text"
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
                    type="text"
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

          {/* Session Musicians Section */}
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
                    type="text"
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
                    type="text"
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

          {/* Producing Section */}
          <div className="edit-album-modal__field">
            <label className="edit-album-modal__label">Producing</label>

            {/* Предустановленные типы кредитов */}
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
                          type="text"
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
                            if (e.key === 'Escape') {
                              handleCancelEditProducingCredit();
                            }
                          }}
                          autoFocus
                        />
                        <input
                          type="text"
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
                            if (e.key === 'Escape') {
                              handleCancelEditProducingCredit();
                            }
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
                          type="text"
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
                          type="text"
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

            {/* Дополнительные типы кредитов */}
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
                            type="text"
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
                              if (e.key === 'Escape') {
                                handleCancelEditProducingCredit();
                              }
                            }}
                            autoFocus
                          />
                          <input
                            type="text"
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
                              if (e.key === 'Escape') {
                                handleCancelEditProducingCredit();
                              }
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
                            type="text"
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
                            type="text"
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

            {/* Добавление нового типа кредита */}
            <div className="edit-album-modal__producing-new-type">
              <div className="edit-album-modal__producing-input-group">
                <input
                  type="text"
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
          <div className="edit-album-modal__divider"></div>
          <div className="edit-album-modal__links-container">
            {/* Purchase Links */}
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
                            type="url"
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
                              if (e.key === 'Escape') {
                                handleCancelEditPurchaseLink();
                              }
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
                              <span
                                className={`edit-album-modal__link-icon ${service.icon}`}
                              ></span>
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
                    type="url"
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

            {/* Streaming Links */}
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
                            type="url"
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
                              if (e.key === 'Escape') {
                                handleCancelEditStreamingLink();
                              }
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
                              <span
                                className={`edit-album-modal__link-icon ${service.icon}`}
                              ></span>
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
                    type="url"
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

            {/* Actions */}
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
                  {isSaving ? 'Saving...' : 'Publish album'}
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
