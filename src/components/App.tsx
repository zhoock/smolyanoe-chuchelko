import React, { useState } from 'react';
import {
  Outlet,
  createBrowserRouter,
  RouterProvider,
  useLocation,
  Routes,
  Route,
} from 'react-router-dom';

import Header from './Header/Header';
import Footer from './Footer/Footer';
import Albums from './Albums/Albums';
import AboutUs from './AboutUs/AboutUs';
import Articles from './Articles/Articles';
import Article from './Articles/Article';
import Album from './Albums/Album';
import NotFoundPage from './NotFoundPage/404';
import Hamburger from './Hamburger/Hamburger';
import Navigation from './Navigation/Navigation';
import Popup from './Popup/Popup';
import Form from './Forms/Form';
import Hero from './Hero/Hero';
import TrackLyrics from './AlbumTracks/TrackLyrics';
import ModalRoute from './ModalRoute';

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

  // === background location для модалки трека ===
  const location = useLocation();
  const background = location.state?.background;

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

        {/* Если НЕТ background — рендерим обычное дерево через Outlet */}
        {!background && <Outlet />}

        {/* Если ЕСТЬ background — рендерим фон ПО background-локации */}
        {background && (
          <Routes location={background}>
            {/* Минимальный набор страниц, которые могут быть фоном под модалкой */}
            <Route path="/albums/:albumId" element={<Album />} />
          </Routes>
        )}

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
