// src/hooks/data.ts
import { useRouteLoaderData } from 'react-router-dom';
import type { AlbumsDeferred } from '@/routes/loaders/albumsLoader';

export function useAlbumsData(_lang: string) {
  return useRouteLoaderData('root') as AlbumsDeferred | null;
}

export function getImageUrl(img: string, format: string = '.jpg'): string {
  return `/images/${img}${format}`;
}

export function formatDate(dateRelease: string): string {
  const date = new Date(dateRelease);
  const dd = date.getDate().toString().padStart(2, '0');
  const mm = (date.getMonth() + 1).toString().padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}
