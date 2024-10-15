import React from "react";
import { Link } from "react-router-dom";

function getImageUrl(img: string) {
  return (
    "https://raw.githubusercontent.com/zhoock/smolyanoe-chuchelko/refs/heads/main/src/images/" +
    img +
    ".jpg"
  );
}

export default function WrapperArticle({ article }: { article: any }) {
  return (
    <div className="b-cover__img">
      <Link to={`/articles/${article.articleId}`}>
        <img src={getImageUrl(article.img)} alt="" />
        <div className="b-cover__description">{article.nameArticle}</div>
      </Link>
    </div>
  );
}
