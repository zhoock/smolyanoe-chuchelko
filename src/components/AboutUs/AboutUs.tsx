import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import './style.scss';

export default function AboutUs() {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <section className="about main-background">
      <div className="wrapper">
        <h2>О группе</h2>
        <div
          className={`about__content ${isExpanded ? 'about__content_active' : ''}`}
        >
          <p className="about__text">
            «Смоляное чучелко» — российский музыкальный коллектив
            из&nbsp;Москвы, играющий в&nbsp;жанре гранж и&nbsp;альтернативного
            рока. Группа активно вдохновляется эстетикой и&nbsp;звучанием
            сиэтлского гранжа 1990-х годов. Их&nbsp;творчество отличается
            мрачным звучанием, атмосферными аранжировками и&nbsp;глубокими
            текстами, затрагивающими темы внутренней борьбы, саморазрушения
            и&nbsp;меланхолии.{' '}
            <a href="https://www.instagram.com/yaroslav_zhoock/">Ярослав Жук</a>{' '}
            является вокалистом и автором музыки, определяя стиль и философию
            коллектива.
          </p>
          <p className="about__text">
            Группа выпустила несколько альбомов, включая{' '}
            <Link to="/albums/23">23</Link> и{' '}
            <Link to="/albums/smolyanoechuchelko">Смоляное чучелко</Link>,
            которые представлены на стриминговых платформах. Название "Смоляное
            чучелко" образовано от&nbsp;американского термина "tar-baby",
            относящегося к&nbsp;проблемной ситуации, которая лишь усугубляется
            при попытках взаимодействия с&nbsp;ней.
          </p>
        </div>
        <button
          className="about__look-more"
          onClick={() => setIsExpanded((prev) => !prev)}
          type="button"
          aria-expanded={isExpanded}
        >
          Показать <span>{isExpanded ? 'меньше' : 'больше'}</span>
          <span className="icon-ctrl" aria-hidden="true"></span>
        </button>
      </div>
    </section>
  );
}
