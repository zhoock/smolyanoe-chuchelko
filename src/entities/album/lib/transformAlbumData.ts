// src/entities/album/lib/transformAlbumData.ts
/**
 * Утилиты для трансформации данных альбомов из IAlbums в формат для UI
 */

import type { IAlbums } from '@models';

export interface AlbumData {
  id: string;
  albumId: string; // Строковый ID альбома (например, "23-remastered")
  title: string;
  artist: string;
  year: string;
  cover?: string;
  coverUpdatedAt?: number; // Timestamp для принудительной перезагрузки изображения
  releaseDate?: string;
  tracks: TrackData[];
}

export interface TrackData {
  id: string;
  title: string;
  duration: string;
  lyricsStatus: 'synced' | 'text-only' | 'empty';
  lyricsText?: string;
  src?: string;
  authorship?: string;
  syncedLyrics?: { text: string; startTime: number; endTime?: number }[];
}

/**
 * Преобразует альбом из формата IAlbums в формат AlbumData для UI
 */
export function transformAlbumToAlbumData(album: IAlbums): AlbumData {
  const albumId = album.albumId || '';

  // Обрабатываем release (объект с полем date)
  let releaseDate: Date | null = null;
  if (album.release && typeof album.release === 'object' && 'date' in album.release) {
    const dateStr = album.release.date;
    if (dateStr) {
      releaseDate = new Date(dateStr);
    }
  }

  // Создаем треки с определением статуса на основе данных из альбома
  const tracks: TrackData[] = (album.tracks || []).map((track) => {
    // Определяем статус на основе данных из альбома
    let lyricsStatus: TrackData['lyricsStatus'] = 'empty';
    if (track.syncedLyrics && track.syncedLyrics.length > 0) {
      // Проверяем, действительно ли синхронизировано (есть startTime > 0)
      const isActuallySynced = track.syncedLyrics.some((line) => line.startTime > 0);
      lyricsStatus = isActuallySynced ? 'synced' : 'text-only';
    } else if (track.content && track.content.trim() !== '') {
      lyricsStatus = 'text-only';
    }

    return {
      id: String(track.id),
      title: track.title,
      duration:
        typeof track.duration === 'string'
          ? track.duration
          : track.duration
            ? String(track.duration)
            : '0:00',
      lyricsStatus,
      lyricsText: track.content, // Используем текст из альбома, если есть
      src: track.src,
      authorship: (track as any).authorship || undefined,
    };
  });

  return {
    id: albumId,
    albumId: album.albumId || albumId, // Сохраняем строковый ID альбома
    title: album.album,
    artist: album.artist || '',
    year: releaseDate ? releaseDate.getFullYear().toString() : '',
    cover: album.cover,
    coverUpdatedAt: Date.now(), // Добавляем timestamp для принудительной перезагрузки изображения
    releaseDate: releaseDate
      ? releaseDate.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : undefined,
    tracks,
  };
}

/**
 * Преобразует массив альбомов из формата IAlbums[] в формат AlbumData[]
 */
export function transformAlbumsToAlbumData(albums: IAlbums[]): AlbumData[] {
  return albums.map(transformAlbumToAlbumData);
}
