/**
 * Типы и начальное состояние для Redux стейта плеера.
 */

// Состояние времени трека: текущая позиция и общая длительность
export interface PlayerTimeState {
  current: number; // текущее время в секундах
  duration: number; // общая длительность трека в секундах (NaN если трек не загружен)
}

import type { TracksProps } from '../../../../models';

/**
 * Интерфейс состояния плеера в Redux.
 * Здесь хранится всё, что связано с воспроизведением аудио.
 */
export interface PlayerState {
  isPlaying: boolean; // играет ли трек сейчас
  volume: number; // громкость от 0 до 100
  isSeeking: boolean; // перематывает ли пользователь трек вручную (нужно для блокировки автообновления прогресса)
  progress: number; // прогресс воспроизведения от 0 до 100 (%)
  time: PlayerTimeState; // текущее время и длительность
  currentTrackIndex: number; // индекс текущего трека в плейлисте
  playlist: TracksProps[]; // массив треков текущего альбома
  playRequestId: number; // счётчик для запросов на воспроизведение (инкрементируется при requestPlay)
}

/**
 * Начальное состояние плеера.
 * Это дефолтные значения, когда приложение только запускается.
 */
export const initialPlayerState: PlayerState = {
  isPlaying: false,
  volume: 50, // средняя громкость по умолчанию
  isSeeking: false,
  progress: 0,
  time: { current: 0, duration: NaN }, // NaN значит "ещё не загружено"
  currentTrackIndex: 0,
  playlist: [],
  playRequestId: 0,
};
