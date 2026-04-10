/**
 * Сборка отображаемого снимка альбома/трека для текущего языка UI без мутации `translations`.
 */

import type { SupportedLang } from '@shared/model/lang';
import type { IAlbums, TracksProps, detailsProps } from '@models';
import { CANONICAL_GENRES } from '@shared/constants/canonicalGenres';
import {
  buildTranslationFallbackLocales,
  DEFAULT_CONTENT_LOCALE,
  isTranslationValueMissing,
  resolveTranslationString,
  TRANSLATION_LOCALE_ORDER,
} from '@shared/lib/i18n/resolveTranslationFallback';

const GENRE_DETAIL_TITLES = new Set(['Genre', 'Genres', 'Жанр', 'Жанры']);

function hasSyncedLyricsData(lines: TracksProps['syncedLyrics']): boolean {
  return Array.isArray(lines) && lines.length > 0;
}

export function stripGenreDetailBlocks(details: detailsProps[]): detailsProps[] {
  return details.filter(
    (d) =>
      d &&
      typeof d === 'object' &&
      !GENRE_DETAIL_TITLES.has(String((d as { title?: string }).title ?? ''))
  );
}

function readGenreCodesFromRelease(release: IAlbums['release'] | undefined): string[] {
  if (!release || typeof release !== 'object') return [];
  const raw = (release as Record<string, unknown>).genreCodes;
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === 'string' && x.trim().length > 0);
}

function formatGenreDetailLine(codes: string[], lang: SupportedLang): string {
  if (codes.length === 0) return '';
  const words = codes
    .map((code) => {
      const opt = CANONICAL_GENRES.find((g) => g.code === code.trim().toLowerCase());
      const raw = opt ? (lang === 'ru' ? opt.label.ru : opt.label.en) : code.trim();
      return raw.toLowerCase();
    })
    .filter((w) => w.length > 0);
  if (words.length === 0) return '';
  const first = words[0].charAt(0).toUpperCase() + words[0].slice(1);
  const rest = words.slice(1);
  const body = rest.length > 0 ? [first, ...rest].join(', ') : first;
  return `${body}.`;
}

function injectGenreDetailIfNeeded(
  details: detailsProps[],
  album: IAlbums,
  lang: SupportedLang
): detailsProps[] {
  const codes = readGenreCodesFromRelease(album.release);
  if (codes.length === 0) return details;
  const line = formatGenreDetailLine(codes, lang);
  if (!line) return details;
  const base = stripGenreDetailBlocks(details);
  const title = lang === 'ru' ? 'Жанр' : 'Genre';
  return [{ id: 1, title, content: [line] } as detailsProps, ...base];
}

function albumTranslationStrings(
  album: IAlbums,
  field: 'fullName' | 'description'
): Partial<Record<SupportedLang, string | null | undefined>> {
  return {
    en: album.translations?.en?.[field],
    ru: album.translations?.ru?.[field],
  };
}

/** Откуда взято значение в форме редактирования (для подписи fallback). */
export type AlbumEditFieldSource = SupportedLang | 'root';

export type ResolvedAlbumEditField = {
  value: string;
  /** true, если значение не из `translations[lang]` (другая локаль или корень). */
  isFallback: boolean;
  source: AlbumEditFieldSource;
};

export type ResolvedAlbumEditDetails = {
  details: detailsProps[];
  isFallback: boolean;
  source: AlbumEditFieldSource;
};

/**
 * Значение поля для формы: та же цепочка, что и на display (current → default → en, ru), затем корень.
 */
export function resolveAlbumFieldForEdit(
  album: IAlbums,
  field: 'album' | 'fullName' | 'description',
  lang: SupportedLang
): ResolvedAlbumEditField {
  if (field === 'album') {
    const root = (album.album ?? '').trim();
    if (root) return { value: root, isFallback: false, source: 'root' };
    const legacy = resolveTranslationString(
      {
        en: album.translations?.en?.album,
        ru: album.translations?.ru?.album,
      },
      lang
    );
    if (legacy)
      return {
        value: legacy,
        isFallback: true,
        source: lang,
      };
    return { value: '', isFallback: false, source: 'root' };
  }

  const chain = buildTranslationFallbackLocales(
    lang,
    DEFAULT_CONTENT_LOCALE,
    TRANSLATION_LOCALE_ORDER
  );
  for (const loc of chain) {
    const raw = album.translations?.[loc]?.[field];
    if (typeof raw === 'string' && raw.trim()) {
      return { value: raw.trim(), isFallback: loc !== lang, source: loc };
    }
  }
  let root = '';
  if (field === 'fullName') root = (album.fullName ?? '').trim();
  else root = (album.description ?? '').trim();
  return {
    value: root,
    isFallback: root.length > 0,
    source: 'root',
  };
}

