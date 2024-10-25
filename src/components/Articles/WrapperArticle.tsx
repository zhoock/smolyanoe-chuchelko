import React from "react";
import { Link } from "react-router-dom";
import { getImageUrl, formatDate } from "../../hooks/albums";

export default function WrapperArticle({ article }: { article: any }) {
  return (
    <div className="b-articles-list__img">
      <Link to={`/articles/${article.articleId}`}>
        <div
          className="b-articles-list__img-url"
          style={{
            background: `no-repeat center/cover url(${getImageUrl(article.img)})`,
          }}
        ></div>
        <div className="b-cover__description">{article.nameArticle}</div>
        <time dateTime={article.date}>
          <small>{formatDate(article.date)}</small>
        </time>
      </Link>
    </div>
  );
}
