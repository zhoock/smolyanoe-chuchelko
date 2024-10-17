import React, { useEffect } from "react";
import { ARTICLESDATA } from "../data";
import WrapperArticle from "../Articles/WrapperArticle";
import axios from "axios";


export default function Articles() {

  async function fetchProducts() {
    const response = axios.get("src/products/products.json");
    // console.log(response);
  }
  useEffect(() => {
    fetchProducts();
  }, []);

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
