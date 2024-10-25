import { useEffect, useState } from "react";
import { IProduct } from "../models";
import axios, { AxiosError } from "axios";

export function useAlbums() {
  const [albums, setAlbums] = useState<IProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function fetchAlbums() {
    const URL =
      "https://raw.githubusercontent.com/zhoock/smolyanoe-chuchelko/refs/heads/main/src/assets/albums.json";

    try {
      setError("");
      setLoading(true);
      const { data } = await axios.get<IProduct[]>(URL);
      setAlbums(data);
      setLoading(false);
    } catch (e) {
      const error = e as AxiosError;
      setLoading(false);
      setError(error.message);
    }
  }

  // useEffect будет следить за изменением setAlbums и производить ререндер если это необходимо
  useEffect(() => {
    fetchAlbums();
  }, [setAlbums]);

  return { albums, loading, error };
}

export function getImageUrl(img: string, format: string = ".jpg") {
  return (
    "https://raw.githubusercontent.com/zhoock/smolyanoe-chuchelko/refs/heads/main/src/images/" +
    img +
    format
  );
}

/**
 * Функция возвращает дату релиза альбома в формате дд/мм/гг.
 */
export function formatDate(dateRelease: string) {
  const date = new Date(dateRelease);

  let dd: number | string = date.getDate();
  if (dd < 10) dd = "0" + dd;

  let mm: number | string = date.getMonth() + 1;
  if (mm < 10) mm = "0" + mm;

  let yy: number | string = date.getFullYear();
  if (yy < 10) yy = "0" + yy;

  return `${dd}/${mm}/${yy}`;
}
