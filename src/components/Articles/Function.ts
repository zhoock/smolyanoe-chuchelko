/**
 * Функция возвращает правильное падежное окончание для месяцев.
 */
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

      const date = new Date(dateRelease);
      const dd = date.getDate();
      const mm = months[date.getMonth()];
      const yy = date.getFullYear();

      return `${mm} ${dd}, ${yy}`;
    },
  },
};
