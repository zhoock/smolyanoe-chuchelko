/**
 * Компонент отображает popup.
 * @component
 * @param {Object} children - Дочерние компоненты.
 * @param {boolean} isActive - Булево значение.
 * @param {Object} classes - Принимает классы css.
 */
export default function Popup({ children, isActive, classes }) {
  return (
    <div
      className={`b-popup ${isActive ? "b-popup--open" : null} ${classes?.hide}`}
    >
      {children}
    </div>
  );
}
