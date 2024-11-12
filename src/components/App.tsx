import React from "react";
import { Outlet, createBrowserRouter, RouterProvider } from "react-router-dom";

import Header from "./Header/Header";
import Footer from "./Footer/Footer";
import Albums from "./Albums/Albums";

import Form from "./Form/Form";
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
        path: "/form/",
        element: <Form />,
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
      <Header />
      <Outlet />
      <Footer />
    </>
  );
}
