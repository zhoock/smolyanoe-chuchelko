import type { RootState } from '@shared/model/appStore/types';
import type { SupportedLang } from '@shared/model/lang';
import type { HelpArticleId } from './types';

export const selectHelpArticlesStatus = (state: RootState, lang: SupportedLang) =>
  state.helpArticles[lang].status;

export const selectHelpArticlesError = (state: RootState, lang: SupportedLang) =>
  state.helpArticles[lang].error;

export const selectHelpArticlesData = (state: RootState, lang: SupportedLang) =>
  state.helpArticles[lang].data;

export const selectHelpArticleById = (
  state: RootState,
  lang: SupportedLang,
  articleId: HelpArticleId
) => {
  const articles = state.helpArticles[lang].data;
  return articles.find((article) => article.articleId === articleId) || null;
};