export function getAlbumDetailsForEdit(
  album: IAlbums,
  lang: SupportedLang
): ResolvedAlbumEditDetails {
  const stripGenres = readGenreCodesFromRelease(album.release).length > 0;

  const chain = buildTranslationFallbackLocales(
    lang,
    DEFAULT_CONTENT_LOCALE,
    TRANSLATION_LOCALE_ORDER
  );
  for (const loc of chain) {
    const d = album.translations?.[loc]?.details;
    if (Array.isArray(d) && d.length > 0) {
      const details = stripGenres
        ? stripGenreDetailBlocks(d as detailsProps[])
        : (d as detailsProps[]);
      return { details, isFallback: loc !== lang, source: loc };
    }
  }
  const root = Array.isArray(album.details) ? album.details : [];
  const details = stripGenres ? stripGenreDetailBlocks(root) : root;
  return {
    details,
    isFallback: details.length > 0,
    source: 'root',
  };
}

/** Уникальные источники fallback по нескольким полям (подпись к форме). */
export function collectAlbumEditFallbackSources(
  parts: { isFallback: boolean; source: AlbumEditFieldSource }[]
): AlbumEditFieldSource[] {
  const sources = new Set<AlbumEditFieldSource>();
  for (const p of parts) {
    if (p.isFallback) sources.add(p.source);
  }
  return [...sources];
}

/** Текст предупреждения в формах редактирования (альбом / трек). */
export function buildTranslatedContentEditFallbackNotice(
  sources: AlbumEditFieldSource[],
  lang: SupportedLang
): string | null {
  if (sources.length === 0) return null;
  const label = (s: AlbumEditFieldSource) => {
    if (s === 'root') return lang === 'ru' ? 'основные поля' : 'base fields';
    if (s === 'en') return 'English';
    return 'Русский';
  };
  const joined = [...new Set(sources)].map(label).join(', ');
  if (lang === 'ru') {
    return `Подставлены данные из: ${joined}. Та же логика, что на сайте. При сохранении запишется версия для текущего языка интерфейса.`;
  }
  return `Prefilled from: ${joined} (same as on the site). Saving will update the ${lang === 'en' ? 'English' : 'Russian'} copy.`;
}

export function resolveTrackFieldForEdit(
  track: TracksProps,
  field: 'title' | 'content' | 'authorship',
  lang: SupportedLang
): ResolvedAlbumEditField {
  const chain = buildTranslationFallbackLocales(
    lang,
    DEFAULT_CONTENT_LOCALE,
    TRANSLATION_LOCALE_ORDER
  );
  for (const loc of chain) {
    const raw = track.translations?.[loc]?.[field];
    if (typeof raw === 'string' && raw.trim()) {
      return { value: raw.trim(), isFallback: loc !== lang, source: loc };
    }
  }
  let root = '';
  if (field === 'title') root = (track.title ?? '').trim();
  else if (field === 'content') root = (track.content ?? '').trim();
  else root = (track.authorship ?? '').trim();
  return {
    value: root,
    isFallback: root.length > 0,
    source: 'root',
  };
}

export type ResolvedTrackEditSyncedLyrics = {
  lines: TracksProps['syncedLyrics'];
  isFallback: boolean;
  source: AlbumEditFieldSource;
};

