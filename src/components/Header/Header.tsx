import React from "react";
import { Link } from "react-router-dom";
import Navigation from "../Navigation/Navigation";
import "./style.scss";

export default function Header() {
  return (
    <>
      <header role="banner">
        <div className="row">
          <div className="column">
            <div className="header-content">
              <Link className="logo" to="/">
                Home
              </Link>

              <Navigation classes={{ hide: "hide-for-medium-down" }} />
            </div>
          </div>
        </div>
      </header>
    </>
  );
}
