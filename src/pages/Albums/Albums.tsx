// src/pages/Albums/Albums.tsx

import { useAlbumsData } from '../../hooks/data';
import { DataAwait } from '../../shared/DataAwait';
import WrapperAlbumCover from '../../components/Album/WrapperAlbumCover';
import AlbumCover from '../../components/Album/AlbumCover';
import { Loader } from '../../components/Loader/Loader';
import ErrorI18n from '../../components/ErrorMessage/ErrorI18n';
import { useLang } from '../../contexts/lang';
import { useLocation } from 'react-router-dom';
import SEO from '../../components/SEO/SEO';
import { useSEOReady } from '../../hooks/useSEOReady';
import '../../components/Album/style.scss';

const SITE = 'https://smolyanoechuchelko.ru';
const OG_IMAGE = `${SITE}/images/hero/5.jpg`; // 1200×630

// маленький помощник, чтобы вызывать хук безопасно
function SEOReady({ deps }: { deps: unknown[] }) {
  useSEOReady(deps);
  return null;
}

/**
 * Компонент отображает список альбомов в виде обложек-ссылок
 */
export default function Albums() {
  const { lang } = useLang();
  const data = useAlbumsData(lang);
  const location = useLocation();

  const defaultTitle =
    lang === 'en' ? 'Albums — Smolyanoe Chuchelko' : 'Альбомы — Смоляное чучелко';
  const defaultDescription =
    lang === 'en'
      ? 'Albums by Smolyanoe Chuchelko: covers, tracklists, release dates.'
      : 'Альбомы группы «Смоляное чучелко»: обложки, даты релизов.';

  const canonical = `${SITE}${location.pathname}${location.search}`;

  return (
    <section
      className="albums main-background"
      aria-label="Блок c ссылками на альбомы Смоляное чучелко"
    >
      {/* 1) Дефолтные теги сразу, чтобы хоть что-то было до загрузки */}
      <SEO
        title={defaultTitle}
        description={defaultDescription}
        url={canonical}
        image={OG_IMAGE}
        type="website"
      />

      <div className="wrapper">
        <h2>
          {data ? (
            <DataAwait value={data.templateC} fallback={<span>…</span>}>
              {(ui) => {
                const rawTitle = ui?.[0]?.titles?.albums; // ReactNode | string
                const safeTitle = typeof rawTitle === 'string' ? rawTitle : defaultTitle;

                return (
                  <>
                    {/* 2) Когда строки готовы — обновляем мета */}
                    <SEO
                      title={safeTitle}
                      description={defaultDescription}
                      url={canonical}
                      image={OG_IMAGE}
                      type="website"
                    />
                    {/* 3) Сигнал пререндеру, что теги уже финальные */}
                    <SEOReady deps={[safeTitle, canonical, OG_IMAGE]} />
                    {/* Заголовок страницы */}
                    {rawTitle ?? safeTitle}
                  </>
                );
              }}
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
