import React, { useState } from "react";
import { Link } from "react-router-dom";
import Hamburger from "../Hamburger/Hamburger";
import Navigation from "../Navigation/Navigation";
import Popup from "../Popup/Popup";

export default function Header() {
  const [activeIndex, setActiveIndex] = useState(false);

  function handleClick() {
    setActiveIndex(!activeIndex);
  }

  return (
    <>
      <header role="banner">
        <div className="row">
          <div className="small-12 small-centered column">
            <div className="b-header-content">
              <Link className="logo" to="/">
                СМОЛЯНОЕ ЧУЧЕЛКО
              </Link>
              <nav role="navigation">
                <Navigation classes={{ hide: "hide-for-medium-down" }} />
              </nav>
            </div>
          </div>
        </div>

        <div className="b-header-img">
          <h1></h1>
        </div>
      </header>

      {/* если поместим popup внурь header, то popup будет обрезаться из-за css-фильтра (filter) внури header */}
      <Popup isActive={activeIndex} classes={{ hide: "hide-for-large-up" }}>
        <nav role="navigation">
          <Navigation onShow={handleClick} />
        </nav>
      </Popup>
      <Hamburger
        classes={{ hide: "hide-for-large-up" }}
        isActive={activeIndex}
        onShow={handleClick}
      />
    </>
  );
}
