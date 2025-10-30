// src/app/App.tsx
import { useEffect, useState } from 'react';
import {
  createBrowserRouter,
  RouterProvider,
  useLocation,
  Routes,
  Route,
  useRevalidator,
  matchPath,
} from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { albumsLoader } from '../routes/loaders/albumsLoader';
import { useLang } from '../contexts/lang';
import { currentLang, setCurrentLang } from '../state/langStore';
import { useAppDispatch } from '@shared/lib/hooks/useAppDispatch';
import { useAppSelector } from '@shared/lib/hooks/useAppSelector';
import { closePopup, getIsPopupOpen, openPopup } from '@features/popupToggle';

import {
  Header,
  Footer,
  Article,
  Navigation,
  Hamburger,
  ModalRoute,
  Popup,
  NotFoundPage,
  Form,
  Hero,
  TracksLyrics,
} from '@components';
import Album from '../pages/Album/Album';
import StemsPlayground from '../pages/StemsPlayground/StemsPlayground';
import Home from '../pages/Home';

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
  const dispatch = useAppDispatch();
  const popup = useAppSelector(getIsPopupOpen);
  const location = useLocation(); // background location для модалки трека
  const state = location.state as { background?: Location } | undefined;
  const background = state?.background;

  const { lang } = useLang() as { lang: 'ru' | 'en' };
  const { revalidate } = useRevalidator();
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') {
      return 'dark';
    }

    const stored = localStorage.getItem('theme');
    if (stored === 'light' || stored === 'dark') {
      return stored;
    }

    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    if (currentLang !== lang) {
      // ← дергаем только когда язык реально сменился+
      setCurrentLang(lang);
      revalidate();
    }
  }, [lang, revalidate]);

  useEffect(() => {
    document.documentElement.classList.toggle('theme-dark', theme === 'dark');
    document.documentElement.classList.toggle('theme-light', theme === 'light');
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const seo = {
    ru: {
      title: 'Смоляное Чучелко — официальный сайт',
      desc: 'Московская гранж и альтернативная рок-группа. Альбомы, тексты, статьи и философия проекта.',
      url: 'https://smolyanoechuchelko.ru/',
      ogImage: 'https://smolyanoechuchelko.ru/og/default.jpg',
    },
    en: {
      title: 'Смоляное Чучелко — official website',
      desc: 'Moscow grunge and alternative rock band. Albums, lyrics, articles and project philosophy.',
      url: 'https://smolyanoechuchelko.ru/en',
      ogImage: 'https://smolyanoechuchelko.ru/og/default_en.jpg',
    },
  };

  // меняем <html lang="...">
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const knownRoutes = [
    '/',
    '/albums/:albumId',
    '/albums/:albumId/track/:trackId',
    '/articles/:articleId',
    '/forms',
    '/stems',
  ];

  const isKnownRoute = knownRoutes.some((pattern) =>
    matchPath({ path: pattern, end: true }, location.pathname)
  );
  const shouldHideChrome = !isKnownRoute;

  const standardRoutes = (
    <>
      <Routes location={background ?? location}>
        <Route path="/" element={<Home />} />
        <Route path="/albums/:albumId" element={<Album />} />
        <Route path="/albums/:albumId/track/:trackId" element={<TracksLyrics />} />
        <Route path="/articles/:articleId" element={<Article />} />
        <Route path="/forms" element={<Form />} />
        <Route path="*" element={<NotFoundPage />} />
        <Route path="/stems" element={<StemsPlayground />} />
      </Routes>

      {background && (
        <Routes>
          <Route
            path="/albums/:albumId/track/:trackId"
            element={
              <ModalRoute>
                <TracksLyrics />
              </ModalRoute>
            }
          />
        </Routes>
      )}
    </>
  );

  const notFoundRoutes = (
    <Routes>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );

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

      {shouldHideChrome ? (
        <main>{notFoundRoutes}</main>
      ) : (
        <>
          <Header theme={theme} onToggleTheme={toggleTheme} />
          <main>
            <Hero />

            {/* если поместим popup внурь header, то popup будет обрезаться из-за css-фильтра (filter) внури header */}

            <Popup isActive={popup} onClose={() => dispatch(closePopup())}>
              <Hamburger isActive={popup} onToggle={() => dispatch(closePopup())} zIndex="1000" />
              <Navigation onToggle={() => dispatch(closePopup())} />
            </Popup>

            {!popup && (
              <Hamburger isActive={popup} onToggle={() => dispatch(openPopup())} zIndex="1000" />
            )}

            {/* ВСЕГДА один и тот же Routes.
            Если есть background, используем его как "виртуальную" локацию,
            иначе — текущую. Дерево остаётся тем же, нет размонтирования. */}
            {standardRoutes}
          </main>
          <Footer />
        </>
      )}
    </>
  );
}
