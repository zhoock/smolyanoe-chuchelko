import React, { useState, MouseEvent } from "react";
import Header from "./Header/Header";
import Footer from "./Footer/Footer";
import AboutUs from "./AboutUs/AboutUs";
import Albums from "./Albums/Albums";

export default function App() {
  const [nameAlbum, setNameAlbum] = useState("");
  const [showAlbum, setShowAlbum] = useState(false);

  function handleCoverClick(e: MouseEvent<HTMLElement>) {
    setNameAlbum(e.currentTarget.innerHTML);
    setShowAlbum(!showAlbum);
  }

  return (
    <>
      <Header />
      {!showAlbum && <AboutUs />}

      <main role="main">
        <Albums
          nameAlbum={nameAlbum}
          showAlbum={showAlbum}
          handleCoverClick={handleCoverClick}
        />
      </main>

      <Footer />
    </>
  );
}
