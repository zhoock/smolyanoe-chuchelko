/**
 * Компонент для отображения статуса "Заявка на рассмотрении"
 */

import React from 'react';
import './MusicianStatusPending.style.scss';

export function MusicianStatusPending() {
  return (
    <div className="musician-status-pending">
      <div className="musician-status-pending__icon">⏳</div>
      <h2 className="musician-status-pending__title">Заявка на рассмотрении</h2>
      <p className="musician-status-pending__description">
        Ваша заявка на статус музыканта находится на рассмотрении. Мы свяжемся с вами после принятия
        решения.
      </p>
    </div>
  );
}
