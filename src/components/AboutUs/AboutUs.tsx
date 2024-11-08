import React, { useState } from "react";
import { Link } from "react-router-dom";
import "./style.scss";

export default function AboutUs() {
  const [activeIndex, setActiveIndex] = useState(false);

  function handleClick() {
    setActiveIndex(!activeIndex);
  }

  return (
    <section className="about-us">
      <div className="row">
        <div className="small-12 column">
          <h2>О группе</h2>
          <p className={activeIndex ? "active" : ""}>
            Смоляное чучелко&nbsp;&mdash; музыкальный проект российского
            музыканта{" "}
            <a href="https://www.instagram.com/yaroslav_zhoock/">
              Ярослава Жука
            </a>
            . Музыкант выпустил два альбома в&nbsp;жанре гранж:&nbsp;
            <Link to="/albums/smolyanoechuchelko">Смоляное чучелко</Link> в 2020
            году и <Link to="/albums/23">23</Link> в 2022 году. Название
            "Смоляное чучелко" образовано от&nbsp;американского термина
            "tar-baby", относящегося к&nbsp;проблемной ситуации, которая лишь
            усугубляется при попытках взаимодействия с&nbsp;ней.
          </p>
          <button onClick={handleClick}>
            Показать <span>{activeIndex ? "меньше" : "больше"}</span>
            <span className="icon-ctrl"></span>
          </button>
        </div>
      </div>
    </section>
  );
}
