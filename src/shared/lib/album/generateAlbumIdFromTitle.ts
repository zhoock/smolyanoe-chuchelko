/**
 * Строковый album_id для URL: транслитерация кириллицы, латиница/цифры, дефисы между словами.
 * Должен совпадать с логикой в dashboard при создании альбома.
 */
export function generateAlbumIdFromTitle(title: string): string {
  const transliterationMap: Record<string, string> = {
    а: 'a',
    б: 'b',
    в: 'v',
    г: 'g',
    д: 'd',
    е: 'e',
    ё: 'yo',
    ж: 'zh',
    з: 'z',
    и: 'i',
    й: 'y',
    к: 'k',
    л: 'l',
    м: 'm',
    н: 'n',
    о: 'o',
    п: 'p',
    р: 'r',
    с: 's',
    т: 't',
    у: 'u',
    ф: 'f',
    х: 'h',
    ц: 'ts',
    ч: 'ch',
    ш: 'sh',
    щ: 'sch',
    ъ: '',
    ы: 'y',
    ь: '',
    э: 'e',
    ю: 'yu',
    я: 'ya',
  };

  const transliterate = (str: string): string => {
    return str
      .toLowerCase()
      .split('')
      .map((char) => {
        if (transliterationMap[char]) {
          return transliterationMap[char];
        }
        if (/[a-z0-9]/.test(char)) {
          return char;
        }
        if (/[\s-]/.test(char)) {
          return '-';
        }
        return '';
      })
      .join('');
  };

  const normalize = (str: string) => {
    const transliterated = transliterate(str.trim());
    return transliterated.replace(/-+/g, '-').replace(/^-|-$/g, '');
  };

  const titleSlug = normalize(title);

  if (!titleSlug) {
    return `album-${Date.now()}`;
  }

  return titleSlug;
}
