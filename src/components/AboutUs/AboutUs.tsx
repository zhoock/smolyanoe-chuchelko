// src/components/AboutUs/AboutUs.tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';

import { useAlbumsData } from '../../hooks/data';
import { DataAwait } from '../../shared/DataAwait';
import { useLang } from '../../contexts/lang';

import s from './AboutUs.module.scss';

type TheBandItem = string | { text: string[]; link: string };

export const AboutUs = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { lang } = useLang() as { lang: 'ru' | 'en' };
  const data = useAlbumsData(lang); // берём промисы из лоадера

  const renderParagraph = (item: TheBandItem, i: number) => {
    if (typeof item === 'string') {
      const parts = item.split(/(<23>|<Смоляное чучелко>|<Smolyanoe Chuchelko>)/g);
      return (
        <p key={i} className={s.aboutText}>
          {parts.map((part, index) => {
            if (part === '<23>') {
              return (
                <Link key={index} to="/albums/23" className="album-details__link">
                  23
                </Link>
              );
            } else if (part === '<Смоляное чучелко>' || part === '<Smolyanoe Chuchelko>') {
              return (
                <Link key={index} to="/albums/smolyanoechuchelko" className="album-details__link">
                  {lang === 'en' ? 'Smolyanoe Chuchelko' : 'Смоляное чучелко'}
                </Link>
              );
            }
            return part;
          })}
        </p>
      );
    }

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

  // Фоллбек, если данные не загрузились
  if (!data) {
    return (
      <section className={`${s.about} main-background`}>
        <div className="wrapper">
          <h2>{lang === 'en' ? 'About the Band' : 'О группе'}</h2>
        </div>
      </section>
    );
  }

  // SEO-данные для двух языков
  const seo = {
    ru: {
      title: 'Смоляное Чучелко — о группе, альбомы «23» и «Смоляное чучелко»',
      desc: 'Московская гранж/альт-рок группа с мрачным звучанием и атмосферными аранжировками. Альбомы «23» и «Смоляное чучелко», тексты о внутренней борьбе и меланхолии.',
      canonical: 'https://smolyanoechuchelko.ru/aboutus',
    },
    en: {
      title: 'Смоляное Чучелко — about the band, albums “23” and “Смоляное Чучелко”',
      desc: 'Moscow grunge/alt-rock band with dark sound and atmospheric arrangements. Albums “23” and “Смоляное Чучелко”, lyrics about inner struggle and melancholy.',
      canonical: 'https://smolyanoechuchelko.ru/en/aboutus',
    },
  };

  return (
    <section className={`${s.about} main-background`}>
      <div className="wrapper">
        <DataAwait value={data.templateC} fallback={<h2>…</h2>} error={null}>
          {(ui) => {
            const dict = ui?.[0];
            const titleFromDict =
              dict?.titles?.theBand ?? (lang === 'en' ? 'About the Band' : 'Группа');
            const theBand = (dict?.theBand as TheBandItem[]) ?? [];
            const buttons =
              dict?.buttons ??
              (lang === 'en'
                ? { show: 'Show', more: 'more', less: 'less' }
                : { show: 'Показать', more: 'ещё', less: 'меньше' });

            return (
              <>
                <Helmet>
                  <title>{seo[lang].title}</title>
                  <meta name="description" content={seo[lang].desc} />
                  <meta property="og:title" content={seo[lang].title} />
                  <meta property="og:description" content={seo[lang].desc} />
                  <meta property="og:type" content="website" />
                  <link rel="canonical" href={seo[lang].canonical} />
                </Helmet>

                <h2>{titleFromDict}</h2>

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
