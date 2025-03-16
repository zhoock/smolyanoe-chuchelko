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
          {templateData.templateC[0]?.theBand.map((item, i) =>
            typeof item === 'string' ? (
              <p key={i} className="about__text">
                {item}
              </p>
            ) : (
              <>
                <p key={i} className="about__text">
                  {item.text[0]}{' '}
                  {
                    <a
                      className="album-details__link"
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {item.text[1]}
                    </a>
                  }{' '}
                  {item.text[2]}
                  {
                    <a
                      className="album-details__link"
                      href={item.link2}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {item.text[3]}
                    </a>
                  }{' '}
                  {item.text[4]}
                </p>
              </>
            ),
          )}

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
