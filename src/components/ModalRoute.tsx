// src/ModalRoute.tsx

import React from 'react';
import { useNavigate } from 'react-router-dom';
import Popup from './Popup/Popup';
import Hamburger from './Hamburger/Hamburger';

export default function ModalRoute({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const onClose = () => navigate(-1);

  return (
    <Popup isActive={true} onClose={onClose}>
      {children}
      <Hamburger isActive={true} onToggle={onClose} />
    </Popup>
  );
}
