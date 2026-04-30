// Using interfaces with extends can often be more performant for the compiler
// than type aliases with intersections

import type { Track } from '@entities/track/model/types';
import type { SupportedLang } from '@shared/model/lang';

export interface NavigationProps {
  /**  Открывает/закрывает Popup */
  onToggle?: (e: React.MouseEvent<HTMLElement>) => void;
}

export interface HamburgerProps extends NavigationProps {
  /** Отвечает за состояние Popup (открыт/закрыт) */
  isActive: boolean;
  /**
   * `floating` — фиксация поверх страницы (плеер, модальные диалоги).
   * `inline` — как обычный элемент в строке шапки (мобильное меню).
   */
  variant?: 'floating' | 'inline';
  /** CSS свойство */
  zIndex?: string;
  bgColor?: string;
  onClose?: () => void; // Новый пропс
  className?: string;
  /**
   * Инлайн-гамбургер в шапке: при открытом `dialog.showModal()` шапка оказывается под top layer —
   * включают «призрак-кнопку» (слот занят, но клики и экран недоступны); рабочая кнопка дублируется внутри `<dialog>`.
   */
  behindDialogOverlap?: boolean;
}

export interface PopupProps extends HamburgerProps {
  children: React.ReactNode;
  'aria-labelledby'?: string;
  /** Блокирует закрытие по Escape (событие cancel у нативного dialog). */
  closeBlocked?: boolean;
}

/**
 * Albums
 */

/** Переводимые поля альбома (`translations.ru` / `translations.en`). Название альбома — только на корне `IAlbums.album`. */
export interface IAlbumTranslationsLocale {
  /** @deprecated Старые ответы API; не записывать. */
  album?: string;
  fullName: string;
  description: string;
  details: detailsProps[];
  /** Кредиты обложки — только для этой локали (не в общем `release`). */
  photographer?: string;
  photographerURL?: string;
  designer?: string;
  designerURL?: string;
}

export type IAlbumTranslations = Partial<Record<SupportedLang, IAlbumTranslationsLocale>>;

export interface IAlbums {
  userId?: string;
  /** Первичный ключ `albums.id` (UUID), если пришёл из API — для ЮKassa и create-payment. */
  dbAlbumId?: string;
  /** Идентификатор альбома */
  albumId?: string;
  /**
   * Устарело: не записывается при создании/обновлении альбома. Имя для UI — `users.site_name`.
   * Поле может приходить из БД для старых записей.
   */
  artist: string;
  /**
   * Название альбома — одно на альбом (все языки). Запись на корне API/БД, не в translations.
   */
  album: string;
  /** Полное имя для отображения; запись — в `translations[lang].fullName`. */
  fullName: string;
  /** Описание; запись — в `translations[lang].description`. */
  description: string;
  /** Обложка альбома (имя файла без расширения и суффикса размера) */
  cover?: string;

  /** Видимость страницы альбома (одно значение на альбом; синхронизируется по всем lang в БД). */
  isPublic?: boolean;

