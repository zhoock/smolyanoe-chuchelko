// src/pages/Home/index.tsx
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
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
import { Popup } from '@shared/ui/popup';
import { Text } from '@shared/ui/text';
import { Hamburger } from '@components';

/**
 * Главная страница с витриной альбомов
 */
export default function Home() {
  const { lang } = useLang();
  const data = useAlbumsData(lang);
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);
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

  return (
    <>
      <section id="albums" className="albums main-background" aria-labelledby="home-albums-heading">
        <div className="wrapper">
          <h2 id="home-albums-heading">
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
        aria-labelledby="home-articles-heading"
      >
        <div className="wrapper articles__wrapper">
          <h2 id="home-articles-heading">
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
        aria-labelledby="home-about-heading"
      >
        <div className="wrapper">
          {data ? (
            <DataAwait value={data.templateC} fallback={<h2>…</h2>} error={null}>
              {(ui) => {
                const dict = ui?.[0];
                const title = dict?.titles?.theBand ?? '';
                const theBand = Array.isArray(dict?.theBand)
                  ? (dict.theBand as string[]).filter(Boolean)
                  : [];
                const previewParagraphs = theBand.slice(0, 1);
                const showLabel = dict?.buttons?.show ?? '';
                return (
                  <>
                    <h2 id="home-about-heading">{title}</h2>

                    <div className={aboutStyles.aboutContent}>
                      {previewParagraphs.map(
                        (paragraph, index) =>
                          paragraph && (
                            <Text key={index} className={aboutStyles.aboutText}>
                              {paragraph}
                            </Text>
                          )
                      )}
                    </div>

                    <button
                      className={aboutStyles.aboutLookMore}
                      onClick={() => setIsAboutModalOpen(true)}
                      type="button"
                      aria-haspopup="dialog"
                    >
                      {showLabel}
                    </button>

                    <Popup
                      isActive={isAboutModalOpen}
                      onClose={() => setIsAboutModalOpen(false)}
                      aria-labelledby="about-popup-title"
                    >
                      <div className={aboutStyles.aboutPopup}>
                        <Hamburger
                          isActive={isAboutModalOpen}
                          onToggle={() => setIsAboutModalOpen(false)}
                          zIndex="1200"
                          className={aboutStyles.aboutPopupHamburger}
                        />

                        <div className={aboutStyles.aboutPopupInner}>
                          <h3 id="about-popup-title" className={aboutStyles.aboutPopupTitle}>
                            {title}
                          </h3>

                          <div className={aboutStyles.aboutPopupContent}>
                            {theBand.map(
                              (paragraph, index) =>
                                paragraph && (
                                  <Text key={index} className={aboutStyles.aboutText}>
                                    {paragraph}
                                  </Text>
                                )
                            )}
                          </div>
                        </div>
                      </div>
                    </Popup>
                  </>
                );
              }}
            </DataAwait>
          ) : (
            <h2 id="home-about-heading">{''}</h2>
          )}
        </div>
      </section>
    </>
  );
}
