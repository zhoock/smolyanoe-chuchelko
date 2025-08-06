import React, { useState } from 'react';
import { Outlet, createBrowserRouter, RouterProvider } from 'react-router-dom';

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
      {
        path: '/forms',
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
        <Outlet />
      </main>
      <Footer />
    </>
  );
}