  /** Релиз альбома (единый JSON на альбом: дата, UPC, продажи, `genreCodes`, `tags` и т.д.) */
  release: Record<string, unknown>;
  /** URL музыкальных агрегаторов */
  buttons: {
    [key: string]: string;
  };
  /** Дополнительная информация; каноническая запись блоков — в `translations[lang].details`. */
  details: detailsProps[];
  /**
   * Переводы альбома. Создание/обновление через API — только в `translations[lang]`.
   * Плоские поля на корне — ответ БД и временный fallback для старых данных.
   */
  translations?: IAlbumTranslations;
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

/** Переводимые поля трека внутри альбома (текст песни и синхронизация — на корне трека). */
export interface IAlbumTrackTranslationsLocale {
  title: string;
  /** @deprecated legacy; текст единый в `track.content` */
  content?: string;
  authorship?: string;
  /** @deprecated legacy; синхронизация в `track.syncedLyrics` */
  syncedLyrics?: SyncedLyricsLine[];
}

export type IAlbumTrackTranslations = Partial<Record<SupportedLang, IAlbumTrackTranslationsLocale>>;

/** Трек в составе альбома: базовые поля сущности `Track` плюс тексты и метаданные воспроизведения. */
export interface TracksProps extends Track {
  /** Единый текст песни (не зависит от языка UI). */
  content: string;
  /** Синхронизированный текст с тайм-кодами (для karaoke-style отображения) */
  syncedLyrics?: SyncedLyricsLine[];
  /** Текст авторства (автоматически добавляется в конец синхронизированных текстов) */
  authorship?: string;
  /** Длительность трека в секундах */
  duration: number;
  /** Переводы названия и текстов трека (`translations.ru` / `translations.en`). */
  translations?: IAlbumTrackTranslations;
}

export interface CoverProps {
  img: string;
  userId?: string;
  fullName: string;
  size?: number;
  densities?: Array<1 | 2 | 3>;
  sizes?: string;
}

export interface String {
  [key: string]: string;
}

/** Переводимые поля статьи (`translations.ru` / `translations.en`). */
export interface IArticleTranslationsLocale {
  nameArticle: string;
  description: string;
  details: ArticledetailsProps[];
}

export type IArticleTranslations = Partial<Record<SupportedLang, IArticleTranslationsLocale>>;

export type IArticles = {
  id?: string; // UUID из БД (опционально для обратной совместимости)
  userId?: string;
  articleId: string; // строковый идентификатор (article_id)
  /** Заголовок для UI; каноническая запись — в `translations[lang].nameArticle`. */
  nameArticle: string;
  img: string;
  date: string;
  details: ArticledetailsProps[];
  description: string;
  isDraft?: boolean; // Статус черновика (опционально для обратной совместимости)
  /**
   * Переводы статьи. Создание/обновление через API — только в `translations[lang]`.
   * Плоские поля на корне — ответ БД и временный fallback для старых данных.
   */
  translations?: IArticleTranslations;
  /** Внутренняя метка для merge по свежести строки (ответ API). */
  updatedAt?: string;
  /** Язык строки в одноязычном ответе (POST и т.д.). */
  lang?: string;
};

export interface ArticledetailsProps {
  id?: number; // опционально, может отсутствовать в новой структуре
  userId?: string;
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
  userId?: string;
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
  /** Кнопка входа/регистрации в шапке; ссылка в кабинет по аватару */
  header?: {
    signIn: string;
    openProfile: string;
    avatarMenu?: {
      settings: string;
      upgradePlan: string;
      logOut: string;
    };
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
      myPurchases?: string;
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
    /** Прогресс загрузки треков в альбом (перед процентом). */
    uploadingTracks: string;
    lyrics: string;
    track: string;
    status: string;
    actions: string;
    addedSynced: string;
    addedNoSync: string;
    noLyrics: string;
    edit: string;
    sync: string;
    /** Заголовок модалки синхронизации текста с аудио */
    syncLyricsTitle?: string;
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
    /** Пояснение в модалке подтверждения удаления и др. необратимых действий */
    confirmActionIrreversible?: string;
    /** Текст кнопки подтверждения для info / warning в модалке подтверждения */
    confirmationModalConfirm?: string;
    /** Текст кнопки подтверждения для необратимого (danger) действия — обычно «Удалить» */
    confirmationModalConfirmDelete?: string;
    error: string;
    success?: string;
    /** Префикс сообщения «загружено N трек(ов)»; слово «трек» подставляется в коде с учётом числа. */
    uploadedTracksSuccessPrefix?: string;
    errorDeletingArticle: string;
    russian: string;
    english: string;
    dragToReorder?: string;
    clickToEdit?: string;
    editTrack?: string;
    trackTitle?: string;
    deleteTrack?: string;
    deleteAlbum?: string;
    errorLoading?: string;
    failedToLoadAlbums?: string;
    selectLanguage?: string;
    changeAvatar?: string;
    /** Кнопка у аватара: «Edit» */
    avatarEdit?: string;
    /** Меню аватара: загрузка */
    uploadAvatarPhoto?: string;
    /** Меню аватара: удаление */
    removeAvatarPhoto?: string;
    /** Файл аватара больше лимита (2 MB) */
    avatarFileTooLarge?: string;
    errorSavingText?: string;
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
    myPurchases?: {
      title: string;
      purchasesFor: string;
      changeEmail: string;
      enterEmailDescription: string;
      emailAddress: string;
      viewPurchases: string;
      loadingPurchases: string;
      purchasesNotFound: string;
      checkEmail: string;
      purchased: string;
      downloads: string;
      downloadAlbum: string;
      downloading: string;
      downloaded: string;
      download: string;
      tracks: string;
      downloadTrack: string;
      downloadFullAlbum: string;
      errorDownloadingTrack: string;
      errorDownloadingAlbum: string;
    };
    profileSettingsModal?: {
      tabs: {
        general: string;
        profile: string;
        security: string;
      };
      fields: {
        bandName: string;
        primaryGenre: string;
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
        primaryGenreCatalog: string;
        publicSlug: string;
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
        albumVisibility: string;
        albumVisibleCheckbox: string;
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
        genre: string;
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
      /** Подтверждение выхода из режима редактирования строки списка без сохранения */
      discardInlineEdit?: {
        message?: string;
        stay?: string;
        discard?: string;
      };
      /** Переход к редактированию другой строки при несохранённом черновике */
      switchEditConfirm?: {
        message?: string;
        stay?: string;
        discard?: string;
      };
      /** Блок продажи альбома (ЮKassa и т.п.) */
      albumSale?: {
        loadingPayment: string;
        sectionTitle: string;
        connectPaymentHint: string;
        connectPaymentButton: string;
        saleIntro: string;
        saleRadiogroupAriaLabel: string;
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
