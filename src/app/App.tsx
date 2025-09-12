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
} from '@components';
import Albums from '../pages/Albums/Albums';
import Album from '../pages/Album/Album';
import NotFoundPage from '../components/NotFoundPage/404';
import Form from '../components/Forms/Form';
import Hero from '../components/Hero/Hero';
import TrackLyrics from '../components/AlbumTracks/TrackLyrics';

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

  const { lang } = useLang();
  const { revalidate } = useRevalidator();
  useEffect(() => {
    if (currentLang !== lang) {
      // ← дергаем только когда язык реально сменился+
      setCurrentLang(lang);
      revalidate();
    }
  }, [lang, revalidate]);

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
