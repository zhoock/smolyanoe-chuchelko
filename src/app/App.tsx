import React, { useState } from 'react';
import {
  Outlet,
  createBrowserRouter,
  RouterProvider,
  useLocation,
  Routes,
  Route,
} from 'react-router-dom';

import { Header, Footer, AboutUs, Articles, Article } from '@components';
import Albums from '../pages/Albums/Albums';
import Album from '../pages/Album/Album';
import NotFoundPage from '../components/NotFoundPage/404';
import Hamburger from '../components/Hamburger/Hamburger';
import Navigation from '../components/Navigation/Navigation';
import Popup from '../components/Popup/Popup';
import Form from '../components/Forms/Form';
import Hero from '../components/Hero/Hero';
import TrackLyrics from '../components/AlbumTracks/TrackLyrics';
import ModalRoute from '../components/ModalRoute';

const router = createBrowserRouter([
  {
    path: '/', // корневой маршрут с Layout
    element: <Layout />,
    errorElement: <NotFoundPage />, // ок для 404 и ошибок
    children: [
      {
        index: true,
        element: <Albums />, // главная
      },
      {
        path: 'albums',
        element: <Albums />,
      },
      {
        path: 'albums/:albumId',
        element: <Album />,
      },
      { path: 'albums/:albumId/track/:trackId', element: <TrackLyrics /> }, // новый маршрут для текста трека
      {
        path: 'aboutus/',
        element: <AboutUs />,
      },
      {
        path: 'articles',
        element: <Articles />,
      },
      {
        path: 'articles/:articleId',
        element: <Article />,
      },
      {
        path: 'forms',
        element: <Form />,
      },
    ],
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

  return (
    <>
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
