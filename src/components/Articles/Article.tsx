import React from "react";
import { Link } from "react-router-dom";
import { useParams } from "react-router-dom";
import { ARTICLESDATA } from "../data";
import { getImageUrl } from "../../hooks/albums";

function Block({
  title,
  subtitle,
  content,
  img,
}: {
  title: string;
  subtitle: string;
  content: string[];
  img: string;
}) {
  return (
    <>
      {title && <h3>{title}</h3>}
      {img && <img src={getImageUrl(img)} alt="" />}
      <h4>{subtitle}</h4>
      {typeof content == "string" ? (
        <p>{content}</p>
      ) : (
        <ul>{content?.map((item, i) => <li key={i}>{item}</li>)}</ul>
      )}
    </>
  );
}

export default function Article() {
  window.scrollTo({
    top: 0,
    left: 0,
    behavior: "smooth",
  });

  const params = useParams<{ articleId: string }>();

  const article = ARTICLESDATA.filter(
    (_) => _.articleId === params.articleId,
  )[0];

  return (
    <section className="b-article">
      <div className="row">
        <div className="small-12 medium-10 large-8 small-centered column">
          <nav aria-label="Breadcrumb" className="b-breadcrumb">
            <ul>
              <li>
                <Link to="/articles">Статьи</Link>
              </li>
              <li className="active">{article.nameArticle}</li>
            </ul>
          </nav>
          <h2>{article.nameArticle}</h2>
          {article.detales.map((detales: any) => (
            <Block {...detales} key={detales.id} />
          ))}
        </div>
      </div>
    </section>
  );
}
