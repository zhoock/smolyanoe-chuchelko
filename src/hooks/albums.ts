import { useEffect, useState } from "react";
import { IProduct } from "../models";
// import { IArticle } from "../models";
import axios, { AxiosError } from "axios";

export function useAlbums() {
  const [albums, setAlbums] = useState<IProduct[]>([]);
  // const [articles, setArticles] = useState<IArticle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Axios.all()
  // const endpoints = [
  //   "https://raw.githubusercontent.com/zhoock/smolyanoe-chuchelko/refs/heads/main/src/json/albums.json",
  //   "https://raw.githubusercontent.com/zhoock/smolyanoe-chuchelko/refs/heads/main/src/json/articles.json",
  //   "https://www.breakingbadapi.com/api/episodes",
  //   "https://www.breakingbadapi.com/api/quotes",
  // ];

  async function fetchAlbums() {
    try {
      setError("");
      setLoading(true);
      const { data } = await axios.get<IProduct[]>(
        "https://raw.githubusercontent.com/zhoock/smolyanoe-chuchelko/refs/heads/main/src/json/albums.json",
      );
      // axios
      //   .all(endpoints.map((endpoint) => axios.get(endpoint)))
      //   .then((allResponses) => {
      //     allResponses.forEach((response, i) => {
      //        console.log(response.data);
      //       setAlbums(response.data);
      //       setArticles(response.data);
      //     });
      //   });
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
