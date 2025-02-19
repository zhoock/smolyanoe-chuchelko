import { useEffect, useState } from 'react';
import axios from 'axios';
import { IAlbums, IArticles } from '../models';

interface ITemplateData {
  templateA: IAlbums[]; // Данные для первого шаблона
  templateB: IArticles[]; // Данные для второго шаблона
}

export function useData() {
  const [templateData, setTemplateData] = useState<ITemplateData>({
    templateA: [],
    templateB: [],
  }); // Хранение данных для обоих шаблонов
  const [loading, setLoading] = useState(false); // состояние для индикации загрузки
  const [error, setError] = useState(''); // состояние для хранения ошибок

  // Асинхронная функция для загрузки данных
  async function fetchData() {
    try {
      setError(''); // Сбрасываем ошибку перед загрузкой
      setLoading(true); // Включаем состояние загрузки

      const [templateAResponse, templateBResponse] = await Promise.all([
        axios.get(
          'https://raw.githubusercontent.com/zhoock/smolyanoe-chuchelko/refs/heads/main/src/assets/albums.json',
        ),
        axios.get(
          'https://raw.githubusercontent.com/zhoock/smolyanoe-chuchelko/refs/heads/main/src/assets/articles.json',
        ),
      ]);

      // Установка данных в state
      setTemplateData({
        templateA: templateAResponse.data,
        templateB: templateBResponse.data,
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
  console.log(`Generated image URL:`, url);
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

/**
 * Функция возвращает правильное падежное окончание для месяцев.
 */
export function alphabeticFormatDate(dateRelease: string): string {
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
}
