import React from "react";
import { useData, getRandomPhotos } from "../../hooks/albums";
import { ARTICLES } from "../Data/Data";
import WrapperArticle from "../Articles/WrapperArticle";
import { Loader } from "../Loader/Loader";
import { ErrorMessage } from "../ErrorMessage/ErrorMessage";
import "./style.scss";

/**
 * Компонент отображает блок cо списком статей.
 */
export default function Articles() {
  getRandomPhotos();
  // const { albums, loading, error } = useData();

  return (
    <section className="articles theme-dark">
      <div className="row collapse medium-uncollapse">
        <div className="column">
          <div className="row medium-collapse">
            <div className="column">
              <h2>Статьи</h2>
            </div>
          </div>

          {/* Элемент показывается только при загрузке данных с сервера */}
          {/* {loading && <Loader />} */}
          {/* Элемент показывается текст ошибки при ошибке загрузке данных с сервера */}
          {/* {error && <ErrorMessage error={error} />} */}

          <div className="articles__list">
            {ARTICLES.map((_) => (
              <WrapperArticle key={_.articleId} {..._} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
