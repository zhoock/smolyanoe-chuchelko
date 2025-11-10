/**
 * Утилита для сохранения и восстановления состояния плеера из localStorage.
 * Позволяет сохранить текущий трек, альбом, громкость и состояние воспроизведения.
 */

import type { PlayerState } from '../types/playerSchema';

const STORAGE_KEY = 'playerState';

/**
 * Интерфейс сохраняемого состояния.
 * Сохраняем только необходимые данные (не сохраняем progress, time, isSeeking).
 */
interface PersistedPlayerState {
  albumId: string | null;
  albumTitle: string | null;
  currentTrackIndex: number;
  volume: number;
  isPlaying: boolean;
  albumMeta?: PlayerState['albumMeta'];
  sourceLocation?: PlayerState['sourceLocation'];
}

/**
 * Сохраняет состояние плеера в localStorage.
 * @param state - текущее состояние плеера из Redux
 */
export function savePlayerState(state: PlayerState): void {
  try {
    const persistedState: PersistedPlayerState = {
      albumId: state.albumId,
      albumTitle: state.albumTitle,
      currentTrackIndex: state.currentTrackIndex,
      volume: state.volume,
      isPlaying: state.isPlaying,
      albumMeta: state.albumMeta ? { ...state.albumMeta } : null,
      sourceLocation: state.sourceLocation ? { ...state.sourceLocation } : null,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persistedState));
  } catch (error) {
    // Игнорируем ошибки localStorage (например, если он отключен или переполнен)
    console.warn('Failed to save player state to localStorage:', error);
  }
}

/**
 * Загружает сохранённое состояние плеера из localStorage.
 * @returns сохранённое состояние или null, если ничего не найдено
 */
export function loadPlayerState(): PersistedPlayerState | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    const parsed = JSON.parse(stored) as PersistedPlayerState;

    // Валидация данных
    if (
      typeof parsed.currentTrackIndex !== 'number' ||
      typeof parsed.volume !== 'number' ||
      typeof parsed.isPlaying !== 'boolean' ||
      (parsed.albumId !== null && typeof parsed.albumId !== 'string') ||
      (parsed.albumTitle !== null && typeof parsed.albumTitle !== 'string') ||
      (parsed.albumMeta != null && typeof parsed.albumMeta !== 'object') ||
      (parsed.sourceLocation != null && typeof parsed.sourceLocation !== 'object')
    ) {
      return null;
    }

    return parsed;
  } catch (error) {
    console.warn('Failed to load player state from localStorage:', error);
    return null;
  }
}

/**
 * Удаляет сохранённое состояние плеера из localStorage.
 */
export function clearPlayerState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn('Failed to clear player state from localStorage:', error);
  }
}
