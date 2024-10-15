import React from "react";
import { ARTICLESDATA } from "../data";
import WrapperArticle from "../Articles/WrapperArticle";



export default function Articles() {
  return (
    <section className="b-articles">
      <div className="row">
        <div className="small-12 column">
          <h2>Статьи</h2>
          <div className="b-article-list">
            {ARTICLESDATA.map((article) => (
              <WrapperArticle key={article.articleId} article={article} />
            
             
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
