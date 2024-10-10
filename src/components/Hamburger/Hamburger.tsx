import React from "react";
import { HamburgerProps } from "../../models";

/**
 * Компонент отображает гамбургер-меню.
 */
export default function Hamburger({
  isActive,
  onShow,
  classes,
  zIndex,
}: HamburgerProps) {
  return (
    <div className={`b-hamburger ${classes?.hide}`}>
      <div
        className={`b-hamburger__toggle ${isActive ? "active" : null}`}
        onClick={onShow}
        style={{ zIndex: zIndex }}
      >
        <div className="one"></div>
        <div className="two"></div>
        <div className="three"></div>
      </div>
    </div>
  );
}
