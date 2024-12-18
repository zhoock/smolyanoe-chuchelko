import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { getRandomPhotos } from '../../hooks/albums';

import './style.scss';

export default function AboutUs() {
  getRandomPhotos();

  const [activeIndex, setActiveIndex] = useState(false);

  function handleClick() {
    setActiveIndex((activeIndex) => !activeIndex);
  }

  return (
    <section className="about theme-dark">
      <div className="wrapper">
        <h2>О группе</h2>
        <div
          className={`about__content ${activeIndex ? 'about__content_active' : ''}`}
        >
          <p>
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
          <p>
            Группа выпустила несколько альбомов, включая{' '}
            <Link to="/albums/23">23</Link> и{' '}
            <Link to="/albums/smolyanoechuchelko">Смоляное чучелко</Link>,
            которые представлены на стримминговых платформах. Название "Смоляное
            чучелко" образовано от&nbsp;американского термина "tar-baby",
            относящегося к&nbsp;проблемной ситуации, которая лишь усугубляется
            при попытках взаимодействия с&nbsp;ней.{' '}
          </p>
        </div>
        <button onClick={handleClick} type="button">
          Показать <span>{activeIndex ? 'меньше' : 'больше'}</span>
          <span className="icon-ctrl"></span>
        </button>
      </div>
    </section>
  );
}
