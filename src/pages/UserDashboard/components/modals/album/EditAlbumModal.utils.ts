// src/pages/UserDashboard/components/EditAlbumModal.utils.ts
import type { AlbumFormData, ProducingCredits } from './EditAlbumModal.types';
import { DEFAULT_PRODUCING_CREDIT_TYPES } from './EditAlbumModal.constants';
import type { SupportedLang } from '@shared/model/lang';
import type { IInterface, detailsProps } from '@models';
import {
  type AlbumDetailSemanticKind,
  classifyAlbumDetailSemanticKind,
  dedupeMergedAlbumDetailsForDisplay,
} from '@entities/album/lib/albumDetailSemanticKind';

/**
 * Заголовки блоков `details`, которые форма редактирования полностью перезаписывает при сохранении.
 * Должны совпадать с вариантами в `EditAlbumModal` (парсинг) и `AlbumDetailsMusic` (отображение),
 * иначе при сохранении с EN-интерфейсом русские заголовки не удаляются и дублируются с английскими.
 */
export const EDITABLE_ALBUM_DETAIL_BLOCK_TITLES = new Set<string>([
  'Genre',
  'Genres',
  'Жанр',
  'Жанры',
  'Band members',
  'Участники группы',
  'Исполнители',
  'Session musicians',
  'Сессионные музыканты',
  'Session Musicians',
  'Producing',
  'Продюсирование',
  'Продюсер',
  'Mastered By',
  'Мастеринг',
  'Recorded At',
  'Запись',
  'Mixed At',
  'Сведение',
]);

/** Семантика редактируемых блоков details — один id на блок во всех локалях. */
type DetailBlockKind = AlbumDetailSemanticKind;

function classifyDetailBlockTitle(title: string, ui?: IInterface): DetailBlockKind | null {
  return classifyAlbumDetailSemanticKind(title, ui);
}

/** true, если блок относится к одному из шести редактируемых «смысловых» kind (по normalize(title), не по точной строке). */
export function isEditableSemanticAlbumDetailBlock(title: string, ui?: IInterface): boolean {
  return classifyAlbumDetailSemanticKind(title, ui) != null;
}

/** Сохранение: тот же дедуп, что и на отображении (один блок на kind, канонический title). */
export function dedupeSemanticAlbumDetailBlocks(
  details: unknown[],
  lang: SupportedLang,
  ui?: IInterface
): unknown[] {
  return dedupeMergedAlbumDetailsForDisplay(details as detailsProps[], lang, ui) as unknown[];
}

/** kind через `classifyDetailBlockTitle` → `normalize(title)`; первый встреченный id для kind сохраняется. */
function collectExistingDetailIdsByKind(
  existingDetails: unknown,
  ui?: IInterface
): { kindToId: Map<DetailBlockKind, number>; maxId: number } {
  const kindToId = new Map<DetailBlockKind, number>();
  let maxId = 0;
  if (!Array.isArray(existingDetails)) return { kindToId, maxId };

  for (const raw of existingDetails) {
    if (!raw || typeof raw !== 'object') continue;
    const id = (raw as { id?: unknown }).id;
    const title = (raw as { title?: unknown }).title;
    if (typeof id !== 'number' || !Number.isFinite(id)) continue;
    maxId = Math.max(maxId, id);
    if (typeof title !== 'string') continue;
    const kind = classifyDetailBlockTitle(title, ui);
    if (kind && !kindToId.has(kind)) {
      kindToId.set(kind, id);
    }
  }
  return { kindToId, maxId };
}

/**
 * Id из merged baseline по kind; если kind уже есть в карте — только он (без замены на новый id из-за usedIds).
 * Новый id только если kind в baseline не встречался.
 */
function takeDetailBlockId(
  kind: DetailBlockKind,
  kindToId: Map<DetailBlockKind, number>,
  usedIds: Set<number>,
  maxIdRef: { n: number }
): number {
  if (kindToId.has(kind)) {
    const id = kindToId.get(kind)!;
    usedIds.add(id);
    return id;
  }
  maxIdRef.n += 1;
  while (usedIds.has(maxIdRef.n)) maxIdRef.n += 1;
  usedIds.add(maxIdRef.n);
  return maxIdRef.n;
}

/**
 * Форматирует дату из формата YYYY-MM-DD в формат "MON. DD, YYYY" (английский)
 */
export function formatDateToDisplayEN(dateStr: string | undefined): string {
  if (!dateStr) return '';

  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;

    const months = [
      'JAN',
      'FEB',
      'MAR',
      'APR',
      'MAY',
      'JUN',
      'JUL',
      'AUG',
      'SEP',
      'OCT',
      'NOV',
      'DEC',
    ];
    const month = months[date.getMonth()];
    const day = date.getDate();
    const year = date.getFullYear();

    return `${month}. ${day}, ${year}`;
  } catch {
    return dateStr;
  }
}

