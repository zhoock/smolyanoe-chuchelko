export type NavigationProps = {
  /** Принимает классы css */
  classes?: {
    hide: "hide-for-medium-down" | "hide-for-large-up";
  };
  /**  Открывает/закрывает popup */
  onToggle?: (e: React.MouseEvent<HTMLElement>) => void;
};

export type HamburgerProps = NavigationProps & {
  isActive: boolean;
  zIndex?: number | string;
};

export type PopupProps = HamburgerProps & {
  children: React.ReactNode;
};

export type AlbumsProps<Size extends number = 896> = {
  album?: [];
  albumId?: string;
  /** Название альбома */
  nameAlbum?: any;
  /** Название группы и название альбома */
  fullName?: string;
  showAlbum?: boolean;
  /** Функция берёт название альбома из тега h3 и меняет значение showAlbum на противоположное */
  handleCoverClick?: (e: React.MouseEvent<HTMLElement>) => void;
  children?: React.ReactElement;
  /** Год релиза альбома */
  year?: string;
  // Размер изображения по умолчанию.
  size?: Size;
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
  cover: [
    {
      [key: string]: string;
    },
  ];
  release: [
    {
      id: number;
      date: string;
      UPC: string;
      design: string;
      designer: string;
      designerURL: string;
      photographer: string;
      photographerURL: string;
    },
  ];
  buttons: [
    {
      [key: string]: string;
    },
  ];
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
