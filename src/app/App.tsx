// src/app/App.tsx
import { useState, useEffect } from 'react';
import {
  createBrowserRouter,
  RouterProvider,
  useLocation,
  Routes,
  Route,
  useRevalidator,
} from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { albumsLoader } from '../routes/loaders/albumsLoader';
import { useLang } from '../contexts/lang';
import { currentLang, setCurrentLang } from '../state/langStore';

import {
  Header,
  Footer,
  AboutUs,
  Articles,
  Article,
  Navigation,
  Hamburger,
  ModalRoute,
  Popup,
  NotFoundPage,
  Form,
  Hero,
  TrackLyrics,
} from '@components';
import Albums from '../pages/Albums/Albums';
import Album from '../pages/Album/Album';

// Упрощённый роутер: один корневой маршрут, всё остальное рисуем в Layout
const router = createBrowserRouter([
  {
    id: 'root',
    path: '/*',
    element: <Layout />,
    loader: albumsLoader, // загружаем данные для альбомов, статей и UI-словарик
    errorElement: <NotFoundPage />,
  },
]);

export default function App() {
  return (
    <RouterProvider
      router={router}
      future={{ v7_startTransition: true }}
      fallbackElement={<p>Загрузка...</p>}
    />
  );
}

function Layout() {
  const [popup, setPopup] = useState(false);
  const location = useLocation(); // background location для модалки трека
  const state = location.state as { background?: Location } | undefined;
  const background = state?.background;

  const { lang } = useLang() as { lang: 'ru' | 'en' };
  const { revalidate } = useRevalidator();

  useEffect(() => {
    if (currentLang !== lang) {
      // ← дергаем только когда язык реально сменился+
      setCurrentLang(lang);
      revalidate();
    }
  }, [lang, revalidate]);

  const seo = {
    ru: {
      title: 'Смоляное Чучелко — официальный сайт',
      desc: 'Московская гранж и альтернативная рок-группа. Альбомы, тексты, статьи и философия проекта.',
      url: 'https://smolyanoechuchelko.ru/',
      ogImage: 'https://smolyanoechuchelko.ru/og/default.jpg',
    },
    en: {
      title: 'Smolyanoe Chuchelko — official website',
      desc: 'Moscow grunge and alternative rock band. Albums, lyrics, articles and project philosophy.',
      url: 'https://smolyanoechuchelko.ru/en',
      ogImage: 'https://smolyanoechuchelko.ru/og/default_en.jpg',
    },
  };

  // меняем <html lang="...">
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  return (
    <>
      {/* БАЗОВЫЙ Helmet для всех страниц без собственного */}
      <Helmet>
        {/* динамический заголовок и описание */}
        <title>{seo[lang].title}</title>
        <meta name="description" content={seo[lang].desc} />
        <meta name="color-scheme" content="dark light" />
        <link rel="canonical" href={seo[lang].url} />

        {/* hreflang для Google */}
        <link rel="alternate" href="https://smolyanoechuchelko.ru/" hrefLang="ru" />
        <link rel="alternate" href="https://smolyanoechuchelko.ru/en" hrefLang="en" />
        <link rel="alternate" href="https://smolyanoechuchelko.ru/" hrefLang="x-default" />

        {/* Open Graph / Twitter */}
        <meta property="og:type" content="website" />
        <meta property="og:title" content={seo[lang].title} />
        <meta property="og:description" content={seo[lang].desc} />
        <meta property="og:url" content={seo[lang].url} />
        <meta property="og:image" content={seo[lang].ogImage} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={seo[lang].title} />
        <meta name="twitter:description" content={seo[lang].desc} />
        <meta name="twitter:image" content={seo[lang].ogImage} />
      </Helmet>
      <Header />
      <main>
        <Hero />

        {/* если поместим popup внурь header, то popup будет обрезаться из-за css-фильтра (filter) внури header */}

        <Popup isActive={popup} onClose={() => setPopup(false)}>
          <Navigation onToggle={() => setPopup(!popup)} />
        </Popup>

        <Hamburger isActive={popup} onToggle={() => setPopup(!popup)} zIndex="1000" />

        {/* ВСЕГДА один и тот же Routes.
           Если есть background, используем его как "виртуальную" локацию,
           иначе — текущую. Дерево остаётся тем же, нет размонтирования. */}
        <Routes location={background ?? location}>
          <Route path="/" element={<Albums />} />
          <Route path="/albums" element={<Albums />} />
          <Route path="/albums/:albumId" element={<Album />} />
          <Route path="/albums/:albumId/track/:trackId" element={<TrackLyrics />} />
          <Route path="/aboutus" element={<AboutUs />} />
          <Route path="/articles" element={<Articles />} />
          <Route path="/articles/:articleId" element={<Article />} />
          <Route path="/forms" element={<Form />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>

        {/* Модалка поверх: слушает реальный URL */}
        {background && (
          <Routes>
            <Route
              path="/albums/:albumId/track/:trackId"
              element={
                <ModalRoute>
                  <TrackLyrics />
                </ModalRoute>
              }
            />
          </Routes>
        )}
      </main>
      <Footer />
    </>
  );
}
