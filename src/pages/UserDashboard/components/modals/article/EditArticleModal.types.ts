// src/pages/UserDashboard/components/EditArticleModal.types.ts
import type { IArticles, ArticledetailsProps } from '@models';
import type { SupportedLang } from '@shared/model/lang';

export interface EditArticleModalProps {
  isOpen: boolean;
  articleId?: string;
  onClose: () => void;
  onNext?: (data: ArticleFormData, updatedArticle?: IArticles) => void;
}

export interface ArticleBlockData {
  id: number;
  title?: string;
  subtitle?: string;
  strong?: string;
  content?: string | string[]; // string для параграфа, string[] для списка
  img?: string | string[]; // string для одного изображения, string[] для карусели
  alt?: string;
}

export interface ArticleFormData {
  articleId: string;
  nameArticle: string;
  description: string;
  img: File | null;
  imgPreview?: string; // URL для предпросмотра существующего изображения
  date: string; // YYYY-MM-DD
  lang: SupportedLang;
  details: ArticleBlockData[];
}
