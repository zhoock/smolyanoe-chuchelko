// src/pages/UserDashboard/components/EditAlbumModal.utils.ts
import type { AlbumFormData, ProducingCredits } from './EditAlbumModal.types';
import { DEFAULT_PRODUCING_CREDIT_TYPES } from './EditAlbumModal.constants';
import type { SupportedLang } from '@shared/model/lang';

export const makeEmptyForm = (): AlbumFormData => ({
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
  producingCredits: DEFAULT_PRODUCING_CREDIT_TYPES.reduce((acc, type) => {
    acc[type] = [];
    return acc;
  }, {} as ProducingCredits),
  purchaseLinks: [],
  streamingLinks: [],
});

export const validateStep = (step: number, formData: AlbumFormData): boolean => {
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

export const transformFormDataToAlbumFormat = (
  formData: AlbumFormData,
  lang: SupportedLang
): {
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
      title: lang === 'ru' ? 'Исполнители' : 'Band members',
      content: formData.bandMembers.map((m) => `${m.name} — ${m.role}.`),
    });
  }

  if (formData.sessionMusicians.length > 0) {
    details.push({
      id: details.length + 1,
      title: lang === 'ru' ? 'Сессионные музыканты' : 'Session musicians',
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
      title: lang === 'ru' ? 'Продюсирование' : 'Producing',
      content: producingContent,
    });
  }

  if (recordingMixingContent.length > 0) {
    details.push({
      id: details.length + 1,
      title: lang === 'ru' ? 'Запись/сведение' : 'Recording/Mixing',
      content: recordingMixingContent,
    });
  }

  if (masteringContent.length > 0) {
    details.push({
      id: details.length + 1,
      title: lang === 'ru' ? 'Мастеринг' : 'Mastering',
      content: masteringContent,
    });
  }

  return { release, buttons, details };
};
