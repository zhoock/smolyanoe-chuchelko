// Using interfaces with extends can often be more performant for the compiler
// than type aliases with intersections

export interface NavigationProps {
  /**  Открывает/закрывает Popup */
  onToggle?: (e: React.MouseEvent<HTMLElement>) => void;
}

export interface HamburgerProps extends NavigationProps {
  /** Отвечает за состояние Popup (открыт/закрыт) */
  isActive: boolean;
  /** CSS свойство */
  zIndex?: string;
  bgColor?: string;
  onClose?: () => void; // Новый пропс
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
  artist: string;
  /** Название альбома */
  album: string;
  /** Название группы и название альбома */
  fullName: string;
  /** Описание альбома */
  description: string;
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
  album: string;
  children: React.ReactElement;
  /** Год релиза альбома */
  date: string;
}

export interface DetalesProps {
  id: number;
  title: string;
  content: Array<string | { text: string[]; link: string }>;
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
  /** Путь к треку */
  src: string;
}

export interface CoverProps {
  img: string;
  fullName: string;
  size?: number;
}

export interface String {
  [key: string]: string;
}

export type IArticles = {
  articleId: string;
  nameArticle: string;
  img: string;
  date: string;
  detales: ArticleDetalesProps[];
  description: string;
};

export interface ArticleDetalesProps {
  id: number;
  title?: string;
  img?: string;
  subtitle?: string;
  strong?: string;
  content?: string | string[]; // union type
  alt?: string;
}

export interface ArticleProps {
  articleId: string;
  img: string;
  nameArticle: string;
  date: string;
}

export interface IInterface {
  menu: {
    [key: string]: string;
  };
  buttons: {
    [key: string]: string;
  };
  titles: {
    [key: string]: string;
  };
  theBand: Array<string | { text: string[]; link: string }>;
}

export interface Tracks {
  id: number;
  title: string;
  artist: string;
  src: string;
  cover: string;
}
