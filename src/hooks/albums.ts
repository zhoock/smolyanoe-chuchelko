import { useEffect, useState } from "react";
import { IAlbums } from "../models";
import axios, { AxiosError } from "axios";

export function useData() {
  const [albums, setAlbums] = useState<IAlbums[]>([]);
  const [loading, setLoading] = useState(false); // state для индикации загрузки
  const [error, setError] = useState(""); // state для реализации ошибки при загрузке

  async function fetchAlbums() {
    try {
      setError(""); // очищаем ошибку при новой загрузке данных
      setLoading(true);
      const { data } = await axios.get<IAlbums[]>(
        "https://raw.githubusercontent.com/zhoock/smolyanoe-chuchelko/refs/heads/main/src/assets/albums.json",
      );
      setAlbums(data); // передаём массив альбомов
      setLoading(false); // произошла ошибка
    } catch (e) {
      const error = e as AxiosError;
      setLoading(false); // произошла ошибка
      setError(error.message); // выводим ошибку в сообщении
    }
  }

  // useEffect будет следить за изменением setAlbums и производить ререндер если это необходимо
  useEffect(() => {
    fetchAlbums();
  }, [setAlbums]);

  return { albums, loading, error }; // возвращаем данные
}

const src =
  "https://raw.githubusercontent.com/zhoock/smolyanoe-chuchelko/refs/heads/main/src/images/";

/**
 * Функция возвращает полный URL для изображения в нужном формате
 */
export function getImageUrl(img: string, format: string = ".jpg"): string {
  return src + img + format;
}

/**
 * Функция возвращает дату релиза альбома в формате дд/мм/гг.
 */
export function formatDate(dateRelease: string): string {
  const date = new Date(dateRelease);

  let dd: number | string = date.getDate();
  if (dd < 10) dd = "0" + dd;

  let mm: number | string = date.getMonth() + 1;
  if (mm < 10) mm = "0" + mm;

  let yy: number | string = date.getFullYear();
  if (yy < 10) yy = "0" + yy;

  return `${dd}/${mm}/${yy}`;
}

/**
 * Функция возвращает правильное падежное окончание для месяцев.
 */
export function alphabeticFormatDate(dateRelease: string): string {
  const date = new Date(dateRelease);

  let dd: number | string = date.getDate();

  let mm: number | string = date.getMonth() + 1;
  switch (mm) {
    case 1:
      mm = "января";
      break;
    case 2:
      mm = "февраля";
      break;
    case 3:
      mm = "марта";
      break;
    case 4:
      mm = "апреля";
      break;
    case 5:
      mm = "мая";
      break;
    case 6:
      mm = "июня";
      break;
    case 7:
      mm = "июля";
      break;
    case 8:
      mm = "августа";
      break;
    case 9:
      mm = "сентября";
      break;
    case 10:
      mm = "октября";
      break;
    case 11:
      mm = "ноября";
      break;
    case 12:
      mm = "декабря";
      break;
  }

  let yy: number | string = date.getFullYear();
  if (yy < 10) yy = "0" + yy;

  return `${dd} ${mm} ${yy}`;
}

/**
 * Функция возвращает случайный background-image для body.
 */
export function getRandomPhotos() {
  let photos: string[] = [
    `url(${src}banner-for-header.jpg)`,
    `url(${src}KvArYFCcWLg.jpg)`,
    `url(${src}CZaNPYWOmVM.jpg)`,
    `url(${src}wj3MH7eyNhY.jpg`,
    `url(${src}XpaX73Jq4S8.jpg`,
    // `url(${src}M2x9Im2_1uM.jpg)`,
    // `url(${src}pAZ_AZh5bQU.jpg)`,
    // `url(${src}M2x9Im2_1uM.jpg)`,
    // `url(${src}6yIUmtdW35U.jpg)`,
    // `url(${src}F2Z8WN--2kg.jpg`,
    // `url(${src}IkpCtDzA5WM.jpg`,
  ];

  // smoothly(
  //   document.body,
  //   "style.backgroundImage",
  //   photos[Math.floor(Math.random() * photos.length)],
  // );

  document.body.style.backgroundImage =
    photos[Math.floor(Math.random() * photos.length)];
}
