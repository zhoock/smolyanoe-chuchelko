export type NavigationProps = {
  /** Принимает классы css */
  classes?: {
    hide: "hide-for-medium-down" | "hide-for-large-up";
  };
  /**  Открывает/закрывает popup */
  onShow?: any;
};

export type HamburgerProps = NavigationProps & {
  isActive: boolean;
  zIndex?: number | string;
};

export type PopupProps = HamburgerProps & {
  children: React.ReactElement;
};

export type AlbumsProps<Size extends number = 896> = {
  /** Название альбома */
  nameAlbum: string;
  fullName?: string;
  showAlbum?: boolean;
  /** Функция берёт название альбома из тега h3 и меняет значение showAlbum на противоположное */
  handleCoverClick?: any;
  children?: React.ReactElement;
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
  duration: number;
};
