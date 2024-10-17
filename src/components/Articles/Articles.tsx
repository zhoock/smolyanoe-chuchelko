import React, { useEffect } from "react";
import { ARTICLESDATA } from "../data";
import WrapperArticle from "../Articles/WrapperArticle";
import axios from "axios";


export default function Articles() {

  async function fetchProducts() {
    const response = axios.get("https://fakestoreapi.com/products?limit=5");
    console.log(response);
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
              <img
                src="src/images/2Lw32V8t2ps.jpg"
                alt=""
              />
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
