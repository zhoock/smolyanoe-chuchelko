import Header from "./Header/Header.jsx";
import Footer from "./Footer/Footer.jsx";
import AboutUs from "./AboutUs/AboutUs.jsx";
import Albums from "./Albums/Albums.jsx";
import { useState } from "react";

export default function App() {
  const [nameAlbum, setNameAlbum] = useState(null);
  const [showAlbum, setShowAlbum] = useState(null);

  function handleCoverClick(e) {
    setNameAlbum(e.target.innerHTML);
    setShowAlbum((showAlbum) => !showAlbum);
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