export function getTrackSyncedLyricsForEdit(
  track: TracksProps,
  lang: SupportedLang
): ResolvedTrackEditSyncedLyrics {
  const chain = buildTranslationFallbackLocales(
    lang,
    DEFAULT_CONTENT_LOCALE,
    TRANSLATION_LOCALE_ORDER
  );
  for (const loc of chain) {
    const lines = track.translations?.[loc]?.syncedLyrics;
    if (hasSyncedLyricsData(lines)) {
      return { lines, isFallback: loc !== lang, source: loc };
    }
  }
  const root = track.syncedLyrics;
  const hasRoot = hasSyncedLyricsData(root);
  return {
    lines: root,
    isFallback: hasRoot,
    source: 'root',
  };
}

/** Fallback для обложечных строк: сначала translations, иначе корень (legacy / канон). */
export function resolveAlbumStringField(
  album: IAlbums,
  field: 'album' | 'fullName' | 'description',
  lang: SupportedLang
): string {
  if (field === 'album') {
    const root = (album.album ?? '').trim();
    if (root) return root;
    return (
      resolveTranslationString(
        {
          en: album.translations?.en?.album,
          ru: album.translations?.ru?.album,
        },
        lang
      ) || ''
    );
  }
  const fromTranslations = resolveTranslationString(albumTranslationStrings(album, field), lang);
  if (fromTranslations) return fromTranslations;
  if (field === 'fullName') return album.fullName ?? '';
  return album.description ?? '';
}

function pickTrackSyncedLyricsForDisplay(
  track: TracksProps,
  lang: SupportedLang
): TracksProps['syncedLyrics'] {
  const chain = buildTranslationFallbackLocales(
    lang,
    DEFAULT_CONTENT_LOCALE,
    TRANSLATION_LOCALE_ORDER
  );
  for (const loc of chain) {
    const lines = track.translations?.[loc]?.syncedLyrics;
    if (hasSyncedLyricsData(lines)) return lines;
  }
  return track.syncedLyrics;
}

export function resolveTrackForDisplay(track: TracksProps, lang: SupportedLang): TracksProps {
  const title = resolveTranslationString(
    {
      en: track.translations?.en?.title,
      ru: track.translations?.ru?.title,
    },
    lang
  );
  const content = resolveTranslationString(
    {
      en: track.translations?.en?.content,
      ru: track.translations?.ru?.content,
    },
    lang
  );
  const authorship = resolveTranslationString(
    {
      en: track.translations?.en?.authorship,
      ru: track.translations?.ru?.authorship,
    },
    lang
  );

  const resolvedTitle = !isTranslationValueMissing(title) ? title : track.title;
  const resolvedContent = !isTranslationValueMissing(content) ? content : track.content;
  const resolvedAuthorship = !isTranslationValueMissing(authorship)
    ? authorship
    : (track.authorship ?? '');

  return {
    ...track,
    title: resolvedTitle,
    content: resolvedContent,
    authorship: resolvedAuthorship || undefined,
    syncedLyrics: pickTrackSyncedLyricsForDisplay(track, lang),
  };
}

function resolveAlbumDetailsForDisplay(album: IAlbums, lang: SupportedLang): detailsProps[] {
  const chain = buildTranslationFallbackLocales(
    lang,
    DEFAULT_CONTENT_LOCALE,
    TRANSLATION_LOCALE_ORDER
  );
  for (const loc of chain) {
    const d = album.translations?.[loc]?.details;
    if (Array.isArray(d) && d.length > 0) return d;
  }
  return Array.isArray(album.details) ? album.details : [];
}

/**
 * Плоский снимок альбома для отображения (новый объект, `translations` не меняется).
 */
export function resolveAlbumForDisplay(album: IAlbums, lang: SupportedLang): IAlbums {
  const albumTitle = resolveAlbumStringField(album, 'album', lang);
  const fullNameRaw = resolveAlbumStringField(album, 'fullName', lang);
  const fullName =
    fullNameRaw ||
    `${album.artist || ''}${album.artist && albumTitle ? ' — ' : ''}${albumTitle}`.trim();

  const tracks = (album.tracks ?? []).map((t) => resolveTrackForDisplay(t, lang));

  const rawDetails = resolveAlbumDetailsForDisplay(album, lang);
  const details = injectGenreDetailIfNeeded(rawDetails, album, lang);

  return {
    ...album,
    album: albumTitle,
    fullName,
    description: resolveAlbumStringField(album, 'description', lang),
    details,
    tracks,
  };
}
