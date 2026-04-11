/**
 * Обогащение ответа API: если нет translations.ru, копируем с плоских полей (legacy).
 */

import type { ArticledetailsProps, IArticleTranslationsLocale, IArticles } from '@models';

function cloneDetails(details: unknown[]): IArticleTranslationsLocale['details'] {
  if (!Array.isArray(details)) return [];
  try {
    return JSON.parse(JSON.stringify(details)) as ArticledetailsProps[];
  } catch {
    return [];
  }
}

/** Дополняет translations.ru, если слот ru отсутствует. */
export function hydrateMissingRuTranslationsOnArticle<T extends IArticles>(article: T): T {
  if (article.translations?.ru) return article;

  const ru: IArticleTranslationsLocale = {
    nameArticle: article.nameArticle ?? '',
    description: article.description ?? '',
    details: cloneDetails(article.details ?? []),
  };

  return {
    ...article,
    translations: { ...article.translations, ru },
  };
}
