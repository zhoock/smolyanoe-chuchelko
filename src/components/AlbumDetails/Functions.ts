// functions.ts

/**
 * Функция возвращает строку (количество минут) с верным падежным окончанием.
 */
export const functionsMap = {
  ru: {
    endForTracks: (n: number): string =>
      n === 1 ? 'трек' : n > 1 && n < 5 ? 'трека' : 'треков',
    endForMinutes: (n: number): 'минута' | 'минуты' | 'минут' =>
      n === 1 ? 'минута' : n > 1 && n < 5 ? 'минуты' : 'минут',
  },
  en: {
    endForTracks: (n: number): string => (n === 1 ? 'track' : 'tracks'),
    endForMinutes: (n: number): 'minute' | 'minutes' =>
      n === 1 ? 'minute' : 'minutes',
  },
};
