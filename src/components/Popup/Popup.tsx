import React from "react";
import { PopupProps } from "../../models";
import "./style.scss";

export default function Popup({ children, isActive, classes }: PopupProps) {
  
  return (
    <div
      className={`b-popup ${isActive ? "b-popup--open" : null} ${classes?.hide}`}
    >
      {children}
    </div>
  );
}
