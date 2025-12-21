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
  className?: string;
}

export interface PopupProps extends HamburgerProps {
  children: React.ReactNode;
  'aria-labelledby'?: string;
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
  /** Обложка альбома (имя файла без расширения и суффикса размера) */
  cover?: string;

  /** Релиз альбома */
  release: {
    [key: string]: string;
  };
  /** URL музыкальных агрегаторов */
  buttons: {
    [key: string]: string;
  };
  /** Дополнительная информация */
  details: detailsProps[];
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

export interface detailsProps {
  id: number;
  title: string;
  content: Array<string | { text: string[]; link: string }>;
}

/**
 * Интерфейс для синхронизированной строки текста с тайм-кодами.
 * Используется для karaoke-style отображения текста песни.
 */
export interface SyncedLyricsLine {
  /** Текст строки (или слова, если синхронизация по словам) */
  text: string;
  /** Время начала строки в секундах */
  startTime: number;
  /** Время окончания строки в секундах (опционально) */
  endTime?: number;
}

export interface TracksProps {
  /** Идентификатор песни */
  id: number;
  /** Название песни */
  title: string;
  /** Текст песни (обычный формат, для обратной совместимости) */
  content: string;
  /** Синхронизированный текст с тайм-кодами (для karaoke-style отображения) */
  syncedLyrics?: SyncedLyricsLine[];
  /** Текст авторства (автоматически добавляется в конец синхронизированных текстов) */
  authorship?: string;
  /** Общая продолжительность всех треков в альбоме */
  duration: number;
  /** Путь к треку */
  src: string;
}

export interface CoverProps {
  img: string;
  fullName: string;
  size?: number;
  densities?: Array<1 | 2 | 3>;
  sizes?: string;
}

export interface String {
  [key: string]: string;
}

export type IArticles = {
  articleId: string;
  nameArticle: string;
  img: string;
  date: string;
  details: ArticledetailsProps[];
  description: string;
};

export interface ArticledetailsProps {
  id: number;
  title?: string;
  img?: string | string[]; // single image or array for carousel
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
  links?: {
    [key: string]: string;
  };
  theBand: Array<string | { text: string[]; link: string }>;
  stems?: {
    text: string;
    pageTitle: string;
    notice: string;
  };
  errors?: {
    [key: string]: string;
  };
  dashboard?: {
    title: string;
    tabs: {
      albums: string;
      posts: string;
      paymentSettings: string;
    };
    profile: string;
    logout: string;
    profileFields: {
      name: string;
      username: string;
      email: string;
      location: string;
    };
    uploadNewAlbum: string;
    editAlbum: string;
    writeAndPublishArticles: string;
    newPost: string;
    dropTracksHere: string;
    chooseFiles: string;
    lyrics: string;
    track: string;
    status: string;
    actions: string;
    addedSynced: string;
    addedNoSync: string;
    noLyrics: string;
    edit: string;
    sync: string;
    add: string;
    prev: string;
    addLyrics: string;
    editLyrics: string;
    insertLyricsHere: string;
    cancel: string;
    save: string;
    preview: string;
    previewLyrics: string;
    close: string;
    instrumental: string;
    editAlbumModal?: {
      stepTitles: {
        step1: string;
        step2: string;
        step3: string;
        step4: string;
        step5: string;
      };
      fieldLabels: {
        artistGroupName: string;
        albumTitle: string;
        releaseDate: string;
        upcEan: string;
        albumArt: string;
        description: string;
        visibleOnAlbumPage: string;
        allowDownloadSale: string;
        regularPrice: string;
        preorderReleaseDate: string;
      };
      placeholders: {
        upcEan: string;
        releaseDate: string;
        preorderDate: string;
        description: string;
        dragImageHere: string;
        chooseFile: string;
      };
      buttons: {
        replace: string;
        next: string;
        previous: string;
        saveChanges: string;
        publishAlbum: string;
        saving: string;
        add: string;
      };
      status: {
        uploading: string;
        uploaded: string;
        publishedCover: string;
        error: string;
      };
      helpText: {
        controlDownloadSale: string;
        fansCanBuyNow: string;
      };
      radioOptions: {
        no: string;
        yes: string;
        acceptPreorders: string;
      };
      step3?: {
        recordedAt: string;
        mixedAt: string;
        masteredBy: string;
        addButton: string;
      };
      step4?: {
        albumCover: string;
        bandMembers: string;
        sessionMusicians: string;
        producer: string;
        addButton: string;
        photographer: string;
        photographerUrl: string;
        designer: string;
        designerUrl: string;
        name: string;
        role: string;
        urlOptional: string;
      };
      step5?: {
        purchase: string;
        streaming: string;
        selectService: string;
        url: string;
        save: string;
        cancel: string;
      };
    };
  };
}

export interface Tracks {
  id: number;
  title: string;
  artist: string;
  src: string;
  cover: string;
}
