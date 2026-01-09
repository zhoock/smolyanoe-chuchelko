import { Suspense, lazy, useEffect } from 'react';
import { createBrowserRouter, RouterProvider, Outlet } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { albumsLoader } from '@routes/loaders/albumsLoader';
import { useLang } from '@app/providers/lang';
import { ErrorBoundary } from '@shared/ui/error-boundary';
import { NotFoundPage } from '@widgets/notFound';
import { Form } from '@widgets/form';
import SocialLanding from '@pages/SocialLanding';
import { ProfileLayout } from './layouts/ProfileLayout';

const Album = lazy(() => import('@pages/Album/Album'));
const AllAlbums = lazy(() => import('@pages/AllAlbums'));
const AllArticles = lazy(() => import('@pages/AllArticles'));
const StemsPlayground = lazy(() => import('@pages/StemsPlayground/StemsPlayground'));
const Home = lazy(() => import('@pages/Home'));
const ArticlePage = lazy(() => import('@pages/Article'));
const HelpArticlePage = lazy(() => import('@pages/HelpArticle'));
const OfferPage = lazy(() => import('@pages/Offer'));
const UserDashboard = lazy(() => import('@pages/UserDashboard/UserDashboard'));
const AuthPage = lazy(() => import('@features/auth/ui/AuthPage'));
const PaymentSuccess = lazy(() => import('@pages/PaymentSuccess/PaymentSuccess'));
const AdminMusicianModeration = lazy(() => import('@pages/AdminMusicianModeration'));

const PageLoader = () => <p>Загрузка...</p>;

function withSuspense(node: React.ReactNode) {
  return <Suspense fallback={<PageLoader />}>{node}</Suspense>;
}

function RootLayout() {
  const { lang } = useLang() as { lang: 'ru' | 'en' };

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  return (
    <>
      <Helmet>
        <title>Смоляное чучелко — социальная сеть для музыкантов</title>
        <meta
          name="description"
          content="Загружайте музыку, делитесь историями и поддерживайте любимых артистов на смоляноеchuchelko.ru"
        />
        <meta name="color-scheme" content="dark light" />
      </Helmet>
      <Outlet />
    </>
  );
}

const router = createBrowserRouter([
  {
    element: <RootLayout />,
    errorElement: <NotFoundPage />,
    children: [
      {
        index: true,
        element: <SocialLanding />,
      },
      {
        path: 'auth',
        element: withSuspense(<AuthPage />),
      },
      {
        path: 'forms',
        element: <Form />,
      },
      {
        path: 'offer',
        element: withSuspense(<OfferPage />),
      },
      {
        path: 'admin/musician-moderation',
        element: withSuspense(<AdminMusicianModeration />),
      },
      {
        path: 'pay/success',
        element: withSuspense(<PaymentSuccess />),
      },
      {
        path: 'pay/fail',
        element: withSuspense(<PaymentSuccess />),
      },
      {
        path: ':username',
        loader: albumsLoader,
        element: <ProfileLayout />,
        children: [
          {
            index: true,
            element: withSuspense(<Home />),
          },
          {
            path: 'albums',
            element: withSuspense(<AllAlbums />),
          },
          {
            path: 'albums/:albumId',
            element: withSuspense(<Album />),
          },
          {
            path: 'posts',
            element: withSuspense(<AllArticles />),
          },
          {
            path: 'posts/:articleId',
            element: withSuspense(<ArticlePage />),
          },
          {
            path: 'help/:articleId',
            element: withSuspense(<HelpArticlePage />),
          },
          {
            path: 'store',
            element: withSuspense(<OfferPage />),
          },
          {
            path: 'dashboard',
            element: withSuspense(<UserDashboard />),
          },
          {
            path: 'dashboard/:tab',
            element: withSuspense(<UserDashboard />),
          },
          {
            path: 'stems',
            element: withSuspense(<StemsPlayground />),
          },
        ],
      },
    ],
  },
]);

export default function App() {
  return (
    <ErrorBoundary>
      <RouterProvider router={router} fallbackElement={<PageLoader />} />
    </ErrorBoundary>
  );
}
