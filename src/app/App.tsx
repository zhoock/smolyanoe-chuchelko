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
import { ErrorBoundary } from '@shared/ui/error-boundary';

// Lazy loading для страниц - загружаются только при необходимости
const Album = lazy(() => import('@pages/Album/Album'));
const AllAlbums = lazy(() => import('@pages/AllAlbums'));
const AllArticles = lazy(() => import('@pages/AllArticles'));
const StemsPlayground = lazy(() => import('@pages/StemsPlayground/StemsPlayground'));
const Home = lazy(() => import('@pages/Home'));
const ArticlePage = lazy(() => import('@pages/Article'));
const HelpArticlePage = lazy(() => import('@pages/HelpArticle'));
const UserDashboard = lazy(() => import('@pages/UserDashboard'));
const AuthPage = lazy(() => import('@features/auth/ui/AuthPage'));

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
    <ErrorBoundary>
      <RouterProvider
        router={router}
        future={{ v7_startTransition: true }}
        fallbackElement={<p>Загрузка...</p>}
      />
    </ErrorBoundary>
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
    '/albums',
    '/albums/:albumId',
    '/articles',
    '/articles/:articleId',
    '/help/articles/:articleId',
    '/forms',
    '/stems',
    '/dashboard',
    '/dashboard/:tab',
    '/auth',
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
          path="/albums"
          element={
            <Suspense fallback={<PageLoader />}>
              <AllAlbums />
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
          path="/articles"
          element={
            <Suspense fallback={<PageLoader />}>
              <AllArticles />
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
        <Route
          path="/help/articles/:articleId"
          element={
            <Suspense fallback={<PageLoader />}>
              <HelpArticlePage />
            </Suspense>
          }
        />
        <Route
          path="/dashboard"
          element={
            <Suspense fallback={<PageLoader />}>
              <UserDashboard />
            </Suspense>
          }
        />
        <Route
          path="/dashboard/:tab"
          element={
            <Suspense fallback={<PageLoader />}>
              <UserDashboard />
            </Suspense>
          }
        />
        <Route
          path="/auth"
          element={
            <Suspense fallback={<PageLoader />}>
              <AuthPage />
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
        <ErrorBoundary>
          <main>{notFoundRoutes}</main>
        </ErrorBoundary>
      ) : (
        <ErrorBoundary>
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

            <ErrorBoundary>{standardRoutes}</ErrorBoundary>
          </main>
          <Footer />
          <PlayerShell />
        </ErrorBoundary>
      )}
    </>
  );
}
