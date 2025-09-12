// src/pages/AboutUs/AboutUs.tsx

import { useState } from 'react';
import { Link } from 'react-router-dom';

import { useAlbumsData } from '../../hooks/data';
import { DataAwait } from '../../shared/DataAwait';
import { useLang } from '../../contexts/lang';

import s from './style.module.scss';

type TheBandItem = string | { text: string[]; link: string };

export const AboutUs = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { lang } = useLang();
  const data = useAlbumsData(lang); // берём промисы из лоадера

  const renderParagraph = (item: TheBandItem, i: number) => {
    if (typeof item === 'string') {
      // Встраиваемые ссылки по маркерам
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
            }
            return part;
          })}
        </p>
      );
    }

    // { text: [before, anchorText, after], link }
    return (
      <p key={i} className={s.aboutText}>
        {item.text?.[0]}{' '}
        <a
          className="album-details__link"
          href={item.link}
          target="_blank"
          rel="noopener noreferrer"
        >
          {item.text?.[1]}
        </a>{' '}
        {item.text?.[2]}
      </p>
    );
  };

  // Если лоадер не вернул данные (теоретически) — аккуратный фоллбек
  if (!data) {
    return (
      <section className={`${s.about} main-background`}>
        <div className="wrapper">
          <h2>О группе</h2>
        </div>
      </section>
    );
  }

  return (
    <section className={`${s.about} main-background`}>
      <div className="wrapper">
        <DataAwait value={data.templateC} fallback={<h2>…</h2>} error={null}>
          {(ui) => {
            const dict = ui?.[0];
            const title = dict?.titles?.theBand ?? 'О группе';
            const theBand = (dict?.theBand as TheBandItem[]) ?? [];
            const buttons = dict?.buttons ?? { show: 'Показать', more: 'ещё', less: 'меньше' };

            return (
              <>
                <h2>{title}</h2>

                <div className={`${s.aboutContent} ${isExpanded ? s.aboutContentActive : ''}`}>
                  {theBand.map(renderParagraph)}
                </div>

                <button
                  className={s.aboutLookMore}
                  onClick={() => setIsExpanded((prev) => !prev)}
                  type="button"
                  aria-expanded={isExpanded}
                >
                  <span className={s.firstWord}>{buttons.show}</span>
                  <span>{isExpanded ? buttons.less : buttons.more}</span>
                  <span className={`icon-ctrl ${s.iconCtrl}`} aria-hidden="true"></span>
                </button>
              </>
            );
          }}
        </DataAwait>
      </div>
    </section>
  );
};
