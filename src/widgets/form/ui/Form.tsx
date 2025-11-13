// src/widgets/form/ui/Form.tsx
import './style.scss';

export function Form() {
  return (
    <section className="form main-background" aria-label="Блок c формой">
      <div className="wrapper">
        <h2>Заявка</h2>
        <form id="new-album" className="form__wrapper" action="" method="POST">
          <label className="item" htmlFor="artist">
            Название группы
          </label>
          <input
            className="input item"
            id="artist"
            type="text"
            name="artist"
            placeholder="Название группы"
            required
            autoFocus
          />
          <label className="item" htmlFor="album">
            Название альбома
          </label>
          <input
            className="input item"
            id="album"
            type="text"
            name="album"
            placeholder="Название альбома"
            required
          />
          <label className="item" htmlFor="date">
            Дата выхода альбома
          </label>
          <input
            className="input item"
            id="date"
            type="number"
            name="date"
            placeholder="Дата"
            required
          />
          <label className="item" htmlFor="cover">
            Обложка альбома
          </label>
          <input
            className="file-selector item"
            id="cover"
            type="file"
            accept="image/jpeg"
            name="date"
            required
          />
          <fieldset>
            <label>
              <input className="visually-hidden" type="radio" name="answer" />
              <span></span>
              Да
            </label>

            <label>
              <input className="visually-hidden" type="radio" name="answer" />
              <span></span>
              Нет
            </label>

            <label>
              <input className="visually-hidden" type="radio" name="answer" />
              <span></span>
              Не знаю
            </label>
          </fieldset>
          <fieldset>
            <label>
              <input className="visually-hidden" type="checkbox" name="music-style" />
              <span></span>
              Punk
            </label>

            <label>
              <input className="visually-hidden" type="checkbox" name="music-style" />
              <span></span>
              Grunge
            </label>

            <label>
              <input className="visually-hidden" type="checkbox" name="music-style" />
              <span></span>
              Alternative rock
            </label>
          </fieldset>
          <fieldset>
            <div className="select-container">
              <select name="cartoon">
                <option value="">История игрушек</option>
                <option value="">Мулан</option>
                <option value="">Король Лев</option>
              </select>
            </div>
          </fieldset>
          <fieldset>
            <div className="select-container">
              <select name="cartoon">
                <option value="">История игрушек</option>
                <option value="">Мулан</option>
                <option value="">Король Лев</option>
              </select>
            </div>
          </fieldset>
          <input type="range" min="20" max="50" step="10" />
          <p>
            Значение: <span>15</span>
          </p>
          <button className="item-type-a" type="submit">
            Отправить заявку
          </button>
        </form>
      </div>
    </section>
  );
}

export default Form;
