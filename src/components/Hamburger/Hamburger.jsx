/**
 * Компонент отображает гамбургер-меню.
 * @component
 * @param {boolean} isActive - Булево значение.
 * @param {function} onShow - Открывает/закрывает popup.
 * @param {Object} classes - Принимает классы css.
 */
export default function Hamburger({ isActive, onShow, classes, zIndex }) {

  return (
    <div className={`b-hamburger ${classes?.hide}`}>
      <div
        className={`b-hamburger__toggle ${isActive ? "active" : null}`}
        onClick={onShow}
        style={{ zIndex: zIndex }}
      >
        <div className="one"></div>
        <div className="two"></div>
        <div className="three"></div>
      </div>
    </div>
  );
}
