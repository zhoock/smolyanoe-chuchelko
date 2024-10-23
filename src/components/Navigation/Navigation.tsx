import React from "react";
import { NavLink } from "react-router-dom";
import { NavigationProps } from "../../models";
import "./style.scss";

export default function Navigation({ classes, onShow }: NavigationProps) {
  return (
    <ul className={`b-menu ${classes ? classes.hide : null}`}>
      <li>
        <NavLink
          to="/aboutus"
          title="О группе"
          onClick={onShow}
          className={({ isActive }) => {
            return isActive ? "active" : "";
          }}
        >
          О группе
        </NavLink>
      </li>
      <li>
        <NavLink to="/articles" title="Статьи" onClick={onShow}>
          Статьи
        </NavLink>
      </li>
    </ul>
  );
}
