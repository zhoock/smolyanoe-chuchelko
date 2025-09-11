// src/routes/loaders/albumsLoader.ts

import { defer, type LoaderFunctionArgs } from 'react-router-dom';
import { getJSON } from '../../utils/getJSON';
import type { IAlbums, IArticles, IInterface } from '../../models';

const BASE =
  'https://raw.githubusercontent.com/zhoock/smolyanoe-chuchelko/refs/heads/main/src/assets';

export async function albumsLoader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const lang = url.searchParams.get('lang') ?? 'ru';
  const { signal } = request; // ← Router сам прерывает при навигации

  const albumsP = getJSON<IAlbums[]>(`${BASE}/albums-${lang}.json`, signal);
  const articlesP = getJSON<IArticles[]>(`${BASE}/articles-${lang}.json`, signal);
  const uiP = getJSON<IInterface[]>(`${BASE}/${lang}.json`, signal);

  return defer({
    templateA: albumsP,
    templateB: articlesP,
    templateC: uiP,
    lang,
  });
}

export type AlbumsDeferred = {
  templateA: Promise<IAlbums[]>;
  templateB: Promise<IArticles[]>;
  templateC: Promise<IInterface[]>;
  lang: string;
};
