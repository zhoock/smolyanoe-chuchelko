// src/routes/loaders/albumsLoader.ts
import type { LoaderFunctionArgs } from 'react-router';
import type { IAlbums, IArticles, IInterface } from '@models';
import { getJSON } from '@shared/api/http';
import { getStore } from '@shared/model/appStore';
import { selectCurrentLang } from '@shared/model/lang';
import { fetchArticles, selectArticlesStatus, selectArticlesData } from '@entities/article';
import { fetchAlbums, selectAlbumsStatus, selectAlbumsData } from '@entities/album';
import {
  fetchUiDictionary,
  selectUiDictionaryStatus,
  selectUiDictionaryData,
} from '@shared/model/uiDictionary';

export type AlbumsDeferred = {
  templateA: Promise<IAlbums[]>; // альбомы
  templateB: Promise<IArticles[]>; // статьи
  templateC: Promise<IInterface[]>; // UI-словарь – грузим ВСЕГДА
  lang: string;
};

export async function albumsLoader({ request }: LoaderFunctionArgs): Promise<AlbumsDeferred> {
  const { signal, url } = request;
  const { pathname } = new URL(url);
  const store = getStore();
  const state = store.getState();
  const lang = selectCurrentLang(state);

  // СЛОВАРЬ НУЖЕН ВЕЗДЕ: шапка, меню, футер, aboutus и т.д.
  let templateC: Promise<IInterface[]>;
  const uiStatus = selectUiDictionaryStatus(state, lang);
  if (uiStatus === 'succeeded') {
    templateC = Promise.resolve(selectUiDictionaryData(state, lang));
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
        if (
          error === 'AbortError' ||
          error === 'Aborted' ||
          (typeof error === 'object' &&
            error !== null &&
            'name' in error &&
            (error as { name?: string }).name === 'AbortError')
        ) {
          return createNeverResolvingPromise();
        }
        throw error;
      });
    }
  }

  // По умолчанию — пустые промисы, чтобы типы были стабильными
  let templateA: Promise<IAlbums[]> = Promise.resolve([]);
  let templateB: Promise<IArticles[]> = Promise.resolve([]);

  // Альбомы нужны на "/", "/albums*" и "/admin/*" (админ-страницы)
  if (pathname === '/' || pathname.startsWith('/albums') || pathname.startsWith('/admin')) {
    const status = selectAlbumsStatus(state, lang);
    if (status === 'succeeded') {
      templateA = Promise.resolve(selectAlbumsData(state, lang));
    } else {
      const fetchThunkPromise = store.dispatch(fetchAlbums({ lang }));

      const createNeverResolvingPromise = () => new Promise<IAlbums[]>(() => {});

      if (signal.aborted) {
        fetchThunkPromise.abort();
        templateA = createNeverResolvingPromise();
      } else {
        const abortHandler = () => {
          fetchThunkPromise.abort();
        };
        signal.addEventListener('abort', abortHandler, { once: true });

        templateA = fetchThunkPromise.unwrap().catch((error) => {
          if (
            error === 'AbortError' ||
            error === 'Aborted' ||
            (typeof error === 'object' &&
              error !== null &&
              'name' in error &&
              (error as { name?: string }).name === 'AbortError')
          ) {
            return createNeverResolvingPromise();
          }
          throw error;
        });
      }
    }
  }

  // Статьи нужны на "/" (главная) и "/articles*"
  if (pathname === '/' || pathname.startsWith('/articles')) {
    const status = selectArticlesStatus(state, lang);
    if (status === 'succeeded') {
      templateB = Promise.resolve(selectArticlesData(state, lang));
    } else {
      const fetchThunkPromise = store.dispatch(fetchArticles({ lang }));

      const createNeverResolvingPromise = () => new Promise<IArticles[]>(() => {});

      if (signal.aborted) {
        fetchThunkPromise.abort();
        templateB = createNeverResolvingPromise();
      } else {
        const abortHandler = () => {
          fetchThunkPromise.abort();
        };
        signal.addEventListener('abort', abortHandler, { once: true });

        templateB = fetchThunkPromise.unwrap().catch((error) => {
          if (
            error === 'AbortError' ||
            error === 'Aborted' ||
            (typeof error === 'object' &&
              error !== null &&
              'name' in error &&
              (error as { name?: string }).name === 'AbortError')
          ) {
            return createNeverResolvingPromise();
          }
          throw error;
        });
      }
    }
  }

  return { templateA, templateB, templateC, lang };
}
