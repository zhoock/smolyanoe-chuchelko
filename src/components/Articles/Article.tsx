import React from "react";
import { Link } from "react-router-dom";
import { useParams } from "react-router-dom";
import { ARTICLES } from "../Data/Data";
import { getImageUrl, alphabeticFormatDate } from "../../hooks/albums";
import { IArticles, ArticleDetalesProps } from "../../models";

/**
 * Компонент отображает блок со статьёй.
 */
export default function Article() {
  window.scrollTo({
    top: 0,
    left: 0,
    behavior: "smooth",
  });

  const params = useParams<{ articleId: string }>(); // возвращает все параметры, доступные на этой странице

  const article: IArticles = ARTICLES.filter(
    (_) => _.articleId === params.articleId,
  )[0];

  function Block({ title, subtitle, content, img }: ArticleDetalesProps) {
    return (
      <>
        {title && <h3>{title}</h3>}
        <div className="row small-collapse medium-uncollapse">
          <div className="small-12 column">
            {img && <img src={getImageUrl(img)} alt="" />}
          </div>
        </div>
        <h4>{subtitle}</h4>
        {typeof content == "string" ? (
          <p>{content}</p>
        ) : (
          <ul>{content?.map((item, i) => <li key={i}>{item}</li>)}</ul>
        )}
      </>
    );
  }

  return (
    <section className="article">
      <div className="row">
        <div className="small-12 column">
          <nav aria-label="Breadcrumb" className="breadcrumb">
            <ul>
              <li>
                <Link to="/articles">Статьи</Link>
              </li>
              <li className="active">{article.nameArticle}</li>
            </ul>
          </nav>
          <time dateTime={article.date}>
            <small>{alphabeticFormatDate(article.date)}</small>
          </time>
          <h2>{article.nameArticle}</h2>
          {article.detales.map((_) => (
            <Block key={_.id} {..._} />
          ))}
        </div>
      </div>
    </section>
  );
}
