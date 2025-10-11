// src/components/ServiceButtons/GetButton.tsx
import { String } from '../../models';

/**
 * Компонент отображает кнопку-ссылку агрегатора.
 */
export default function GetButton({ buttonClass, buttonUrl, buttonText }: String) {
  if (!buttonUrl) return null; // не рендерим пустую кнопку
  return (
    <li className="service-buttons__list-item">
      <a
        className={`service-buttons__link ${buttonClass}`}
        href={buttonUrl}
        target="_blank"
        rel="noopener noreferrer"
      >
        <span className="visually-hidden">{buttonText}</span>
      </a>
    </li>
  );
}
