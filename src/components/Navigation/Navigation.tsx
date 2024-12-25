import React from "react";
import { NavLink } from "react-router-dom";
import { NavigationProps } from "../../models";
import "./style.scss";

export default function Navigation({ classes, onToggle }: NavigationProps) {
  return (
    <nav role="navigation" className={classes ? classes.hide : ""}>
      <ul className="menu">
        <li>
          <NavLink
            to="/albums"
            title="Альбомы"
            onClick={onToggle}
            className={({ isActive }) => {
              return isActive ? "active" : "";
            }}
          >
            Альбомы
          </NavLink>
        </li>
        <li>
          <NavLink
            to="/aboutus"
            title="О группе"
            onClick={onToggle}
            className={({ isActive }) => {
              return isActive ? "active" : "";
            }}
          >
            О группе
          </NavLink>
        </li>
        <li>
          <NavLink
            to="/articles"
            title="Статьи"
            onClick={onToggle}
            className={({ isActive }) => {
              return isActive ? "active" : "";
            }}
          >
            Статьи
          </NavLink>
        </li>
      </ul>
    </nav>
  );
}
