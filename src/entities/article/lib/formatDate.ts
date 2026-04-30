import { parseISODateOnlyParts } from '@shared/lib/dateCalendar';

export const formatDateInWords = {
  ru: {
    formatDate: (dateRelease: string): string => {
      const months = [
        'января',
        'февраля',
        'марта',
        'апреля',
        'мая',
        'июня',
        'июля',
        'августа',
        'сентября',
        'октября',
        'ноября',
        'декабря',
      ];

      const parts = parseISODateOnlyParts(dateRelease);
      if (parts) {
        const { day: dd, monthIndex, year: yy } = parts;
        const mm = months[monthIndex];
        return `${dd} ${mm} ${yy}`;
      }

      const date = new Date(dateRelease);
      const dd = date.getDate();
      const mm = months[date.getMonth()];
      const yy = date.getFullYear();
      return `${dd} ${mm} ${yy}`;
    },
  },

  en: {
    formatDate: (dateRelease: string): string => {
      const months = [
        'January',
        'February',
        'March',
        'April',
        'May',
        'June',
        'July',
        'August',
        'September',
        'October',
        'November',
        'December',
      ];

      const parts = parseISODateOnlyParts(dateRelease);
      if (parts) {
        const { day: dd, monthIndex, year: yy } = parts;
        const mm = months[monthIndex];
        return `${mm} ${dd}, ${yy}`;
      }

      const date = new Date(dateRelease);
      const dd = date.getDate();
      const mm = months[date.getMonth()];
      const yy = date.getFullYear();
      return `${mm} ${dd}, ${yy}`;
    },
  },
} as const;

export type LocaleKey = keyof typeof formatDateInWords;
