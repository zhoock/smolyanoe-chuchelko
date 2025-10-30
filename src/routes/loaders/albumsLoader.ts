// src/routes/loaders/albumsLoader.ts
import type { LoaderFunctionArgs } from 'react-router';
import type { IAlbums, IArticles, IInterface } from '../../models';
import { currentLang } from '../../state/langStore';
import { getJSON } from '../../utils/http';

export type AlbumsDeferred = {
  templateA: Promise<IAlbums[]>; // альбомы
  templateB: Promise<IArticles[]>; // статьи
  templateC: Promise<IInterface[]>; // UI-словарь – грузим ВСЕГДА
  lang: string;
};

export async function albumsLoader({ request }: LoaderFunctionArgs): Promise<AlbumsDeferred> {
  const { signal, url } = request;
  const { pathname } = new URL(url);
  const lang = currentLang;

  // СЛОВАРЬ НУЖЕН ВЕЗДЕ: шапка, меню, футер, aboutus и т.д.
  const templateC = getJSON<IInterface[]>(`${lang}.json`, signal);

  // По умолчанию — пустые промисы, чтобы типы были стабильными
  let templateA: Promise<IAlbums[]> = Promise.resolve([]);
  let templateB: Promise<IArticles[]> = Promise.resolve([]);

  // Альбомы нужны на "/" и "/albums*"
  if (pathname === '/' || pathname.startsWith('/albums')) {
    templateA = getJSON<IAlbums[]>(`albums-${lang}.json`, signal);
  }

  // Статьи нужны на "/" (главная) и "/articles*"
  if (pathname === '/' || pathname.startsWith('/articles')) {
    templateB = getJSON<IArticles[]>(`articles-${lang}.json`, signal);
  }

  return { templateA, templateB, templateC, lang };
}
