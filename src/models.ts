// Using interfaces with extends can often be more performant for the compiler
// than type aliases with intersections

export interface NavigationProps {
  /** Принимает классы CSS */
  classes?: {
    hide: "hide-for-medium-down" | "hide-for-large-up"; // union literal type
  };
  /**  Открывает/закрывает Popup */
  onToggle?: (e: React.MouseEvent<HTMLElement>) => void;
}

export interface HamburgerProps extends NavigationProps {
  /** Отвечает за состояние Popup (открыт/закрыт) */
  isActive: boolean;
  /** CSS свойство */
  zIndex?: string;
}

export interface PopupProps extends HamburgerProps {
  children: React.ReactNode;
}

/**
 * Albums
 */

export interface IAlbums {
  /** Идентификатор альбома */
  albumId?: string;
  /** Название группы */
  nameGroup: string;
  /** Название альбома */
  nameAlbum: string;
  /** Название группы и название альбома */
  fullName: string;
  /** Обложка альбома */
  cover: CoverProps;
  /** Релиз альбома */
  release: {
    [key: string]: string;
  };
  /** URL музыкальных агрегаторов */
  buttons: {
    [key: string]: string;
  };
  /** Дополнительная информация */
  detales: DetalesProps[];
  /** Треки */
  tracks: TracksProps[];
}

export interface WrapperAlbumCoverProps {
  /** Идентификатор альбома */
  albumId?: string;
  /** Название группы и название альбома */
  fullName: string;
  children: React.ReactElement;
  /** Год релиза альбома */
  date: string;
}

export interface DetalesProps {
  id: number;
  title: string;
  content: string[];
}

export interface TracksProps {
  /** Идентификатор песни */
  id: number;
  /** Название песни */
  title: string;
  /** Текст песни */
  content: string;
  /** Общая продолжительность всех треков в альбоме */
  duration: number;
}

export interface CoverProps<Size extends number = 896> {
  webp: string;
  webp2x: string;
  jpg: string;
  jpg2x: string;
  img: string;
  albumId?: string;
  size?: Size;
}

export interface String {
  [key: string]: string;
}

/**
 * Articles
 */

export type IArticles = {
  articleId: string;
  nameArticle: string;
  date: string;
  img: string;
  detales: ArticleDetalesProps[];
};

export interface ArticleDetalesProps {
  id: number;
  title?: string;
  img?: string;
  subtitle?: string;
  content?: string | string[]; // union type
}

export interface ArticleProps {
  articleId: string;
  img: string;
  nameArticle: string;
  date: string;
}
