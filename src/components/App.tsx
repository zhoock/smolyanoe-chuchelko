import React, { useState } from 'react';
import { Outlet, createBrowserRouter, RouterProvider } from 'react-router-dom';

import Header from './Header/Header';
import Footer from './Footer/Footer';
import Albums from './Albums/Albums';
import AboutUs from './AboutUs/AboutUs';
import Articles from './Articles/Articles';
import Article from './Articles/Article';
import Album from './Albums/Album';
import NotFoundPage from './NotFoundPage';
import Hamburger from './Hamburger/Hamburger';
import Navigation from './Navigation/Navigation';
import Popup from './Popup/Popup';

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    errorElement: <NotFoundPage />,
    children: [
      {
        index: true,
        element: <Albums />,
      },
      {
        path: '/albums',
        element: <Albums />,
      },
      {
        path: '/albums/:albumId',
        element: <Album />,
      },
      {
        path: '/aboutus/',
        element: <AboutUs />,
      },
      {
        path: '/articles',
        element: <Articles />,
      },
      {
        path: '/articles/:articleId',
        element: <Article />,
      },
    ],
  },
]);

export default function App() {
  return (
    <RouterProvider router={router} fallbackElement={<p>Загрузка...</p>} />
  );
}

function Layout() {
  const [popup, setPopup] = useState(false);

  return (
    <>
      <Header />
      <main>
        <section className="hero">
          <h1>Cмоляное чучелко</h1>
        </section>

        {/* если поместим popup внурь header, то popup будет обрезаться из-за css-фильтра (filter) внури header */}
        <Popup isActive={popup} classes={{ hide: 'hide-for-large-up' }}>
          <Navigation onToggle={() => setPopup(!popup)} />
        </Popup>
        <Hamburger
          classes={{ hide: 'hide-for-large-up' }}
          isActive={popup}
          onToggle={() => setPopup(!popup)}
        />
        <Outlet />
      </main>
      <Footer />
    </>
  );
}
