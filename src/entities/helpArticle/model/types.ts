import type { IArticles } from '@models';

export type HelpArticleId = string;

export type HelpArticleEntry = {
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
  data: IArticles[];
  lastUpdated: number | null;
};

export type HelpArticlesState = {
  en: HelpArticleEntry;
  ru: HelpArticleEntry;
};
