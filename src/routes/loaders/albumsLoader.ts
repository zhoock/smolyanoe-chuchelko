// src/routes/loaders/albumsLoader.ts
import type { LoaderFunctionArgs } from 'react-router';
import type { IAlbums, IArticles, IInterface } from '@models';
import { getStore } from '@shared/model/appStore';
import { setPublicArtistSlug } from '@shared/model/currentArtist';
import { selectCurrentLang } from '@shared/model/lang';
import {
  fetchArticles,
  selectArticlesState,
  selectArticlesStatus,
  selectArticlesData,
} from '@entities/article';
import {
  fetchAlbums,
  selectAlbumsStatus,
  selectAlbumsData,
  selectAlbumsFetchContextKey,
} from '@entities/album';
import {
  fetchHelpArticles,
  selectHelpArticlesStatus,
  selectHelpArticlesData,
} from '@entities/helpArticle';
import {
  fetchUiDictionary,
  selectUiDictionaryStatus,
  selectUiDictionaryData,
} from '@shared/model/uiDictionary';
import { resolveDashboardModalBackgroundForLoader } from '@shared/lib/dashboardModalBackground';

/**
 * createAsyncThunk: при `condition` → false unwrap() отклоняет plain object
 * `{ name: 'ConditionError' }`, не Error — иначе получаем unhandledrejection «[object Object]».
 */
function isAbortLikeOrConditionSkipError(error: unknown): boolean {
  if (error === 'AbortError' || error === 'Aborted') return true;
  if (typeof error !== 'object' || error === null || !('name' in error)) return false;
  const name = (error as { name?: string }).name;
  return name === 'AbortError' || name === 'ConditionError';
}

export type AlbumsDeferred = {
  templateA: Promise<IAlbums[]>; // альбомы
  templateB: Promise<IArticles[]>; // статьи
  templateC: Promise<IInterface[]>; // UI-словарь – грузим ВСЕГДА
  templateD: Promise<IArticles[]>; // статьи помощи
  lang: string;
};

