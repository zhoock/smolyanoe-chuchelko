import React from 'react';
import { PopupProps } from '../../models';
import './style.scss';

export default function Popup({ children, isActive, bgColor }: PopupProps) {
  return (
    <div
      className={`popup ${isActive ? 'popup_open' : ''} `}
      style={{ backgroundImage: bgColor }}
    >
      <div
        className="popup__gradient"
        style={{ backgroundImage: bgColor }}
      ></div>
      {children}
    </div>
  );
}