/**
 * Форматирует дату из формата YYYY-MM-DD в формат "DD месяца YYYY" (русский)
 */
export function formatDateToDisplayRU(dateStr: string | undefined): string {
  if (!dateStr) return '';

  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;

    const months = [
      'января',
      'февраля',
      'марта',
      'апреля',
      'мая',
      'июня',
      'июля',
      'августа',
      'сентября',
      'октября',
      'ноября',
      'декабря',
    ];
    const day = date.getDate();
    const month = months[date.getMonth()];
    const year = date.getFullYear();

    return `${day} ${month} ${year}`;
  } catch {
    return dateStr;
  }
}

/**
 * Форматирует дату из формата YYYY-MM-DD в формат в зависимости от языка
 */
export function formatDateToDisplay(dateStr: string | undefined, lang: 'en' | 'ru' = 'en'): string {
  return lang === 'ru' ? formatDateToDisplayRU(dateStr) : formatDateToDisplayEN(dateStr);
}

/**
 * Парсит дату из формата "MON. DD, YYYY" в формат YYYY-MM-DD
 */
export function parseDateFromDisplay(dateStr: string | undefined): string | undefined {
  if (!dateStr) return undefined;

  try {
    // Формат: "OCT. 16, 2018" или "OCT 16, 2018"
    const match = dateStr.match(/([A-Z]{3})\.?\s+(\d{1,2}),\s+(\d{4})/);
    if (!match) return undefined;

    const months: Record<string, number> = {
      JAN: 0,
      FEB: 1,
      MAR: 2,
      APR: 3,
      MAY: 4,
      JUN: 5,
      JUL: 6,
      AUG: 7,
      SEP: 8,
      OCT: 9,
      NOV: 10,
      DEC: 11,
    };

    const month = months[match[1]];
    const day = parseInt(match[2], 10);
    const year = parseInt(match[3], 10);

    if (month === undefined || isNaN(day) || isNaN(year)) return undefined;

    const date = new Date(year, month, day);
    const yearStr = String(date.getFullYear());
    const monthStr = String(date.getMonth() + 1).padStart(2, '0');
    const dayStr = String(date.getDate()).padStart(2, '0');

    return `${yearStr}-${monthStr}-${dayStr}`;
  } catch {
    return undefined;
  }
}

/**
 * Извлекает даты и текст студии из полного текста записи
 * Формат: "OCT. 16, 2018—DEC. 28, 2018: Studio Name" или "OCT. 16, 2018: Studio Name"
 */
export function parseRecordingText(text: string): {
  dateFrom?: string;
  dateTo?: string;
  studioText?: string;
} {
  if (!text) return {};

  // Пытаемся найти диапазон дат: "DATE1—DATE2:"
  const rangeMatch = text.match(
    /^([A-Z]{3}\.?\s+\d{1,2},\s+\d{4})—([A-Z]{3}\.?\s+\d{1,2},\s+\d{4}):\s*(.+)$/
  );
  if (rangeMatch) {
    return {
      dateFrom: parseDateFromDisplay(rangeMatch[1]),
      dateTo: parseDateFromDisplay(rangeMatch[2]),
      studioText: rangeMatch[3].trim(),
    };
  }

  // Пытаемся найти одну дату: "DATE:"
  const singleMatch = text.match(/^([A-Z]{3}\.?\s+\d{1,2},\s+\d{4}):\s*(.+)$/);
  if (singleMatch) {
    return {
      dateFrom: parseDateFromDisplay(singleMatch[1]),
      studioText: singleMatch[2].trim(),
    };
  }

  // Если не нашли дату, весь текст - это текст студии
  return {
    studioText: text.trim(),
  };
}

/**
 * Строит текст записи из дат и текста студии для указанного языка
 */
export function buildRecordingText(
  dateFrom: string | undefined,
  dateTo: string | undefined,
  studioText: string | undefined,
  city: string | undefined,
  lang: 'en' | 'ru' = 'en'
): string {
  const parts: string[] = [];

  if (dateFrom && dateTo) {
    const fromFormatted = formatDateToDisplay(dateFrom, lang);
    const toFormatted = formatDateToDisplay(dateTo, lang);
    parts.push(`${fromFormatted}—${toFormatted}`);
  } else if (dateFrom) {
    parts.push(formatDateToDisplay(dateFrom, lang));
  } else if (dateTo) {
    parts.push(formatDateToDisplay(dateTo, lang));
  }

  // Формируем текст студии с городом
  let studioAndCity = '';
  if (studioText && city) {
    studioAndCity = `${studioText}, ${city}`;
  } else if (studioText) {
    studioAndCity = studioText;
  } else if (city) {
    studioAndCity = city;
  }

  if (studioAndCity) {
    if (parts.length > 0) {
      parts.push(`: ${studioAndCity}`);
    } else {
      parts.push(studioAndCity);
    }
  }

  return parts.join('');
}

