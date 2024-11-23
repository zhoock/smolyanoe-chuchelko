import React, { useState } from "react";
import { Link } from "react-router-dom";
import Hamburger from "../Hamburger/Hamburger";
import Navigation from "../Navigation/Navigation";
import Popup from "../Popup/Popup";
import "./style.scss";

export default function Header() {
  const [popup, setPopup] = useState(false);

  return (
    <>
      <header role="banner">
        <div className="row">
          <div className="column">
            <div className="header-content">
              <Link className="logo" to="/">
                Home
              </Link>
              <nav role="navigation">
                <Navigation classes={{ hide: "hide-for-medium-down" }} />
              </nav>
            </div>
          </div>
        </div>
      </header>

      {/* если поместим popup внурь header, то popup будет обрезаться из-за css-фильтра (filter) внури header */}
      <Popup isActive={popup} classes={{ hide: "hide-for-large-up" }}>
        <nav role="navigation">
          <Navigation onToggle={() => setPopup(!popup)} />
        </nav>
      </Popup>
      <Hamburger
        classes={{ hide: "hide-for-large-up" }}
        isActive={popup}
        onToggle={() => setPopup(!popup)}
      />
    </>
  );
}
