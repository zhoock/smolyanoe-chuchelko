/**
 * Утилиты для форматирования и отображения статусов треков
 */

import type { TrackStatus } from './trackStatus';

/**
 * Получает иконку для статуса трека
 */
export function getStatusIcon(status: TrackStatus): string {
  switch (status) {
    case 'synced':
      return '✅';
    case 'text-only':
      return '⚠️';
    case 'empty':
      return '❌';
  }
}

/**
 * Получает текст для статуса трека
 */
export function getStatusText(status: TrackStatus): string {
  switch (status) {
    case 'synced':
      return 'Синхронизирован';
    case 'text-only':
      return 'Текст добавлен';
    case 'empty':
      return 'Пусто';
  }
}

/**
 * Форматирует длительность трека в формат MM:SS
 */
export function formatDuration(seconds: number | undefined): string {
  if (!seconds || !Number.isFinite(seconds)) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
