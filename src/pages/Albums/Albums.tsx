// src/pages/Albums/Albums.tsx

import { useAlbumsData } from '../../hooks/data';
import { DataAwait } from '../../shared/DataAwait';
import WrapperAlbumCover from '../../components/Album/WrapperAlbumCover';
import AlbumCover from '../../components/Album/AlbumCover';
import { Loader } from '../../components/Loader/Loader';
import ErrorI18n from '../../components/ErrorMessage/ErrorI18n';
import { useLang } from '../../contexts/lang';
import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';
import '../../components/Album/style.scss';

const SITE = 'https://smolyanoechuchelko.ru';
const OG_IMAGE = `${SITE}/images/hero/5.jpg`; // положи картинку по этому пути (1200×630)

/**
 * Компонент отображает список альбомов в виде обложек-ссылок
 */
export default function Albums() {
  const { lang } = useLang();
  const data = useAlbumsData(lang);
  const location = useLocation();

  // Текстовые значения (фолбэки, пока не загрузились i18n-строки)
  const pageTitle =
    (data && <DataAwait value={data.templateC}>{(ui) => ui?.[0]?.titles?.albums}</DataAwait>) ||
    (lang === 'en' ? 'Albums — Smolyanoe Chuchelko' : 'Альбомы — Смоляное чучелко');

  const pageDescription =
    lang === 'en'
      ? 'Albums by Smolyanoe Chuchelko: covers, tracklists, release dates.'
      : 'Альбомы группы «Смоляное чучелко»: обложки, даты релизов.';

  const canonical = `${SITE}${location.pathname}${location.search}`;

  return (
    <section
      className="albums main-background"
      aria-label="Блок c ссылками на альбомы Смоляное чучелко"
    >
      <Helmet>
        {/* Язык страницы */}
        <html lang={lang === 'en' ? 'en' : 'ru'} />

        <title>{typeof pageTitle === 'string' ? pageTitle : 'Альбомы — Смоляное чучелко'}</title>
        <meta name="description" content={pageDescription} />
        <link rel="canonical" href={canonical} />

        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Смоляное чучелко" />
        <meta
          property="og:title"
          content={typeof pageTitle === 'string' ? pageTitle : 'Альбомы — Смоляное чучелко'}
        />
        <meta property="og:description" content={pageDescription} />
        <meta property="og:url" content={canonical} />
        <meta property="og:image" content={OG_IMAGE} />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta
          name="twitter:title"
          content={typeof pageTitle === 'string' ? pageTitle : 'Альбомы — Смоляное чучелко'}
        />
        <meta name="twitter:description" content={pageDescription} />
        <meta name="twitter:image" content={OG_IMAGE} />
      </Helmet>
      {/* Helmet-блок */}

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
  );
}
