import React, { useState } from "react";
import { Link } from "react-router-dom";
import { getRandomPhotos } from "../../hooks/albums";

import "./style.scss";

export default function AboutUs() {
  getRandomPhotos();

  const [activeIndex, setActiveIndex] = useState(false);

  function handleClick() {
    setActiveIndex((activeIndex) => !activeIndex);
  }

  return (
    <section className="about">
      <div className="row">
        <div className="column">
          <h2>О группе</h2>
          <div
            className={`about__content ${activeIndex ? "about__content_active" : ""}`}
          >
            <p>
              «Смоляное чучелко» — российский музыкальный коллектив из Москвы,
              играющий в жанре гранж и альтернативного рока. Группа активно
              вдохновляется эстетикой и звучанием сиэтлского гранжа 1990-х
              годов. Их творчество отличается мрачным звучанием, атмосферными
              аранжировками и глубокими текстами, затрагивающими темы внутренней
              борьбы, саморазрушения и меланхолии.
            </p>
            <p>
              Группа выпустила несколько альбомов, включая{" "}
              <Link to="/albums/23">23</Link> и{" "}
              <Link to="/albums/smolyanoechuchelko">Смоляное чучелко</Link>{" "}
              которые представлены на стримминговых платформах. Название
              "Смоляное чучелко" образовано от&nbsp;американского термина
              "tar-baby", относящегося к&nbsp;проблемной ситуации, которая лишь
              усугубляется при попытках взаимодействия с&nbsp;ней.{" "}
              <a href="https://www.instagram.com/yaroslav_zhoock/">
                Ярослав Жук
              </a>{" "}
              является основным вокалистом и автором музыки, определяя стиль и
              философию коллектива.
            </p>
          </div>
          <button onClick={handleClick}>
            Показать <span>{activeIndex ? "меньше" : "больше"}</span>
            <span className="icon-ctrl"></span>
          </button>
        </div>
      </div>
    </section>
  );
}
