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
  id?: string; // UUID из БД (опционально для обратной совместимости)
  articleId: string; // строковый идентификатор (article_id)
  nameArticle: string;
  img: string;
  date: string;
  details: ArticledetailsProps[];
  description: string;
  isDraft?: boolean; // Статус черновика (опционально для обратной совместимости)
};

export interface ArticledetailsProps {
  id?: number; // опционально, может отсутствовать в новой структуре
  type?: 'text' | 'image' | 'carousel'; // тип блока
  title?: string;
  img?: string; // для одиночного изображения
  images?: string[]; // для карусели (массив изображений)
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
    profileSettings: string;
    logout: string;
    profileFields: {
      name: string;
      username: string;
      email: string;
      location: string;
    };
    uploadNewAlbum: string;
    uploadNewArticle: string;
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
    authorship: string;
    authorshipPlaceholder: string;
    editArticles: string;
    newAlbum: string;
    chooseFile: string;
    articleCover: string;
    replace: string;
    uploaded: string;
    editArticle: string;
    deleteArticle: string;
    errorLoadingArticles: string;
    pleaseSelectImageFile: string;
    failedToUploadCover: string;
    confirmAction: string;
    error: string;
    errorDeletingArticle: string;
    russian: string;
    english: string;
    enterLink: string;
    addImage: string;
    addDivider: string;
    makeLink: string;
    heading1: string;
    heading2: string;
    heading3: string;
    heading4: string;
    paragraph: string;
    bold: string;
    italic: string;
    listItem: string;
    quote: string;
    startTyping: string;
    removeImage: string;
    articleId: string;
    articleTitle: string;
    enterArticleTitle: string;
    description: string;
    publicationDate: string;
    genre: string;
    bandMembers: string;
    sessionMusicians: string;
    producing: string;
    masteredBy: string;
    recordedAt: string;
    mixedAt: string;
    confirmDeleteArticle: string;
    errorNotAuthorized: string;
    errorArticleIdNotFound: string;
    uploadAndPublishAlbums: string;
    uploading: string;
    dragImageHereOr: string;
    loading?: string;
    saving?: string;
    profileSettingsModal?: {
      tabs: {
        profile: string;
        security: string;
        interface: string;
      };
      fields: {
        bandName: string;
        email: string;
        language: string;
        aboutBand: string;
        headerImages: string;
        currentPassword: string;
        newPassword: string;
        confirmPassword: string;
        zoom?: string;
      };
      placeholders: {
        bandName: string;
        aboutBand: string;
      };
      hints: {
        aboutBand: string;
        headerImages: string;
        coverImage: string;
      };
      buttons: {
        selectFiles: string;
        changePassword: string;
        uploadCover: string;
        preview: string;
        setCover: string;
      };
      messages: {
        passwordUpdated: string;
        interfaceInDevelopment: string;
        coverEditTitle: string;
        coverEditInstruction: string;
        coverPreviewInstruction?: string;
        coverUploaded: string;
        coverUploadError: string;
        mobileAreaVisible: string;
        desktopAreaVisible: string;
      };
      validation: {
        enterCurrentPassword: string;
        enterNewPassword: string;
        passwordMinLength: string;
        passwordDifferent: string;
        passwordsNotMatch: string;
        fillAllFields: string;
        maxImages: string;
        invalidFileType: string;
        fileTooLarge: string;
        imageTooSmall: string;
        uploadError: string;
        networkError?: string;
      };
    };
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
      step2?: {
        mood: string;
        tags: string;
        selectGenres: string;
        addTagPlaceholder: string;
        addTagButton: string;
        maxTagsReached: string;
        removeTag: string;
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
