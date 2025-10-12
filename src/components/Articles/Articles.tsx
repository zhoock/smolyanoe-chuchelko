// src/components/Articles/Articles.tsx
import { Helmet } from 'react-helmet-async';
import { useAlbumsData } from '../../hooks/data';
import { DataAwait } from '../../shared/DataAwait';
import WrapperArticle from '../Articles/WrapperArticle';
import { Loader } from '../Loader/Loader';
import { ErrorMessage } from '../ErrorMessage/ErrorMessage';
import { useLang } from '../../contexts/lang';
import './style.scss';

/**
 * Компонент отображает блок cо списком статей.
 */
export const Articles = () => {
  const { lang } = useLang() as { lang: 'ru' | 'en' };
  const data = useAlbumsData(lang); // берём промисы из роутер-лоадера

  // SEO-тексты для двух языков
  const seo = {
    ru: {
      title: 'Смоляное Чучелко — статьи и публикации о группе',
      desc: 'Читайте статьи о группе Смоляное Чучелко: история, философия, альбомы, вдохновения и творческий путь московской гранж-группы.',
      canonical: 'https://smolyanoechuchelko.ru/articles',
    },
    en: {
      title: 'Смоляное Чучелко — articles and publications about the band',
      desc: 'Read articles about Смоляное Чучелко: history, philosophy, albums, inspirations and creative path of the Moscow grunge band.',
      canonical: 'https://smolyanoechuchelko.ru/en/articles',
    },
  };

  // Фоллбек — если данные не загрузились
  if (!data) {
    return (
      <section
        className="articles main-background"
        aria-label={
          lang === 'en'
            ? 'Block with links to Смоляное Чучелко articles'
            : 'Блок c ссылками на статьи Смоляное Чучелко'
        }
      >
        <Helmet>
          <title>{seo[lang].title}</title>
          <meta name="description" content={seo[lang].desc} />
          <link rel="canonical" href={seo[lang].canonical} />
        </Helmet>
        <div className="wrapper articles__wrapper">
          <h2>{lang === 'en' ? 'Articles' : 'Статьи'}</h2>
          <Loader />
        </div>
      </section>
    );
  }

  return (
    <section
      className="articles main-background"
      aria-label={
        lang === 'en'
          ? 'Block with links to Smolyanoe Chuchelko articles'
          : 'Блок c ссылками на статьи Смоляное чучелко'
      }
    >
      <Helmet>
        <title>{seo[lang].title}</title>
        <meta name="description" content={seo[lang].desc} />
        <meta property="og:title" content={seo[lang].title} />
        <meta property="og:description" content={seo[lang].desc} />
        <meta property="og:type" content="website" />
        <link rel="canonical" href={seo[lang].canonical} />
      </Helmet>

      <div className="wrapper articles__wrapper">
        <h2>
          <DataAwait value={data.templateC} fallback={<span>…</span>} error={null}>
            {(ui) => ui?.[0]?.titles?.articles ?? (lang === 'en' ? 'Articles' : 'Статьи')}
          </DataAwait>
        </h2>

        <DataAwait
          value={data.templateB}
          fallback={<Loader />}
          error={
            <ErrorMessage
              error={lang === 'en' ? 'Failed to load articles' : 'Не удалось загрузить статьи'}
            />
          }
        >
          {(articles) => (
            <div className="articles__list">
              {articles.map((a) => (
                <WrapperArticle key={a.articleId} {...a} />
              ))}
            </div>
          )}
        </DataAwait>
      </div>
    </section>
  );
};
