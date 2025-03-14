import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../../hooks/data';

import './style.scss';

export default function AboutUs() {
  const [isExpanded, setIsExpanded] = useState(false);
  const { templateData } = useData();

  return (
    <section className="about main-background">
      <div className="wrapper">
        <h2>{templateData.templateC[0]?.titles.theBand}</h2>
        <div
          className={`about__content ${isExpanded ? 'about__content_active' : ''}`}
        >
          <p className="about__text">
            "Смоляное чучелко" is a Russian musical group from Moscow, playing
            in the genres of grunge and alternative rock. The group is actively
            inspired by the aesthetics and sound of Seattle grunge of the 1990s.
            Their work is distinguished by a dark sound, atmospheric
            arrangements and deep lyrics touching on themes of internal
            struggle, self-destruction and melancholy.{' '}
            <a href="https://www.instagram.com/yaroslav_zhoock/">
              Yaroslav Zhuk
            </a>{' '}
            is the vocalist and author of the music, defining the style and
            philosophy of the group.
          </p>
          <p className="about__text">
            The group released several albums, including{' '}
            <Link to="/albums/23">23</Link> и{' '}
            <Link to="/albums/smolyanoechuchelko">Смоляное чучелко</Link>, which
            are presented on streaming platforms. The name "Tar Baby" is derived
            from the American term "tar-baby", referring to a problematic
            situation that only gets worse when you try to interact with it.
          </p>
        </div>
        <button
          className="about__look-more"
          onClick={() => setIsExpanded((prev) => !prev)}
          type="button"
          aria-expanded={isExpanded}
        >
          {templateData.templateC[0]?.buttons.show}
          {/* <span>{isExpanded ? 'меньше' : 'больше'}</span> */}
          <span>{isExpanded ? 'less' : 'more'}</span>
          <span className="icon-ctrl" aria-hidden="true"></span>
        </button>
      </div>
    </section>
  );
}
