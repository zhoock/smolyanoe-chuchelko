import React from 'react';
import { PopupProps } from '../../models';
import './style.scss';

export default function Popup({ children, isActive }: PopupProps) {
  return (
    <div className={`popup ${isActive ? 'popup_open' : ''} `}>{children}</div>
  );
}
