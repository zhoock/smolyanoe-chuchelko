// src/hooks/data.ts

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { IAlbums, IArticles, IInterface } from '../models';

const BASE =
  'https://raw.githubusercontent.com/zhoock/smolyanoe-chuchelko/refs/heads/main/src/assets';

// useData(lang) — это кастомный React-хук, который:
// по lang (например, "ru"/"en") грузит три JSON-файла с GitHub (альбомы, статьи, UI-словарик),
// кладёт результат в локальный стейт,
// отдаёт наружу { templateData, loading, error, refetch },
// автоматически перезагружает данные при смене lang,
// безопасно отменяет «устаревший» запрос, если язык сменился до завершения загрузки.
interface ITemplateData {
  templateA: IAlbums[]; // данные для альбомов
  templateB: IArticles[]; // данные для статей
  templateC: IInterface[]; // данные для интерфейса/словаря
}

export function useData(lang: string) {
  const [templateData, setTemplateData] = useState<ITemplateData>({
    templateA: [],
    templateB: [],
    templateC: [],
  }); // три массива данных (типизированы)
  const [loading, setLoading] = useState(false); // состояние загрузки
  const [error, setError] = useState(''); // текст ошибки (пустая строка, если всё ок)

  // Функция загрузки fetchData
  // Оборачиваем в useCallback, чтобы ссылка на функцию была стабильной между рендерами и менялась только когда меняется lang.
  // Необязательный signal — для отмены запроса через AbortController.
  const fetchData = useCallback(
    async (signal?: AbortSignal) => {
      try {
        setError(''); // сбрасываем ошибку
        setLoading(true); // включаем индикатор загрузки

        // Параллельно грузим три файла с GitHub
        // (axios умеет принимать signal для отмены запроса)
        // Благодаря дженерикам <IAlbums[]> и т.п. редактор знает точные поля в r.data.

        const [albums, articles, ui] = await Promise.all([
          axios.get<IAlbums[]>(`${BASE}/albums-${lang}.json`, { signal }).then((r) => r.data),
          axios.get<IArticles[]>(`${BASE}/articles-${lang}.json`, { signal }).then((r) => r.data),
          axios.get<IInterface[]>(`${BASE}/${lang}.json`, { signal }).then((r) => r.data),
        ]);

        // Если к этому моменту signal уже пометили aborted, выходим, не трогая стейт:
        if (signal?.aborted) return;

        // Иначе кладём данные в стейт
        setTemplateData({
          templateA: albums,
          templateB: articles,
          templateC: ui,
        });
      } catch (e) {
        // Тихо выходим при отмене
        if (axios.isCancel(e) || (axios.isAxiosError(e) && e.code === 'ERR_CANCELED')) {
          return;
        }

        if (axios.isAxiosError(e)) {
          console.error('Axios error:', e);
          setError(e.message || 'Ошибка при загрузке данных');
        } else {
          console.error('Unknown error:', e);
          setError('Неизвестная ошибка');
        }
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [lang]
  );

  // Автозагрузка + перезагрузка при смене lang
  // Эффект вызывается при первом рендере и каждый раз, когда меняется fetchData,
  // а она зависит от lang. Значит, сменили язык → эффект перезапустился.
  useEffect(() => {
    const ac = new AbortController();
    fetchData(ac.signal);
    return () => ac.abort();
  }, [fetchData]);

  // Ручная перезагрузка по требованию
  const refetch = useCallback(() => fetchData(), [fetchData]);

  return { templateData, loading, error, refetch };
}

/**
 * Возвращает полный URL для изображения в нужном формате.
 */
export function getImageUrl(img: string, format: string = '.jpg'): string {
  return `/images/${img}${format}`;
}

/**
 * Возвращает дату релиза альбома в формате дд/мм/гггг.
 */
export function formatDate(dateRelease: string): string {
  const date = new Date(dateRelease);
  const dd = date.getDate().toString().padStart(2, '0');
  const mm = (date.getMonth() + 1).toString().padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}
