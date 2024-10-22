import React, { useEffect, useState } from "react";
import WrapperCover from "../Cover/WrapperCover";
import Cover from "../Cover/Cover";
import axios from "axios";
import { IProduct } from "../../models";

/**
 * Компонент отображает список альбомов в виде обложек-ссылок
 */
export default function Albums() {
  const [albums, setAlbums] = useState<IProduct[]>([]);

  async function fetchAlbums() {
    const apiUrl =
      "https://raw.githubusercontent.com/zhoock/smolyanoe-chuchelko/refs/heads/main/src/json/albums.json";

    axios.get<IProduct[]>(apiUrl).then((resp) => {
      setAlbums(resp.data);
    });
  }

  // useEffect будет следить за изменением setAlbums и производить ререндер если это необходимо
  useEffect(() => {
    fetchAlbums();
  }, [setAlbums]);

  return (
    <section className="b-albums">
      <div className="row collapse medium-uncollapse">
        <div className="small-12 column">
          <div className="row medium-collapse">
            <div className="small-12 column">
              <h2>Альбомы</h2>
            </div>
          </div>

          <div className="b-covers-list">
            {albums.map((album) => (
              <WrapperCover
                key={album.albumId}
                fullName={album.fullName}
                year={album.release[0].date}
                album={album}
              >
                <Cover nameAlbum={album.nameAlbum} />
              </WrapperCover>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
