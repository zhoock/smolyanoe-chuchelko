// src/pages/UserDashboard/components/EditAlbumModal.utils.ts
import type { AlbumFormData, ProducingCredits } from './EditAlbumModal.types';
import { DEFAULT_PRODUCING_CREDIT_TYPES } from './EditAlbumModal.constants';
import type { SupportedLang } from '@shared/model/lang';

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
  albumCoverPhotographerURL: '',
  albumCoverDesigner: '',
  albumCoverDesignerURL: '',
  bandMembers: [],
  sessionMusicians: [],
  producingCredits: DEFAULT_PRODUCING_CREDIT_TYPES.reduce((acc, type) => {
    acc[type] = [];
    return acc;
  }, {} as ProducingCredits),
  recordedAt: [],
  recordedAtText: '',
  recordedAtURL: '',
  mixedAt: [],
  mixedAtText: '',
  mixedAtURL: '',
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
    if (!formData.mood || formData.mood.length === 0) {
      alert('Пожалуйста, выберите хотя бы один жанр (Genre).');
      return false;
    }
    return true;
  }

  if (step === 3) {
    // Шаг 3: Credits
    const errors: string[] = [];
    // albumCoverPhotographer и albumCoverDesigner теперь необязательные поля
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
  // Конвертируем дату из формата DD/MM/YYYY в ISO формат YYYY-MM-DD для сохранения в БД
  const releaseDateISO = formatDateToISO(formData.releaseDate);

  // Базовый объект release с обязательными полями
  const release: Record<string, string> = {
    date: releaseDateISO,
    UPC: formData.upcEan,
  };

  // Сохраняем photographer (необязательное поле) и designer (обязательное поле)
  if (formData.albumCoverPhotographer) release.photographer = formData.albumCoverPhotographer;
  if (formData.albumCoverDesigner) release.designer = formData.albumCoverDesigner;

  // Сохраняем URL (необязательные поля)
  // Важно: явно устанавливаем пустую строку для пустых значений, чтобы удалить их при merge
  const photographerURLTrimmed = formData.albumCoverPhotographerURL?.trim();
  if (photographerURLTrimmed) {
    release.photographerURL = photographerURLTrimmed;
  } else {
    // Устанавливаем пустую строку, чтобы удалить поле при merge (пустая строка будет отфильтрована)
    release.photographerURL = '';
  }

  const designerURLTrimmed = formData.albumCoverDesignerURL?.trim();
  if (designerURLTrimmed) {
    release.designerURL = designerURLTrimmed;
  } else {
    // Устанавливаем пустую строку, чтобы удалить поле при merge (пустая строка будет отфильтрована)
    release.designerURL = '';
  }

  // Удаляем пустые URL поля из объекта перед сохранением
  Object.keys(release).forEach((key) => {
    if (key === 'photographerURL' || key === 'designerURL') {
      if (!release[key] || release[key].trim() === '') {
        delete release[key];
      }
    }
  });

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

  // Genre должен быть первым элементом с id: 1
  if (formData.mood && formData.mood.length > 0) {
    // Форматируем жанры: все в нижнем регистре, кроме первой буквы первого слова первого жанра
    // Затем объединяем через запятую и добавляем точку в конце
    // Например: "Grunge, alternative rock." или "Grunge."
    const formatGenres = (genres: string[]): string => {
      if (genres.length === 0) return '';

      // Все жанры в нижнем регистре
      const lowerGenres = genres
        .map((genre) => genre.trim().toLowerCase())
        .filter((g) => g.length > 0);

      if (lowerGenres.length === 0) return '';

      // Первую букву первого жанра делаем заглавной
      const firstGenre = lowerGenres[0];
      const capitalizedFirstGenre = firstGenre.charAt(0).toUpperCase() + firstGenre.slice(1);

      // Остальные жанры остаются в нижнем регистре
      const otherGenres = lowerGenres.slice(1);

      // Объединяем через запятую и пробел, добавляем точку в конце
      const allGenres =
        otherGenres.length > 0
          ? [capitalizedFirstGenre, ...otherGenres].join(', ')
          : capitalizedFirstGenre;

      return `${allGenres}.`;
    };

    const genreText = formatGenres(formData.mood);
    if (genreText) {
      details.push({
        id: 1,
        title: lang === 'ru' ? 'Жанр' : 'Genre',
        content: [genreText],
      });
    }
  }

  // Начинаем id с 2, так как Genre имеет id: 1
  let nextId = details.length > 0 ? 2 : 1;

  if (formData.bandMembers.length > 0) {
    details.push({
      id: nextId++,
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
      id: nextId++,
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

  // Обрабатываем Producing и Mastering
  const producingContent: unknown[] = [];
  const masteringContent: unknown[] = [];

  Object.entries(formData.producingCredits).forEach(([creditType, members]) => {
    if (members.length > 0) {
      members.forEach((member) => {
        const role = member.role || creditType;
        // Удаляем точку в конце role, если она есть (чтобы избежать двойных точек)
        const roleClean = role.trim().replace(/\.+$/, '');
        const creditText = `${member.name} — ${roleClean}.`;

        // Если есть ссылка (не undefined и не пустая строка), сохраняем в формате объекта с text и link
        const urlTrimmed = member.url?.trim();
        const itemToPush =
          urlTrimmed && urlTrimmed.length > 0
            ? {
                text: ['', member.name, ` — ${roleClean}.`],
                link: urlTrimmed,
              }
            : creditText;

        if (creditType === 'Mastering') {
          masteringContent.push(itemToPush);
        } else {
          producingContent.push(itemToPush);
        }
      });
    }
  });

  if (producingContent.length > 0) {
    details.push({
      id: nextId++,
      title: lang === 'ru' ? 'Продюсирование' : 'Producing',
      content: producingContent,
    });
  }

  if (masteringContent.length > 0) {
    details.push({
      id: nextId++,
      title: lang === 'ru' ? 'Мастеринг' : 'Mastering',
      content: masteringContent,
    });
  }

  // Добавляем Recorded At
  if (formData.recordedAt.length > 0) {
    details.push({
      id: nextId++,
      title: lang === 'ru' ? 'Запись' : 'Recorded At',
      content: formData.recordedAt.map((entry) => {
        if (entry.url && entry.url.trim()) {
          // Если есть URL, сохраняем в формате объекта с text и link
          return {
            text: [entry.text],
            link: entry.url.trim(),
          };
        }
        // Иначе сохраняем как строку
        return entry.text;
      }),
    });
  }

  // Добавляем Mixed At
  if (formData.mixedAt.length > 0) {
    details.push({
      id: nextId++,
      title: lang === 'ru' ? 'Сведение' : 'Mixed At',
      content: formData.mixedAt.map((entry) => {
        if (entry.url && entry.url.trim()) {
          // Если есть URL, сохраняем в формате объекта с text и link
          return {
            text: [entry.text],
            link: entry.url.trim(),
          };
        }
        // Иначе сохраняем как строку
        return entry.text;
      }),
    });
  }

  return { release, buttons, details };
};
