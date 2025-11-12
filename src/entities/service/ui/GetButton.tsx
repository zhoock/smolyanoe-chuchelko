import type { String } from '@models';

export function GetButton({ buttonClass, buttonUrl, buttonText }: String) {
  if (!buttonUrl) return null;

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

export default GetButton;
