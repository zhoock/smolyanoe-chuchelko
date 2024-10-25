// Using interfaces with extends can often be more performant for the compiler
// than type aliases with intersections

export interface NavigationProps {
  /** Принимает классы CSS */
  classes?: {
    hide: "hide-for-medium-down" | "hide-for-large-up";
  };
  /**  Открывает/закрывает Popup */
  onToggle?: (e: React.MouseEvent<HTMLElement>) => void;
}

export interface HamburgerProps extends NavigationProps {
  /** Отвечает за состояние Popup (открыт/закрыт) */
  isActive: true | false;
  /** CSS свойство */
  zIndex?: string;
}

export interface PopupProps extends HamburgerProps {
  children: React.ReactNode;
}

export type AlbumsCoverProps = {
  /** Идентификатор альбома */
  albumId: string;
  /** Название группы и название альбома */
  fullName: string;
  // showAlbum?: boolean;
  children: React.ReactElement;
  /** Год релиза альбома */
  year: string;
};

export type String = {
  [key: string]: string;
};

export type TracksProps = {
  id: number;
  /** Название песни */
  title: string;
  /** Текст песни */
  content: string;
  /** Общая продолжительность всех треков в альбоме */
  duration: number;
};

export type ReleaseProps = {
  id: number;
  date: string;
  UPC: string;
  design: string;
  designer: string;
  designerURL: string;
  photographer: string;
  photographerURL: string;
};

export type DetalesProps = {
  id: number;
  title: string;
  content: string[];
};

export type IProduct = {
  albumId: string;
  nameGroup: string;
  nameAlbum: string;
  fullName: string;
  cover: {
    [key: string]: string;
  };
  release: {
    id: number;
    date: string;
    UPC: string;
    design: string;
    designer: string;
    designerURL: string;
    photographer: string;
    photographerURL: string;
  };

  buttons: {
    [key: string]: string;
  };

  detales: [];
  tracks: [];
};

export interface IArticle {
  articleId: string;
  nameArticle: string;
  img: string;
  date: string;
  detales: [img: string, subtitle: string, content: string];
}
