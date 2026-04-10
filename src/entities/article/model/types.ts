import type { IArticles } from '@models';
import type { SupportedLang } from '@shared/model/lang';

export type RequestStatus = 'idle' | 'loading' | 'succeeded' | 'failed';

export interface ArticlesEntry {
  status: RequestStatus;
  error: string | null;
  data: IArticles[];
  lastUpdated: number | null;
  /** Публичный контекст последней успешной загрузки: '' = дефолтный сайт, иначе public_slug */
  lastPublicArtistSlug?: string | null;
}

export type ArticlesState = Record<SupportedLang, ArticlesEntry>;
