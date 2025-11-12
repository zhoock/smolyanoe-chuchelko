// src/pages/AdminAlbumBuilder/AdminAlbumBuilder.tsx
/**
 * Простая админка-конструктор, позволяющая вручную заполнить данные альбома,
 * добавить треки, сохранить черновик в localStorage и экспортировать в JSON.
 * Подходит для пользователей без доступа к репозиторию: все изменения локальны.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Breadcrumb } from '@shared/ui/breadcrumb';
import type { IAlbums, TracksProps } from '@models';
import './style.scss';

type StatusKind = 'success' | 'error' | 'info';

interface StatusNotice {
  type: StatusKind;
  message: string;
}

interface TrackDraft {
  id: string;
  title: string;
  duration: string;
  src: string;
  content: string;
  authorship: string;
}

interface ServiceDraft {
  name: string;
  url: string;
}

interface DetailEntryDraft {
  text: string;
}

interface DetailDraft {
  id: string;
  title: string;
  entries: DetailEntryDraft[];
}

interface AlbumDraft {
  albumId: string;
  artist: string;
  album: string;
  description: string;
  coverImg: string;
  releaseDate: string;
  releaseUpc: string;
  tracks: TrackDraft[];
  buttons: ServiceDraft[];
  details: DetailDraft[];
}

const STORAGE_KEY = 'album-builder-draft';
type AlbumBaseField = Exclude<keyof AlbumDraft, 'tracks' | 'buttons' | 'details'>;
type DetailEntryField = 'text' | 'link';

const DETAIL_TEMPLATES = [
  { id: '1', title: 'Genre', placeholder: 'Например: Гранж, альтернативный рок.' },
  { id: '2', title: 'Recorded At', placeholder: 'Укажите даты и студии записи.' },
  { id: '3', title: 'Mixed At', placeholder: 'Укажите студии и даты сведения.' },
  {
    id: '4',
    title: 'Band Members',
    placeholder: 'Ярослав Жук — lead vocals, backing vocals, words and music.',
  },
] as const;

const emptyTrack = (): TrackDraft => ({
  id: '',
  title: '',
  duration: '',
  src: '',
  content: '',
  authorship: '',
});

const emptyDetailValue = (id: string, title: string): DetailDraft => ({
  id,
  title,
  entries: [{ text: '' }],
});

const normalizeDraftDetails = (details?: DetailDraft[]): DetailDraft[] =>
  DETAIL_TEMPLATES.map((template) => {
    const existing =
      details?.find(
        (detail) =>
          (detail.title?.toLowerCase() ?? '') === template.title.toLowerCase() ||
          detail.id === template.id
      ) ?? emptyDetailValue(template.id, template.title);

    const text = existing.entries?.[0]?.text ?? '';

    return {
      id: template.id,
      title: template.title,
      entries: [{ text }],
    };
  });

const DEFAULT_SERVICES: ServiceDraft[] = [
  { name: 'itunes', url: '' },
  { name: 'bandcamp', url: '' },
  { name: 'amazon', url: '' },
  { name: 'apple', url: '' },
  { name: 'vk', url: '' },
  { name: 'youtube', url: '' },
  { name: 'spotify', url: '' },
  { name: 'yandex', url: '' },
  { name: 'deezer', url: '' },
  { name: 'tidal', url: '' },
];

const emptyAlbum: AlbumDraft = {
  albumId: '',
  artist: '',
  album: '',
  description: '',
  coverImg: '',
  releaseDate: '',
  releaseUpc: '',
  tracks: [emptyTrack()],
  buttons: DEFAULT_SERVICES.map((service) => ({ ...service })),
  details: DETAIL_TEMPLATES.map((template) => emptyDetailValue(template.id, template.title)),
};

const formatDuration = (value: string): number | undefined => {
  if (!value.trim()) {
    return undefined;
  }
  const normalized = value.replace(',', '.');
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
};

const draftToAlbum = (draft: AlbumDraft): IAlbums => {
  const cover: IAlbums['cover'] = {
    img: draft.coverImg.trim(),
    fullName: `${draft.artist.trim()} — ${draft.album.trim()}`.trim(),
  };

  const releaseEntries = Object.entries({
    date: draft.releaseDate.trim(),
    UPC: draft.releaseUpc.trim(),
  }).filter(([, value]) => value);

  const release = releaseEntries.reduce<Record<string, string>>((acc, [key, value]) => {
    acc[key] = value;
    return acc;
  }, {});

  const tracks = draft.tracks
    .filter((track) => track.title.trim())
    .map<TracksProps>((track, index) => {
      const parsedId = Number(track.id);
      const parsedDuration = formatDuration(track.duration);

      return {
        id: Number.isFinite(parsedId) && parsedId > 0 ? parsedId : index + 1,
        title: track.title.trim(),
        duration: parsedDuration ?? 0,
        src: track.src.trim() || '',
        content: track.content.trim() || '',
        authorship: track.authorship.trim() || undefined,
      };
    });

  const buttons = draft.buttons
    .filter((service) => service.name.trim() && service.url.trim())
    .reduce<Record<string, string>>((acc, service) => {
      acc[service.name.trim()] = service.url.trim();
      return acc;
    }, {});

  const details = DETAIL_TEMPLATES.map((template, index) => {
    const detail = draft.details[index] ?? emptyDetailValue(template.id, template.title);
    const lines = detail.entries[0]?.text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    return {
      id: Number(template.id),
      title: template.title,
      content: lines && lines.length > 0 ? lines : [],
    };
  });

  return {
    albumId: draft.albumId.trim() || undefined,
    artist: draft.artist.trim(),
    album: draft.album.trim(),
    fullName: `${draft.artist.trim()} — ${draft.album.trim()}`.trim(),
    description: draft.description.trim(),
    cover,
    release,
    buttons,
    details,
    tracks,
  };
};

const albumToDraft = (album: IAlbums): AlbumDraft => {
  const tracks =
    album.tracks?.map((track) => ({
      id: String(track.id ?? ''),
      title: track.title ?? '',
      duration:
        typeof track.duration === 'number' && Number.isFinite(track.duration)
          ? track.duration.toString()
          : '',
      src: track.src ?? '',
      content: track.content ?? '',
      authorship: track.authorship ?? '',
    })) ?? [];

  const buttonEntries = Object.entries(album.buttons ?? {});
  const buttons =
    buttonEntries.length > 0
      ? buttonEntries.map<ServiceDraft>(([name, url]) => ({
          name,
          url,
        }))
      : DEFAULT_SERVICES.map((service) => ({ ...service }));

  const details = DETAIL_TEMPLATES.map((template) => {
    const existing =
      album.details?.find(
        (detail) =>
          detail.title?.toLowerCase() === template.title.toLowerCase() ||
          String(detail.id) === template.id
      ) ?? null;

    if (!existing) {
      return emptyDetailValue(template.id, template.title);
    }

    const entries = existing.content?.map<DetailEntryDraft>((item) => {
      if (typeof item === 'string') {
        return { text: item, link: '' };
      }

      const lines = Array.isArray(item.text) ? item.text.map((line) => line ?? '').join('\n') : '';

      return {
        text: lines,
        link: '',
      };
    }) ?? [{ text: '', link: '' }];

    return {
      id: template.id,
      title: template.title,
      entries,
    };
  });

  return {
    albumId: album.albumId || '',
    artist: album.artist || '',
    album: album.album || '',
    description: album.description || '',
    coverImg: album.cover?.img || '',
    releaseDate: album.release?.date || '',
    releaseUpc: album.release?.UPC || '',
    tracks,
    buttons,
    details: normalizeDraftDetails(details),
  };
};

const validateDraft = (draft: AlbumDraft): string[] => {
  const issues: string[] = [];
  if (!draft.albumId.trim()) {
    issues.push('Укажите поле «albumId».');
  }
  if (!draft.album.trim()) {
    issues.push('Укажите название альбома.');
  }
  if (!draft.artist.trim()) {
    issues.push('Укажите исполнителя.');
  }
  if (!draft.tracks.length || draft.tracks.every((track) => !track.title.trim())) {
    issues.push('Добавьте хотя бы один трек.');
  }

  draft.tracks.forEach((track, index) => {
    if (!track.title.trim()) {
      issues.push(`Трек №${index + 1}: поле «Название» обязательно.`);
    }
    if (track.duration.trim() && Number.isNaN(formatDuration(track.duration))) {
      issues.push(`Трек №${index + 1}: значение длительности не удаётся преобразовать в число.`);
    }
  });

  const ids = draft.tracks.map((track) => track.id.trim() || track.title.trim());
  const duplicates = ids.filter((id, index) => id && ids.indexOf(id) !== index);
  if (duplicates.length > 0) {
    issues.push(
      `Есть повторяющиеся идентификаторы треков: ${Array.from(new Set(duplicates)).join(', ')}.`
    );
  }

  draft.buttons.forEach((service, index) => {
    const name = service.name.trim();
    const url = service.url.trim();
    if (name && !url) {
      issues.push(`Ссылки: заполните URL для сервиса "${name}" (запись №${index + 1}).`);
    }
    if (!name && url) {
      issues.push(`Ссылки: укажите название сервиса для URL "${url}" (запись №${index + 1}).`);
    }
  });

  DETAIL_TEMPLATES.forEach((template, index) => {
    const detail = draft.details[index];
    const hasText =
      detail?.entries[0]?.text.split('\n').some((line) => line.trim().length > 0) ?? false;

    if (!hasText) {
      issues.push(`Заполните раздел "${template.title}".`);
    }
  });

  return issues;
};

export default function AdminAlbumBuilder() {
  const [draft, setDraft] = useState<AlbumDraft>(emptyAlbum);
  const [status, setStatus] = useState<StatusNotice | null>(null);
  const [importText, setImportText] = useState('');

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as AlbumDraft;
        const normalizedDetails = normalizeDraftDetails(parsed.details);
        setDraft({
          ...emptyAlbum,
          ...parsed,
          tracks: parsed.tracks?.length ? parsed.tracks : [emptyTrack()],
          buttons:
            parsed.buttons?.length && parsed.buttons.some((button) => button.name || button.url)
              ? parsed.buttons
              : DEFAULT_SERVICES.map((service) => ({ ...service })),
          details: normalizedDetails,
        });
        setStatus({
          type: 'info',
          message: 'Загружен сохранённый черновик из localStorage.',
        });
      }
    } catch (error) {
      console.warn('Не удалось загрузить черновик:', error);
    }
  }, []);

  const handleAlbumChange = useCallback((field: AlbumBaseField, value: string) => {
    setDraft((prev) => ({
      ...prev,
      [field]: value,
    }));
  }, []);

  const updateTrackField = useCallback((index: number, field: keyof TrackDraft, value: string) => {
    setDraft((prev) => {
      const tracks = [...prev.tracks];
      tracks[index] = {
        ...tracks[index],
        [field]: value,
      };
      return {
        ...prev,
        tracks,
      };
    });
  }, []);

  const addTrack = useCallback(() => {
    setDraft((prev) => ({
      ...prev,
      tracks: [...prev.tracks, emptyTrack()],
    }));
  }, []);

  const removeTrack = useCallback((index: number) => {
    setDraft((prev) => {
      if (prev.tracks.length <= 1) {
        return prev;
      }
      const tracks = prev.tracks.filter((_, trackIndex) => trackIndex !== index);
      return {
        ...prev,
        tracks,
      };
    });
  }, []);

  const updateServiceField = useCallback(
    (index: number, field: keyof ServiceDraft, value: string) => {
      setDraft((prev) => {
        const buttons = [...prev.buttons];
        buttons[index] = {
          ...buttons[index],
          [field]: value,
        };
        return {
          ...prev,
          buttons,
        };
      });
    },
    []
  );

  const addService = useCallback(() => {
    setDraft((prev) => ({
      ...prev,
      buttons: [...prev.buttons, { name: '', url: '' }],
    }));
  }, []);

  const removeService = useCallback((index: number) => {
    setDraft((prev) => {
      if (prev.buttons.length <= 1) {
        return prev;
      }
      const buttons = prev.buttons.filter((_, buttonIndex) => buttonIndex !== index);
      return {
        ...prev,
        buttons,
      };
    });
  }, []);

  const updateDetailEntryField = useCallback(
    (detailIndex: number, _entryIndex: number, _field: DetailEntryField, value: string) => {
      setDraft((prev) => {
        const details = normalizeDraftDetails(prev.details);
        details[detailIndex] = {
          id: DETAIL_TEMPLATES[detailIndex].id,
          title: DETAIL_TEMPLATES[detailIndex].title,
          entries: [{ text: value }],
        };
        return { ...prev, details };
      });
    },
    []
  );

  const handleSaveDraft = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    setStatus({
      type: 'success',
      message: 'Черновик сохранён в localStorage.',
    });
  }, [draft]);

  const handleClearDraft = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setStatus({
      type: 'info',
      message: 'Черновик удалён.',
    });
  }, []);

  const handleReset = useCallback(() => {
    setDraft(emptyAlbum);
    setStatus({
      type: 'info',
      message: 'Форма очищена.',
    });
  }, []);

  const handleValidate = useCallback(() => {
    const issues = validateDraft(draft);
    if (issues.length > 0) {
      setStatus({
        type: 'error',
        message: `Найдены проблемы:\n- ${issues.join('\n- ')}`,
      });
    } else {
      setStatus({
        type: 'success',
        message: 'Поля заполнены корректно. Можно экспортировать JSON.',
      });
    }
  }, [draft]);

  const handleImport = useCallback(() => {
    if (!importText.trim()) {
      setStatus({
        type: 'info',
        message: 'Вставьте JSON в поле «Импорт из JSON».',
      });
      return;
    }
    try {
      const parsed = JSON.parse(importText) as IAlbums;
      const nextDraft = albumToDraft(parsed);
      setDraft({
        ...emptyAlbum,
        ...nextDraft,
        tracks: nextDraft.tracks.length ? nextDraft.tracks : [emptyTrack()],
        buttons:
          nextDraft.buttons.length && nextDraft.buttons.some((button) => button.name || button.url)
            ? nextDraft.buttons
            : DEFAULT_SERVICES.map((service) => ({ ...service })),
        details: normalizeDraftDetails(nextDraft.details),
      });
      setStatus({
        type: 'success',
        message: 'JSON импортирован в форму.',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Ошибка разбора JSON.';
      setStatus({
        type: 'error',
        message: `Не удалось импортировать JSON: ${message}`,
      });
    }
  }, [importText]);

  const albumJson = useMemo(() => {
    const albumObject = draftToAlbum(draft);
    return JSON.stringify(albumObject, null, 2);
  }, [draft]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(albumJson);
      setStatus({
        type: 'success',
        message: 'JSON скопирован в буфер обмена.',
      });
    } catch (error) {
      setStatus({
        type: 'error',
        message: `Не удалось скопировать JSON: ${
          error instanceof Error ? error.message : 'неизвестная ошибка'
        }`,
      });
    }
  }, [albumJson]);

  const handleDownload = useCallback(() => {
    const filename = `${draft.albumId || 'album'}-${draft.artist || 'artist'}.json`;
    const blob = new Blob([albumJson], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
    setStatus({
      type: 'success',
      message: `Файл ${filename} скачан.`,
    });
  }, [albumJson, draft.albumId, draft.artist]);

  return (
    <section className="album-builder main-background" aria-label="Конструктор альбомов">
      <div className="wrapper">
        <Breadcrumb
          items={[{ label: 'К альбомам', to: '/admin' }, { label: 'Конструктор альбома' }]}
        />

        <header className="album-builder__header">
          <h1>Конструктор альбомов</h1>
          <p>
            Заполните данные альбома и треков. Черновик сохраняется в localStorage, вы можете
            вернуться позднее. Готовый JSON можно скопировать или скачать для передачи в основной
            проект/API.
          </p>
        </header>

        <div className="album-builder__toolbar">
          <button type="button" onClick={handleValidate}>
            Проверить заполнение
          </button>
          <button type="button" onClick={handleSaveDraft}>
            Сохранить черновик
          </button>
          <button type="button" onClick={handleClearDraft}>
            Удалить черновик
          </button>
          <button type="button" onClick={handleReset}>
            Очистить форму
          </button>
          <button type="button" onClick={handleCopy}>
            Скопировать JSON
          </button>
          <button type="button" onClick={handleDownload}>
            Скачать JSON
          </button>
          <Link to="/admin" className="album-builder__back">
            ← Назад
          </Link>
        </div>

        {status && (
          <div className={`album-builder__status album-builder__status--${status.type}`}>
            {status.message}
          </div>
        )}

        <div className="album-builder__grid">
          <div className="album-builder__left">
            <fieldset className="album-builder__group">
              <legend>Основные данные</legend>
              <div className="album-builder__field">
                <label htmlFor="album-id">albumId</label>
                <input
                  id="album-id"
                  value={draft.albumId}
                  onChange={(event) => handleAlbumChange('albumId', event.target.value)}
                  placeholder="например, 23-remastered"
                />
              </div>
              <div className="album-builder__field">
                <label htmlFor="album-artist">Исполнитель</label>
                <input
                  id="album-artist"
                  value={draft.artist}
                  onChange={(event) => handleAlbumChange('artist', event.target.value)}
                  placeholder="Смоляное Чучелко"
                />
              </div>
              <div className="album-builder__field">
                <label htmlFor="album-title">Название альбома</label>
                <input
                  id="album-title"
                  value={draft.album}
                  onChange={(event) => handleAlbumChange('album', event.target.value)}
                  placeholder="23 (Remastered)"
                />
              </div>
              <div className="album-builder__field">
                <label htmlFor="album-description">Описание</label>
                <textarea
                  id="album-description"
                  rows={5}
                  value={draft.description}
                  onChange={(event) => handleAlbumChange('description', event.target.value)}
                  placeholder="Краткое описание альбома..."
                />
              </div>
            </fieldset>

            <fieldset className="album-builder__group album-builder__group--secondary">
              <legend>Обложка и релиз</legend>
              <div className="album-builder__field">
                <label htmlFor="album-cover">Путь к обложке</label>
                <input
                  id="album-cover"
                  value={draft.coverImg}
                  onChange={(event) => handleAlbumChange('coverImg', event.target.value)}
                  placeholder="Tar-Baby-Cover-23-remastered"
                />
              </div>
              <div className="album-builder__field album-builder__field--inline">
                <div>
                  <label htmlFor="album-release-date">Дата релиза</label>
                  <input
                    id="album-release-date"
                    type="date"
                    value={draft.releaseDate}
                    onChange={(event) => handleAlbumChange('releaseDate', event.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="album-upc">UPC</label>
                  <input
                    id="album-upc"
                    value={draft.releaseUpc}
                    onChange={(event) => handleAlbumChange('releaseUpc', event.target.value)}
                    placeholder="5016122320228/199199051297"
                  />
                </div>
              </div>
            </fieldset>

            <fieldset className="album-builder__group">
              <legend>Треки</legend>
              {draft.tracks.map((track, index) => (
                <details
                  key={index}
                  className="album-builder__track"
                  open={draft.tracks.length === 1 || index === draft.tracks.length - 1}
                >
                  <summary>
                    <span>
                      #{index + 1} {track.title || 'Новый трек'}
                    </span>
                    {draft.tracks.length > 1 && (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          removeTrack(index);
                        }}
                      >
                        Удалить
                      </button>
                    )}
                  </summary>
                  <div className="album-builder__track-body">
                    <div className="album-builder__field">
                      <label htmlFor={`track-id-${index}`}>ID трека</label>
                      <input
                        id={`track-id-${index}`}
                        value={track.id}
                        onChange={(event) => updateTrackField(index, 'id', event.target.value)}
                        placeholder="1"
                      />
                    </div>
                    <div className="album-builder__field">
                      <label htmlFor={`track-title-${index}`}>Название</label>
                      <input
                        id={`track-title-${index}`}
                        value={track.title}
                        onChange={(event) => updateTrackField(index, 'title', event.target.value)}
                        placeholder="Фиджийская русалка Барнума"
                      />
                    </div>
                    <div className="album-builder__field album-builder__field--inline">
                      <div>
                        <label htmlFor={`track-duration-${index}`}>Длительность (минуты)</label>
                        <input
                          id={`track-duration-${index}`}
                          value={track.duration}
                          onChange={(event) =>
                            updateTrackField(index, 'duration', event.target.value)
                          }
                          placeholder="3.28"
                        />
                      </div>
                      <div>
                        <label htmlFor={`track-src-${index}`}>Путь к файлу</label>
                        <input
                          id={`track-src-${index}`}
                          value={track.src}
                          onChange={(event) => updateTrackField(index, 'src', event.target.value)}
                          placeholder="/audio/..."
                        />
                      </div>
                    </div>
                    <div className="album-builder__field">
                      <label htmlFor={`track-authorship-${index}`}>Авторство</label>
                      <input
                        id={`track-authorship-${index}`}
                        value={track.authorship}
                        onChange={(event) =>
                          updateTrackField(index, 'authorship', event.target.value)
                        }
                        placeholder="Ярослав Жук — слова и музыка"
                      />
                    </div>
                    <div className="album-builder__field">
                      <label htmlFor={`track-content-${index}`}>Текст песни</label>
                      <textarea
                        id={`track-content-${index}`}
                        rows={6}
                        value={track.content}
                        onChange={(event) => updateTrackField(index, 'content', event.target.value)}
                        placeholder="Полный текст песни..."
                      />
                    </div>
                  </div>
                </details>
              ))}
              <button type="button" className="album-builder__add-track" onClick={addTrack}>
                + Добавить трек
              </button>
            </fieldset>

            <fieldset className="album-builder__group">
              <legend>Дополнительная информация</legend>
              <p className="album-builder__group-hint">
                Заполните обязательные разделы блока «details». Для каждого заголовка введите
                значения, разделяя пункты переносом строки.
              </p>
              <div className="album-builder__details-simple">
                {DETAIL_TEMPLATES.map((template, detailIndex) => {
                  const detail =
                    draft.details[detailIndex] ?? emptyDetailValue(template.id, template.title);
                  const value = detail.entries[0]?.text ?? '';
                  return (
                    <div key={template.id} className="album-builder__details-row">
                      <label htmlFor={`detail-${template.id}`}>{template.title}</label>
                      <textarea
                        id={`detail-${template.id}`}
                        rows={template.id === '1' ? 3 : 4}
                        value={value}
                        onChange={(event) => {
                          const text = event.target.value;
                          setDraft((prev) => {
                            const details = normalizeDraftDetails(prev.details);
                            details[detailIndex] = {
                              id: template.id,
                              title: template.title,
                              entries: [{ text }],
                            };
                            return { ...prev, details };
                          });
                        }}
                        placeholder={template.placeholder}
                      />
                    </div>
                  );
                })}
              </div>
            </fieldset>

            <fieldset className="album-builder__group">
              <legend>Ссылки на сервисы</legend>
              <p className="album-builder__group-hint">
                Заполните название платформы и URL. Пустые строки при экспорте будут
                проигнорированы. Можно добавить дополнительные записи.
              </p>
              <div className="album-builder__services">
                {draft.buttons.map((service, index) => (
                  <div key={index} className="album-builder__service">
                    <div className="album-builder__service-fields">
                      <div className="album-builder__field">
                        <label htmlFor={`service-name-${index}`}>Название сервиса</label>
                        <input
                          id={`service-name-${index}`}
                          value={service.name}
                          onChange={(event) =>
                            updateServiceField(index, 'name', event.target.value)
                          }
                          placeholder="spotify"
                        />
                      </div>
                      <div className="album-builder__field">
                        <label htmlFor={`service-url-${index}`}>Ссылка</label>
                        <input
                          id={`service-url-${index}`}
                          value={service.url}
                          onChange={(event) => updateServiceField(index, 'url', event.target.value)}
                          placeholder="https://..."
                        />
                      </div>
                    </div>
                    {draft.buttons.length > 1 && (
                      <button
                        type="button"
                        className="album-builder__service-remove"
                        onClick={() => removeService(index)}
                      >
                        Удалить
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button type="button" className="album-builder__add-service" onClick={addService}>
                + Добавить сервис
              </button>
            </fieldset>
          </div>

          <div className="album-builder__right">
            <section className="album-builder__preview">
              <h2>Предварительный просмотр JSON</h2>
              <pre>{albumJson}</pre>
            </section>

            <section className="album-builder__import">
              <h2>Импорт из JSON</h2>
              <textarea
                rows={12}
                placeholder="Вставьте JSON альбома, чтобы загрузить его в форму..."
                value={importText}
                onChange={(event) => setImportText(event.target.value)}
              />
              <button type="button" onClick={handleImport}>
                Импортировать в форму
              </button>
            </section>
          </div>
        </div>
      </div>
    </section>
  );
}
