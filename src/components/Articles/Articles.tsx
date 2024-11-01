import React from "react";
import { ARTICLESDATA } from "../data";
import WrapperArticle from "../Articles/WrapperArticle";
import "./style.scss";

/**
 * Компонент отображает блок cо списком статей.
 */
export default function Articles() {
  return (
    <section className="articles">
      <div className="row collapse medium-uncollapse">
        <div className="small-12 column">
          <div className="row medium-collapse">
            <div className="small-12 column">
              <h2>Статьи</h2>
            </div>
          </div>

          <div className="articles__list">
            {ARTICLESDATA.map((_) => (
              <WrapperArticle key={_.articleId} {..._} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
