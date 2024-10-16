import React from "react";
import { ARTICLESDATA } from "../data";
import WrapperArticle from "../Articles/WrapperArticle";

export default function Articles() {
  return (
    <section className="b-articles">
      <div className="row collapse medium-uncollapse">
        <div className="small-12 column">
          <div className="row medium-collapse">
            <div className="small-12 column">
              <h2>Статьи</h2>
            </div>
          </div>

          <div className="b-articles-list">
            {ARTICLESDATA.map((article) => (
              <WrapperArticle key={article.articleId} article={article} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
