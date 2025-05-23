import { useEffect, useState } from 'react';
import axios from 'axios';
import { IAlbums, IArticles, IInterface } from '../models';
import { getLang } from '../utils/language';

interface ITemplateData {
  templateA: IAlbums[]; // Данные для первого шаблона c альбомами
  templateB: IArticles[]; // Данные для второго шаблона со статьями
  templateC: IInterface[]; // Данные для третьего шаблона с интерфейсом
}

const lang = getLang();

export function useData(lang: string) {
  const [templateData, setTemplateData] = useState<ITemplateData>({
    templateA: [],
    templateB: [],
    templateC: [],
  }); // Хранение данных для  шаблонов
  const [loading, setLoading] = useState(false); // состояние для индикации загрузки
  const [error, setError] = useState(''); // состояние для хранения ошибок

  // Асинхронная функция для загрузки данных
  async function fetchData() {
    try {
      setError(''); // Сбрасываем ошибку перед загрузкой
      setLoading(true); // Включаем состояние загрузки

      const [templateAResponse, templateBResponse, templateCResponse] =
        await Promise.all([
          axios.get(
            `https://raw.githubusercontent.com/zhoock/smolyanoe-chuchelko/refs/heads/main/src/assets/albums-${lang}.json`,
          ),
          axios.get(
            `https://raw.githubusercontent.com/zhoock/smolyanoe-chuchelko/refs/heads/main/src/assets/articles-${lang}.json`,
          ),

          axios.get(
            `https://raw.githubusercontent.com/zhoock/smolyanoe-chuchelko/refs/heads/main/src/assets/${lang}.json`,
          ),
        ]);

      // Установка данных в state
      setTemplateData({
        templateA: templateAResponse.data,
        templateB: templateBResponse.data,
        templateC: templateCResponse.data,
      });
    } catch (e) {
      if (axios.isAxiosError(e)) {
        console.error('Axios error:', e);
        setError(e.message || 'Ошибка при загрузке данных');
      } else {
        console.error('Unknown error:', e);
        setError('Неизвестная ошибка');
      }
    } finally {
      setLoading(false); // Выключаем состояние загрузки
    }
  }

  // useEffect будет следить за изменением setTemplateData и производить ререндер если это необходимо
  useEffect(() => {
    fetchData();
  }, []); // Пустой массив зависимостей

  return { templateData, loading, error }; // Возвращаем данные для обоих шаблонов
}

/**
 * Функция возвращает полный URL для изображения в нужном формате
 */
export function getImageUrl(img: string, format: string = '.jpg'): string {
  const url = `/images/${img}${format}`;
  // console.log(`Generated image URL:`, url);
  return url;
}

/**
 * Функция возвращает дату релиза альбома в формате дд/мм/гг.
 */
export function formatDate(dateRelease: string): string {
  const date = new Date(dateRelease);
  const dd = date.getDate().toString().padStart(2, '0');
  const mm = (date.getMonth() + 1).toString().padStart(2, '0');
  const yy = date.getFullYear();

  return `${dd}/${mm}/${yy}`;
}
