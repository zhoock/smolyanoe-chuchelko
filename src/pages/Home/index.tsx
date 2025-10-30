// src/pages/Home/index.tsx
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAlbumsData } from '@hooks/data';
import { DataAwait } from '@shared/DataAwait';
import { WrapperAlbumCover, AlbumCover } from '@entities/album';
import { Loader } from '@shared/ui/loader';
import { ErrorI18n } from '@shared/ui/error-message';
import { useLang } from '@contexts/lang';
import 'entities/album/ui/style.scss';
import WrapperArticle from '@components/Articles/WrapperArticle';
import '@components/Articles/style.scss';
import aboutStyles from '@components/AboutUs/AboutUs.module.scss';

type TheBandItem = string | { text: string[]; link: string };

/**
 * Главная страница с витриной альбомов
 */
export default function Home() {
  const { lang } = useLang();
  const data = useAlbumsData(lang);
  const [isAboutExpanded, setIsAboutExpanded] = useState(false);
  const location = useLocation();

  useEffect(() => {
    if (location.hash) {
      const targetId = location.hash.slice(1);
      const target = document.getElementById(targetId);
      if (target) {
        const HEADER_OFFSET = -500; // учитываем фиксированный хедер
        const top = target.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET;
        window.scrollTo({ top: Math.max(top, 0), behavior: 'smooth' });
      }
    }
  }, [location.hash]);

  const renderAboutParagraph = (item: TheBandItem, index: number) => {
    if (typeof item === 'string') {
      const parts = item.split(/(<23>|<Смоляное чучелко>|<Smolyanoe Chuchelko>)/g);
      return (
        <p key={index} className={aboutStyles.aboutText}>
          {parts.map((part, idx) => {
            if (part === '<23>') {
              return (
                <Link key={idx} to="/albums/23" className="album-details__link">
                  23
                </Link>
              );
            }
            if (part === '<Смоляное чучелко>' || part === '<Smolyanoe Chuchelko>') {
              return (
                <Link key={idx} to="/albums/smolyanoechuchelko" className="album-details__link">
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
      <p key={index} className={aboutStyles.aboutText}>
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

  return (
    <>
      <section
        id="albums"
        className="albums main-background"
        aria-label="Блок c ссылками на альбомы Смоляное чучелко"
      >
        <div className="wrapper">
          <h2>
            {data ? (
              <DataAwait value={data.templateC} fallback={<span>…</span>}>
                {(ui) => ui?.[0]?.titles?.albums}
              </DataAwait>
            ) : (
              <span>…</span>
            )}
          </h2>

          {data ? (
            <DataAwait
              value={data.templateA}
              fallback={<Loader />}
              error={<ErrorI18n code="albumsLoadFailed" />}
            >
              {(albums) => (
                <div className="albums__list">
                  {albums.map((album) => (
                    <WrapperAlbumCover key={album.albumId} {...album} date={album.release.date}>
                      <AlbumCover {...album.cover} fullName={album.fullName} />
                    </WrapperAlbumCover>
                  ))}
                </div>
              )}
            </DataAwait>
          ) : (
            <Loader />
          )}
        </div>
      </section>

      <section
        id="articles"
        className="articles main-background"
        aria-label="Блок c ссылками на статьи Смоляное чучелко"
      >
        <div className="wrapper articles__wrapper">
          <h2>
            {data ? (
              <DataAwait value={data.templateC} fallback={<span>…</span>}>
                {(ui) => ui?.[0]?.titles?.articles}
              </DataAwait>
            ) : (
              <span>…</span>
            )}
          </h2>

          {data ? (
            <DataAwait
              value={data.templateB}
              fallback={<Loader />}
              error={<ErrorI18n code="articlesLoadFailed" />}
            >
              {(articles) => (
                <div className="articles__list">
                  {articles.map((article) => (
                    <WrapperArticle key={article.articleId} {...article} />
                  ))}
                </div>
              )}
            </DataAwait>
          ) : (
            <Loader />
          )}
        </div>
      </section>

      <section
        id="about"
        className={`${aboutStyles.about} main-background`}
        aria-label={lang === 'en' ? 'About the band' : 'Блок о группе Смоляное чучелко'}
      >
        <div className="wrapper">
          {data ? (
            <DataAwait value={data.templateC} fallback={<h2>…</h2>} error={null}>
              {(ui) => {
                const dict = ui?.[0];
                const title =
                  dict?.titles?.theBand ?? (lang === 'en' ? 'About the Band' : 'Группа');
                const theBand = (dict?.theBand as TheBandItem[]) ?? [];
                const buttons =
                  dict?.buttons ??
                  (lang === 'en'
                    ? { show: 'Show', more: 'more', less: 'less' }
                    : { show: 'Показать', more: 'ещё', less: 'меньше' });

                return (
                  <>
                    <h2>{title}</h2>

                    <div
                      className={`${aboutStyles.aboutContent} ${
                        isAboutExpanded ? aboutStyles.aboutContentActive : ''
                      }`}
                    >
                      {theBand.map(renderAboutParagraph)}
                    </div>

                    <button
                      className={aboutStyles.aboutLookMore}
                      onClick={() => setIsAboutExpanded((prev) => !prev)}
                      type="button"
                      aria-expanded={isAboutExpanded}
                    >
                      <span className={aboutStyles.firstWord}>{buttons.show}</span>
                      <span>{isAboutExpanded ? buttons.less : buttons.more}</span>
                      <span
                        className={`icon-ctrl ${aboutStyles.iconCtrl}`}
                        aria-hidden="true"
                      ></span>
                    </button>
                  </>
                );
              }}
            </DataAwait>
          ) : (
            <h2>{lang === 'en' ? 'About the Band' : 'О группе'}</h2>
          )}
        </div>
      </section>
    </>
  );
}
