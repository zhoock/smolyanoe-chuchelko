import React from "react";
import { Link } from "react-router-dom";

function getImageUrl(img: string) {
  return (
    "https://raw.githubusercontent.com/zhoock/smolyanoe-chuchelko/refs/heads/main/src/images/" +
    img +
    ".jpg"
  );
}

/**
 * Функция возвращает дату релиза альбома в формате дд/мм/гг.
 */
const formatDate = (dateRelease: string) => {
  const date = new Date(dateRelease);

  let dd: number | string = date.getDate();
  if (dd < 10) dd = "0" + dd;

  let mm: number | string = date.getMonth() + 1;
  if (mm < 10) mm = "0" + mm;

  let yy: number | string = date.getFullYear();
  if (yy < 10) yy = "0" + yy;

  return `${dd}/${mm}/${yy}`;
};

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