/**
 * Конвертирует дату из формата DD/MM/YYYY в ISO формат YYYY-MM-DD для сохранения в БД
 */
export function formatDateToISO(dateStr: string): string {
  if (!dateStr || !dateStr.trim()) return '';

  // Если дата уже в формате YYYY-MM-DD, возвращаем как есть
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim())) {
    return dateStr.trim();
  }

  // Парсим DD/MM/YYYY
  const parts = dateStr.trim().split('/');
  if (parts.length === 3) {
    const [day, month, year] = parts.map((p) => p.padStart(2, '0'));
    // Проверяем валидность
    if (day && month && year && day.length === 2 && month.length === 2 && year.length === 4) {
      return `${year}-${month}-${day}`;
    }
  }

  // Если формат не распознан, пытаемся распарсить через Date
  const date = new Date(dateStr);
  if (!isNaN(date.getTime())) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Если ничего не помогло, возвращаем как есть (будет ошибка валидации)
  return dateStr;
}

/**
 * Конвертирует дату из ISO формата YYYY-MM-DD в формат DD/MM/YYYY для отображения
 */
export function formatDateFromISO(dateStr: string): string {
  if (!dateStr || !dateStr.trim()) return '';

  // Если дата уже в формате DD/MM/YYYY, возвращаем как есть
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr.trim())) {
    return dateStr.trim();
  }

  // Парсим YYYY-MM-DD или ISO формат
  let date: Date;
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr.trim())) {
    // ISO формат YYYY-MM-DD
    const parts = dateStr.trim().split(/[-T]/);
    if (parts.length >= 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1; // месяцы в JS начинаются с 0
      const day = parseInt(parts[2], 10);
      date = new Date(year, month, day);
    } else {
      date = new Date(dateStr);
    }
  } else {
    date = new Date(dateStr);
  }

  if (isNaN(date.getTime())) {
    return dateStr; // Возвращаем как есть, если не удалось распарсить
  }

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();

  return `${day}/${month}/${year}`;
}

/**
 * Применяет маску ввода для поля даты DD/MM/YYYY
 */
export function formatDateInput(value: string): string {
  // Удаляем все нецифровые символы
  const digits = value.replace(/\D/g, '');

  // Ограничиваем длину до 8 цифр (DDMMYYYY)
  const limited = digits.slice(0, 8);

  // Форматируем: добавляем слеши
  if (limited.length <= 2) {
    return limited;
  } else if (limited.length <= 4) {
    return `${limited.slice(0, 2)}/${limited.slice(2)}`;
  } else {
    return `${limited.slice(0, 2)}/${limited.slice(2, 4)}/${limited.slice(4)}`;
  }
}

export const makeEmptyForm = (): AlbumFormData => ({
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
  genreCodes: [],
  tags: [],
  albumCoverPhotographer: '',
  albumCoverPhotographerURL: '',
  albumCoverDesigner: '',
  albumCoverDesignerURL: '',
  bandMembers: [],
  showAddBandMemberInputs: false,
  sessionMusicians: [],
  showAddSessionMusicianInputs: false,
  producer: [],
  producerName: '',
  producerRole: '',
  producerURL: '',
  showAddProducerInputs: false,
  mastering: [],
  masteringDateFrom: '',
  masteringDateTo: '',
  masteringText: '',
  masteringCity: '',
  masteringURL: '',
  showAddMasteringInputs: false,
  producingCredits: DEFAULT_PRODUCING_CREDIT_TYPES.reduce((acc, type) => {
    acc[type] = [];
    return acc;
  }, {} as ProducingCredits),
  recordedAt: [],
  recordedAtDateFrom: '',
  recordedAtDateTo: '',
  recordedAtText: '',
  recordedAtCity: '',
  recordedAtURL: '',
  showAddRecordedAtInputs: false,
  mixedAt: [],
  mixedAtDateFrom: '',
  mixedAtDateTo: '',
  mixedAtText: '',
  mixedAtCity: '',
  mixedAtURL: '',
  showAddMixedAtInputs: false,
  purchaseLinks: [],
  streamingLinks: [],
});

