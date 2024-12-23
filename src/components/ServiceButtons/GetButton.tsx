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
    <li>
      <a className={buttonClass} href={buttonUrl}>
        <span className="visually-hidden">{buttonText}</span>
      </a>
    </li>
  );
}
