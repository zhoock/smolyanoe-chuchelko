// src/app/App.tsx
import { useEffect, useRef, useState, Suspense, lazy } from 'react';
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
import { albumsLoader } from '@routes/loaders/albumsLoader';
import { useLang } from '@app/providers/lang';
import { useAppDispatch } from '@shared/lib/hooks/useAppDispatch';
import { useAppSelector } from '@shared/lib/hooks/useAppSelector';
import { closePopup, getIsPopupOpen, openPopup } from '@features/popupToggle';

import { Popup } from '@shared/ui/popup';
import { NotFoundPage } from '@widgets/notFound';
import { Form } from '@widgets/form';
import { Hero } from '@widgets/hero';
import { Header } from '@widgets/header';
import { Footer } from '@widgets/footer';
import { Navigation } from '@features/navigation';
import { Hamburger } from '@shared/ui/hamburger';
import { PlayerShell } from '@features/player';

// Lazy loading для страниц - загружаются только при необходимости
const Album = lazy(() => import('@pages/Album/Album'));
const StemsPlayground = lazy(() => import('@pages/StemsPlayground/StemsPlayground'));
const Home = lazy(() => import('@pages/Home'));
const Admin = lazy(() => import('@pages/Admin/Admin'));
const AdminAlbum = lazy(() => import('@pages/AdminAlbum/AdminAlbum'));
const AdminSync = lazy(() => import('@pages/AdminSync/AdminSync'));
const AdminText = lazy(() => import('@pages/AdminText/AdminText'));
const AdminAlbumJson = lazy(() => import('@pages/AdminAlbumJson/AdminAlbumJson'));
const AdminAlbumBuilder = lazy(() => import('@pages/AdminAlbumBuilder/AdminAlbumBuilder'));
const ArticlePage = lazy(() => import('@pages/Article'));

// Компонент для отображения загрузки
const PageLoader = () => <p>Загрузка...</p>;

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
  const location = useLocation();

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

  const previousLangRef = useRef(lang);
  const revalidateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (previousLangRef.current !== lang) {
      previousLangRef.current = lang;

      // Отменяем предыдущий таймаут, если он есть
      if (revalidateTimeoutRef.current) {
        clearTimeout(revalidateTimeoutRef.current);
      }

      // Используем debounce, чтобы предотвратить множественные вызовы
      revalidateTimeoutRef.current = setTimeout(() => {
        revalidate();
        revalidateTimeoutRef.current = null;
      }, 50);
    }

    return () => {
      if (revalidateTimeoutRef.current) {
        clearTimeout(revalidateTimeoutRef.current);
        revalidateTimeoutRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

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
    '/articles/:articleId',
    '/forms',
    '/stems',
    '/admin',
    '/admin/album/:albumId',
    '/admin/sync/:albumId/:trackId',
    '/admin/text/:albumId/:trackId',
    '/admin/json/:albumId',
    '/admin/builder',
  ];

  const isKnownRoute = knownRoutes.some((pattern) =>
    matchPath({ path: pattern, end: true }, location.pathname)
  );
  const shouldHideChrome = !isKnownRoute;

  const standardRoutes = (
    <>
      <Routes>
        <Route
          path="/"
          element={
            <Suspense fallback={<PageLoader />}>
              <Home />
            </Suspense>
          }
        />
        <Route
          path="/albums/:albumId"
          element={
            <Suspense fallback={<PageLoader />}>
              <Album />
            </Suspense>
          }
        />
        <Route
          path="/articles/:articleId"
          element={
            <Suspense fallback={<PageLoader />}>
              <ArticlePage />
            </Suspense>
          }
        />
        <Route path="/forms" element={<Form />} />
        <Route
          path="/stems"
          element={
            <Suspense fallback={<PageLoader />}>
              <StemsPlayground />
            </Suspense>
          }
        />
        <Route
          path="/admin"
          element={
            <Suspense fallback={<PageLoader />}>
              <Admin />
            </Suspense>
          }
        />
        <Route
          path="/admin/album/:albumId"
          element={
            <Suspense fallback={<PageLoader />}>
              <AdminAlbum />
            </Suspense>
          }
        />
        <Route
          path="/admin/sync/:albumId/:trackId"
          element={
            <Suspense fallback={<PageLoader />}>
              <AdminSync />
            </Suspense>
          }
        />
        <Route
          path="/admin/text/:albumId/:trackId"
          element={
            <Suspense fallback={<PageLoader />}>
              <AdminText />
            </Suspense>
          }
        />
        <Route
          path="/admin/json/:albumId"
          element={
            <Suspense fallback={<PageLoader />}>
              <AdminAlbumJson />
            </Suspense>
          }
        />
        <Route
          path="/admin/builder"
          element={
            <Suspense fallback={<PageLoader />}>
              <AdminAlbumBuilder />
            </Suspense>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
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

            {standardRoutes}
          </main>
          <Footer />
          <PlayerShell />
        </>
      )}
    </>
  );
}
