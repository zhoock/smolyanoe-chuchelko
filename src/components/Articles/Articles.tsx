import React from "react";
import { Link } from "react-router-dom";
import { ARTICLESDATA } from "../data";

export default function Articles() {
  return (
    <section className="b-articles">
      <div className="row">
        <div className="small-12 column">
          <h2>Статьи</h2>
          {ARTICLESDATA.map((album, i) => (
            <Link key={i} to={`/articles/${album.articleId}`}>
              {album.nameArticle}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
