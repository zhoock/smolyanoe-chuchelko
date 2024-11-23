import React from "react";
import { Outlet, createBrowserRouter, RouterProvider } from "react-router-dom";

import Header from "./Header/Header";
import Footer from "./Footer/Footer";
import Albums from "./Albums/Albums";
import AboutUs from "./AboutUs/AboutUs";
import Articles from "./Articles/Articles";
import Article from "./Articles/Article";
import Album from "./Albums/Album";
import NotFoundPage from "./NotFoundPage";

const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    errorElement: <NotFoundPage />,
    children: [
      {
        index: true,
        element: <Albums />,
      },
      {
        path: "/albums/:albumId",
        element: <Album />,
      },
      {
        path: "/aboutus/",
        element: <AboutUs />,
      },
      {
        path: "/articles",
        element: <Articles />,
      },
      {
        path: "/articles/:articleId",
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
  return (
    <>
      <div className="overlay"></div>
      <Header />
      <div className="column row">
        <h1>Смоляное Чучелко</h1>
      </div>
      <Outlet />
      <Footer />
    </>
  );
}
