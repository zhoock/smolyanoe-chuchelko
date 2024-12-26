import React from 'react';
import { PopupProps } from '../../models';

import './style.scss';

export default function Popup({ children, isActive, classes }: PopupProps) {
  return (
    <div className={`popup ${isActive ? 'popup_open' : null} ${classes?.hide}`}>
      {children}
    </div>
  );
}
