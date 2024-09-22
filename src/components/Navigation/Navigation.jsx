export default function Navigation({ classes, onShow }) {
  return (
    <ul className={`b-menu ${classes ? classes.hide : null}`}>
      <li>
        <a href="#" title="Главная" onClick={onShow}>
          Главная
        </a>
      </li>
      <li>
        <a href="#" title="Статьи" onClick={onShow}>
          Статьи
        </a>
      </li>
    </ul>
  );
}
