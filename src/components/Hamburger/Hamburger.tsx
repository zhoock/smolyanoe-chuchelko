import React from "react";
import { HamburgerProps } from "../../models";
import "./style.scss";

/**
 * Компонент отображает гамбургер-меню.
 */
export default function Hamburger({ isActive, onToggle, classes, zIndex }: HamburgerProps) {
  
  return (
    <div className={`hamburger ${classes?.hide}`}>
      <div
        className={`hamburger__toggle ${isActive ? "active" : null}`}
        onClick={onToggle}
        style={{ zIndex: zIndex }}
      >
        <div className="one"></div>
        <div className="two"></div>
        <div className="three"></div>
      </div>
    </div>
  );
}