export const validateStep = (step: number, formData: AlbumFormData): boolean => {
  if (step === 1) {
    // Шаг 1: Basic Info
    const errors: string[] = [];
    if (!formData.title || !formData.title.trim()) {
      errors.push('Album title');
    }
    if (!formData.releaseDate || !formData.releaseDate.trim()) {
      errors.push('Release date');
    }
    if (!formData.upcEan || !formData.upcEan.trim()) {
      errors.push('UPC / EAN');
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
    if (!formData.genreCodes || formData.genreCodes.length === 0) {
      alert('Пожалуйста, выберите хотя бы один жанр (Genre).');
      return false;
    }
    return true;
  }

  if (step === 3) {
    // Шаг 3: Recorded/Mixed/Mastered - нет обязательных полей
    return true;
  }

  if (step === 4) {
    // Шаг 4: Album Cover, Band Members, Session Musicians, Producer
    const errors: string[] = [];
    // albumCoverPhotographer и albumCoverDesigner теперь необязательные поля
    if (!formData.albumCoverDesigner || !formData.albumCoverDesigner.trim()) {
      errors.push('Album Cover Designer');
    }
    if (!formData.bandMembers || formData.bandMembers.length === 0) {
      errors.push('Band Members (хотя бы один участник)');
    }
    // Проверяем, что есть хотя бы один Producer
    if (!formData.producer || formData.producer.length === 0) {
      errors.push('Producer (хотя бы один продюсер)');
    }
    if (errors.length > 0) {
      alert(`Пожалуйста, заполните обязательные поля:\n${errors.join('\n')}`);
      return false;
    }
    return true;
  }

  // Шаг 5 (Links) - нет обязательных полей
  return true;
};

export const transformFormDataToAlbumFormat = (
  formData: AlbumFormData,
  lang: SupportedLang,
  ui?: IInterface,
  /**
   * Merged details (например `getAlbumDetailsForEdit(...).details`): id берутся по `kind`
   * из `classifyDetailBlockTitle(normalize(title))`, а не по заголовку только текущей локали.
   */
  existingDetails?: unknown[]
): {
  release: Record<string, string>;
  buttons: Record<string, string>;
  details: unknown[];
} => {
  // Конвертируем дату из формата DD/MM/YYYY в ISO формат YYYY-MM-DD для сохранения в БД
  const releaseDateISO = formatDateToISO(formData.releaseDate);

  // Базовый объект release с обязательными полями
  const release: Record<string, string> = {
    date: releaseDateISO,
    UPC: formData.upcEan,
  };

  // Сохраняем allowDownloadSale (всегда, даже если 'no')
  release.allowDownloadSale = formData.allowDownloadSale || 'no';

  // Сохраняем preorderReleaseDate, если включен preorder
  if (formData.allowDownloadSale === 'preorder' && formData.preorderReleaseDate) {
    const preorderDateISO = formatDateToISO(formData.preorderReleaseDate);
    if (preorderDateISO) {
      release.preorderReleaseDate = preorderDateISO;
    }
  }

  // Сохраняем цену и валюту
  if (formData.regularPrice && formData.regularPrice.trim()) {
    release.regularPrice = formData.regularPrice.trim();
  }
  if (formData.currency && formData.currency.trim()) {
    release.currency = formData.currency.trim();
  }

  /** Кредиты обложки (photographer/designer) — в `translations[lang]`, не в `release`. */

  /** Единые на альбом: жанры и теги в `release`, не в `details`. */
  if (formData.genreCodes?.length) {
    (release as Record<string, unknown>).genreCodes = formData.genreCodes
      .map((c) => String(c).trim())
      .filter(Boolean);
  }
  if (formData.tags?.length) {
    (release as Record<string, unknown>).tags = formData.tags
      .map((t) => String(t).trim())
      .filter(Boolean);
  }

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

  const { kindToId, maxId } = collectExistingDetailIdsByKind(existingDetails, ui);
  const usedIds = new Set<number>();
  const maxIdRef = { n: maxId };
  const takeId = (kind: DetailBlockKind) => takeDetailBlockId(kind, kindToId, usedIds, maxIdRef);

  if (formData.bandMembers.length > 0) {
    details.push({
      id: takeId('bandMembers'),
      title: lang === 'ru' ? 'Исполнители' : 'Band members',
      content: formData.bandMembers.map((m) => {
        // Удаляем точку в конце role, если она есть (чтобы избежать двойных точек)
        const roleClean = m.role.trim().replace(/\.+$/, '');
        const text = `${m.name} — ${roleClean}.`;
        // Если есть ссылка (не undefined и не пустая строка), сохраняем в формате объекта с text и link
        const urlTrimmed = m.url?.trim();
        if (urlTrimmed && urlTrimmed.length > 0) {
          console.log('🔗 [transformFormDataToAlbumFormat] Saving band member with URL:', {
            name: m.name,
            url: urlTrimmed,
          });
          return {
            text: ['', m.name, ` — ${roleClean}.`],
            link: urlTrimmed,
          };
        }
        // Иначе сохраняем как строку (без link)
        console.log('📝 [transformFormDataToAlbumFormat] Saving band member as string:', {
          name: m.name,
          url: m.url,
          urlTrimmed,
        });
        return text;
      }),
    });
  }

  if (formData.sessionMusicians.length > 0) {
    details.push({
      id: takeId('sessionMusicians'),
      title: lang === 'ru' ? 'Сессионные музыканты' : 'Session musicians',
      content: formData.sessionMusicians.map((m) => {
        // Удаляем точку в конце role, если она есть (чтобы избежать двойных точек)
        const roleClean = m.role.trim().replace(/\.+$/, '');
        const text = `${m.name} — ${roleClean}.`;
        // Если есть ссылка (не undefined и не пустая строка), сохраняем в формате объекта с text и link
        const urlTrimmed = m.url?.trim();
        if (urlTrimmed && urlTrimmed.length > 0) {
          return {
            text: ['', m.name, ` — ${roleClean}.`],
            link: urlTrimmed,
          };
        }
        // Иначе сохраняем как строку (без link)
        return text;
      }),
    });
  }

  // Добавляем Producer
  if (formData.producer && formData.producer.length > 0) {
    details.push({
      id: takeId('producing'),
      title: lang === 'ru' ? 'Продюсирование' : 'Producing',
      content: formData.producer.map((member) => {
        // Новый формат: используем BandMember с name и role
        // Сохраняем в формате ["Имя", "роль"]
        const roleClean = member.role.trim().replace(/\.+$/, ''); // Удаляем точку в конце, если есть
        const urlTrimmed = member.url?.trim();

        const result: { text: string[]; link?: string } = {
          text: [member.name.trim(), roleClean],
        };

        if (urlTrimmed && urlTrimmed.length > 0) {
          result.link = urlTrimmed;
        }

        return result;
      }),
    });
  }

  // Добавляем Mastering
  if (formData.mastering && formData.mastering.length > 0) {
    details.push({
      id: takeId('mastering'),
      title: lang === 'ru' ? 'Мастеринг' : 'Mastered By',
      content: formData.mastering.map((entry) => {
        // Сохраняем в новом формате с dateFrom, dateTo, studioText, city, url
        const result: any = {};
        if (entry.dateFrom) result.dateFrom = entry.dateFrom;
        if (entry.dateTo) result.dateTo = entry.dateTo;
        if (entry.studioText) result.studioText = entry.studioText;
        if (entry.city) result.city = entry.city;
        if (entry.url && entry.url.trim()) {
          result.url = entry.url.trim();
        } else {
          result.url = null;
        }
        return result;
      }),
    });
  }

  // Добавляем Recorded At
  if (formData.recordedAt.length > 0) {
    details.push({
      id: takeId('recordedAt'),
      title: lang === 'ru' ? 'Запись' : 'Recorded At',
      content: formData.recordedAt.map((entry) => {
        // Сохраняем в новом формате с dateFrom, dateTo, studioText, city, url
        const result: any = {};
        if (entry.dateFrom) result.dateFrom = entry.dateFrom;
        if (entry.dateTo) result.dateTo = entry.dateTo;
        if (entry.studioText) result.studioText = entry.studioText;
        if (entry.city) result.city = entry.city;
        if (entry.url && entry.url.trim()) {
          result.url = entry.url.trim();
        } else {
          result.url = null;
        }
        return result;
      }),
    });
  }

  // Добавляем Mixed At
  if (formData.mixedAt.length > 0) {
    details.push({
      id: takeId('mixedAt'),
      title: lang === 'ru' ? 'Сведение' : 'Mixed At',
      content: formData.mixedAt.map((entry) => {
        // Сохраняем в новом формате с dateFrom, dateTo, studioText, city, url
        const result: any = {};
        if (entry.dateFrom) result.dateFrom = entry.dateFrom;
        if (entry.dateTo) result.dateTo = entry.dateTo;
        if (entry.studioText) result.studioText = entry.studioText;
        if (entry.city) result.city = entry.city;
        if (entry.url && entry.url.trim()) {
          result.url = entry.url.trim();
        } else {
          result.url = null;
        }
        return result;
      }),
    });
  }

  return { release, buttons, details };
};
