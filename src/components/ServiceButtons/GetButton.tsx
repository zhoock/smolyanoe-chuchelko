import React from 'react';
import { String } from '../../models';

/**
 * Компонент отображает кнопку-ссылку агрегатора.
 */
export default function GetButton({
  buttonClass,
  buttonUrl,
  buttonText,
}: String) {
  return (
    <li className="service-buttons__list-item">
      <a
        className={`service-buttons__link ${buttonClass}`}
        href={buttonUrl}
        target="_blank"
      >
        <span className="visually-hidden">{buttonText}</span>
      </a>
    </li>
  );
}