export async function albumsLoader({ request }: LoaderFunctionArgs): Promise<AlbumsDeferred> {
  const { signal, url } = request;
  const requestUrl = new URL(url);
  const { pathname } = requestUrl;
  const requestIsDashboard = pathname.startsWith('/dashboard');
  const { pathname: loaderPathname, search: loaderSearch } =
    resolveDashboardModalBackgroundForLoader(pathname, requestUrl.search);
  const loaderSearchParams = new URLSearchParams(
    loaderSearch.startsWith('?') ? loaderSearch.slice(1) : loaderSearch
  );
  const store = getStore();
  const publicArtistFromUrl = loaderSearchParams.get('artist')?.trim() ?? '';
  store.dispatch(setPublicArtistSlug(publicArtistFromUrl || null));
  const state = store.getState();
  const lang = selectCurrentLang(state);

  // СЛОВАРЬ НУЖЕН ВЕЗДЕ: шапка, меню, футер, aboutus и т.д.
  let templateC: Promise<IInterface[]>;
  const uiStatus = selectUiDictionaryStatus(state, lang);
  if (uiStatus === 'succeeded') {
    templateC = Promise.resolve(selectUiDictionaryData(state, lang));
  } else if (uiStatus === 'loading') {
    // Данные уже загружаются - возвращаем текущие данные или пустой массив
    // Это предотвращает зацикливание, когда loader вызывается повторно во время загрузки
    const currentData = selectUiDictionaryData(state, lang);
    templateC = Promise.resolve(currentData || []);
  } else {
    const fetchThunkPromise = store.dispatch(fetchUiDictionary({ lang }));

    const createNeverResolvingPromise = () => new Promise<IInterface[]>(() => {});

    if (signal.aborted) {
      fetchThunkPromise.abort();
      templateC = createNeverResolvingPromise();
    } else {
      const abortHandler = () => {
        fetchThunkPromise.abort();
      };
      signal.addEventListener('abort', abortHandler, { once: true });

      templateC = fetchThunkPromise.unwrap().catch((error) => {
        if (isAbortLikeOrConditionSkipError(error)) {
          return createNeverResolvingPromise();
        }
        throw error;
      });
    }
  }

  // По умолчанию — пустые промисы, чтобы типы были стабильными
  let templateA: Promise<IAlbums[]> = Promise.resolve([]);
  let templateB: Promise<IArticles[]> = Promise.resolve([]);
  let templateD: Promise<IArticles[]> = Promise.resolve([]); // help articles

  // Альбомы нужны на "/", "/albums*", "/stems" (миксер) и "/dashboard*" (включая /dashboard-new)
  if (
    requestIsDashboard ||
    loaderPathname === '/' ||
    loaderPathname.startsWith('/albums') ||
    loaderPathname.startsWith('/stems')
  ) {
    const desiredAlbumsFetchKey = requestIsDashboard
      ? 'dashboard'
      : publicArtistFromUrl
        ? `public:${publicArtistFromUrl}`
        : 'public:no-slug';

    const status = selectAlbumsStatus(state);
    const albumsFetchContextKey = selectAlbumsFetchContextKey(state);
    const albumsCacheValid =
      status === 'succeeded' && albumsFetchContextKey === desiredAlbumsFetchKey;

    if (albumsCacheValid) {
      templateA = Promise.resolve(selectAlbumsData(state));
    } else if (status === 'loading') {
      // Данные уже загружаются - возвращаем текущие данные или пустой массив
      // Это предотвращает зацикливание, когда loader вызывается повторно во время загрузки
      const currentData = selectAlbumsData(state);
      templateA = Promise.resolve(currentData || []);
    } else {
      const fetchThunkPromise = store.dispatch(
        fetchAlbums({ force: status === 'succeeded' || status === 'failed' })
      );

      const createNeverResolvingPromise = () => new Promise<IAlbums[]>(() => {});

      if (signal.aborted) {
        fetchThunkPromise.abort();
        templateA = createNeverResolvingPromise();
      } else {
        const abortHandler = () => {
          fetchThunkPromise.abort();
        };
        signal.addEventListener('abort', abortHandler, { once: true });

        templateA = fetchThunkPromise
          .unwrap()
          .then((p) => p.albums)
          .catch((error) => {
            if (isAbortLikeOrConditionSkipError(error)) {
              return createNeverResolvingPromise();
            }
            throw error;
          });
      }
    }
  }

  // Статьи нужны на "/" (главная) и "/articles*"
  if (loaderPathname === '/' || loaderPathname.startsWith('/articles')) {
    const publicArtistSlug = publicArtistFromUrl;
    const articlesState = selectArticlesState(state);
    const status = articlesState.status;
    // На дашборде кэш «по ?artist= с фона» невалиден: `lastPublicArtistSlug: null` = список владельца.
    const cacheOk = requestIsDashboard
      ? status === 'succeeded' && articlesState.lastPublicArtistSlug == null
      : status === 'succeeded' && (articlesState.lastPublicArtistSlug ?? '') === publicArtistSlug;

    if (cacheOk) {
      templateB = Promise.resolve(selectArticlesData(state));
    } else {
      const fetchThunkPromise = store.dispatch(
        fetchArticles({
          force: status === 'loading',
          publicArtistSlug,
        })
      );

      const createNeverResolvingPromise = () => new Promise<IArticles[]>(() => {});

      if (signal.aborted) {
        fetchThunkPromise.abort();
        templateB = createNeverResolvingPromise();
      } else {
        const abortHandler = () => {
          fetchThunkPromise.abort();
        };
        signal.addEventListener('abort', abortHandler, { once: true });

        templateB = fetchThunkPromise
          .unwrap()
          .then((r) => r.articles)
          .catch((error) => {
            if (isAbortLikeOrConditionSkipError(error)) {
              return createNeverResolvingPromise();
            }
            throw error;
          });
      }
    }
  }

  // Статьи помощи нужны на "/help/articles*"
  if (loaderPathname.startsWith('/help/articles')) {
    const status = selectHelpArticlesStatus(state, lang);
    if (status === 'succeeded') {
      templateD = Promise.resolve(selectHelpArticlesData(state, lang));
    } else if (status === 'loading') {
      // Данные уже загружаются - возвращаем текущие данные или пустой массив
      // Это предотвращает зацикливание, когда loader вызывается повторно во время загрузки
      const currentData = selectHelpArticlesData(state, lang);
      templateD = Promise.resolve(currentData || []);
    } else {
      const fetchThunkPromise = store.dispatch(fetchHelpArticles({ lang }));

      const createNeverResolvingPromise = () => new Promise<IArticles[]>(() => {});

      if (signal.aborted) {
        fetchThunkPromise.abort();
        templateD = createNeverResolvingPromise();
      } else {
        const abortHandler = () => {
          fetchThunkPromise.abort();
        };
        signal.addEventListener('abort', abortHandler, { once: true });

        templateD = fetchThunkPromise.unwrap().catch((error) => {
          if (isAbortLikeOrConditionSkipError(error)) {
            return createNeverResolvingPromise();
          }
          throw error;
        });
      }
    }
  }

  return { templateA, templateB, templateC, templateD, lang };
}
