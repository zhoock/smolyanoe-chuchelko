import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../../hooks/data';
import { useLang } from '../../hooks/useLang';

import s from './style.module.scss';

export default function AboutUs() {
  const [isExpanded, setIsExpanded] = useState(false);
  const { lang } = useLang();
  const { templateData } = useData(lang);

  const renderParagraph = (item: string | { text: string[]; link: string }, i: number) => {
    if (typeof item === 'string') {
      // Обработка встраиваемых ссылок по маркерам
      const parts = item.split(/(<23>|<Смоляное чучелко>)/g);
      return (
        <p key={i} className={s.aboutText}>
          {parts.map((part, index) => {
            if (part === '<23>') {
              return (
                <Link key={index} to="/albums/23" className="album-details__link">
                  23
                </Link>
              );
            } else if (part === '<Смоляное чучелко>') {
              return (
                <Link key={index} to="/albums/smolyanoechuchelko" className="album-details__link">
                  Смоляное чучелко
                </Link>
              );
            } else {
              return part;
            }
          })}
        </p>
      );
    } else {
      return (
        <p key={i} className={s.aboutText}>
          {item.text[0]}{' '}
          <a
            className="album-details__link"
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
          >
            {item.text[1]}
          </a>{' '}
          {item.text[2]}
        </p>
      );
    }
  };

  return (
    <section className={`${s.about} main-background`}>
      <div className="wrapper">
        <h2>{templateData.templateC[0]?.titles.theBand}</h2>
        <div className={`${s.aboutContent} ${isExpanded ? s.aboutContentActive : ''}`}>
          {templateData.templateC[0]?.theBand.map(renderParagraph)}
        </div>
        <button
          className={s.aboutLookMore}
          onClick={() => setIsExpanded((prev) => !prev)}
          type="button"
          aria-expanded={isExpanded}
        >
          <span className={s.firstWord}>{templateData.templateC[0]?.buttons.show}</span>
          <span>
            {isExpanded
              ? templateData.templateC[0]?.buttons.less
              : templateData.templateC[0]?.buttons.more}
          </span>
          <span className={`icon-ctrl ${s.iconCtrl}`} aria-hidden="true"></span>
        </button>
      </div>
    </section>
  );
}
