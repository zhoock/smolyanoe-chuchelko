/**
 * Плоский снимок статьи для отображения (новый объект, `translations` не меняется).
 */

import type { SupportedLang } from '@shared/model/lang';
import type { IArticles } from '@models';
import {
  buildTranslationFallbackLocales,
  DEFAULT_CONTENT_LOCALE,
  resolveTranslationString,
  TRANSLATION_LOCALE_ORDER,
} from '@shared/lib/i18n/resolveTranslationFallback';

function articleTranslationStrings(
  article: IArticles,
  field: 'nameArticle' | 'description'
): Partial<Record<SupportedLang, string | null | undefined>> {
  return {
    en: article.translations?.en?.[field],
    ru: article.translations?.ru?.[field],
  };
}

function resolveArticleDetailsForDisplay(article: IArticles, lang: SupportedLang) {
  const chain = buildTranslationFallbackLocales(
    lang,
    DEFAULT_CONTENT_LOCALE,
    TRANSLATION_LOCALE_ORDER
  );
  for (const loc of chain) {
    const d = article.translations?.[loc]?.details;
    if (Array.isArray(d) && d.length > 0) return d;
  }
  return Array.isArray(article.details) ? article.details : [];
}

export function resolveArticleForDisplay(article: IArticles, lang: SupportedLang): IArticles {
  const nameArticle =
    resolveTranslationString(articleTranslationStrings(article, 'nameArticle'), lang) ||
    article.nameArticle ||
    '';
  const description =
    resolveTranslationString(articleTranslationStrings(article, 'description'), lang) ||
    article.description ||
    '';
  const details = resolveArticleDetailsForDisplay(article, lang);

  return {
    ...article,
    nameArticle,
    description,
    details,
  };
}
