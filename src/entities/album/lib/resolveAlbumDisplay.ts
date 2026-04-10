/**
 * Сборка отображаемого снимка альбома/трека для текущего языка UI без мутации `translations`.
 */

import type { SupportedLang } from '@shared/model/lang';
import type { IAlbums, TracksProps, detailsProps } from '@models';
import {
  buildTranslationFallbackLocales,
  DEFAULT_CONTENT_LOCALE,
  isTranslationValueMissing,
  resolveTranslationString,
  TRANSLATION_LOCALE_ORDER,
} from '@shared/lib/i18n/resolveTranslationFallback';

function hasSyncedLyricsData(lines: TracksProps['syncedLyrics']): boolean {
  return Array.isArray(lines) && lines.length > 0;
}

function albumTranslationStrings(
  album: IAlbums,
  field: 'album' | 'fullName' | 'description'
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
  if (field === 'album') root = (album.album ?? '').trim();
  else if (field === 'fullName') root = (album.fullName ?? '').trim();
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
  const chain = buildTranslationFallbackLocales(
    lang,
    DEFAULT_CONTENT_LOCALE,
    TRANSLATION_LOCALE_ORDER
  );
  for (const loc of chain) {
    const d = album.translations?.[loc]?.details;
    if (Array.isArray(d) && d.length > 0) {
      return { details: d, isFallback: loc !== lang, source: loc };
    }
  }
  const root = Array.isArray(album.details) ? album.details : [];
  return {
    details: root,
    isFallback: root.length > 0,
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
  const fromTranslations = resolveTranslationString(albumTranslationStrings(album, field), lang);
  if (fromTranslations) return fromTranslations;
  if (field === 'album') return album.album ?? '';
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

  return {
    ...album,
    album: albumTitle,
    fullName,
    description: resolveAlbumStringField(album, 'description', lang),
    details: resolveAlbumDetailsForDisplay(album, lang),
    tracks,
  };
}
