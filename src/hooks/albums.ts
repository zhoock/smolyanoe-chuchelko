import { useEffect, useState } from "react";
import { IProduct } from "../models";
import axios, { AxiosError } from "axios";

export function useAlbums() {
  const [albums, setAlbums] = useState<IProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function fetchAlbums() {
    try {
      setError("");
      setLoading(true);
      const { data } = await axios.get<IProduct[]>(
        "https://raw.githubusercontent.com/zhoock/smolyanoe-chuchelko/refs/heads/main/src/json/albums.json",
      );
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
