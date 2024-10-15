import React from "react";
import { Link } from "react-router-dom";
import { useParams } from "react-router-dom";
import { ARTICLESDATA } from "../data";

// import IjivB_qQvRA from "../../IjivB_qQvRA.jpg";
// import WXCC_uqimg from "../../images/WXCC_uqimg.jpg";

function getImageUrl(img: string) {
  return (
    "https://raw.githubusercontent.com/zhoock/smolyanoe-chuchelko/refs/heads/main/src/images/" +
    img +
    ".jpg"
  );
}

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
      <h3>{title}</h3>
      <h4>{subtitle}</h4>
      <ul>{content && content?.map((item, i) => <li key={i}>{item}</li>)}</ul>
      <img src={getImageUrl(img)} alt="" />
    </>
  );
}

export default function Article() {
  const params = useParams<{ articleId: string }>();

  const article = ARTICLESDATA.filter(
    (_) => _.articleId === params.articleId,
  )[0];

  return (
    <section className="b-article">
      <div className="row">
        <div className="small-12 column">
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
