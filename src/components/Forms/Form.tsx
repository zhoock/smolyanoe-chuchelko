import React from 'react';
import './style.scss';

export default function Form() {
  return (
    <section className="form theme-dark" aria-label="Блок c формой">
      <div className="wrapper">
        <h2>Заявка</h2>
        <form id="new-album" className="form__wrapper" action="" method="POST">
          <label className="item" htmlFor="nameGroup">
            Название группы
          </label>
          <input
            className="input item"
            id="nameGroup"
            type="text"
            name="nameGroup"
            placeholder="Название группы"
            required
            autoFocus
          />
          <label className="item" htmlFor="nameAlbum">
            Название альбома
          </label>
          <input
            className="input item"
            id="nameAlbum"
            type="text"
            name="nameAlbum"
            placeholder="Название альбома"
            required
          />
          <label className="item" htmlFor="date">
            Дата выхода
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
          <button className="item-type-a" type="submit">
            Отправить заявку
          </button>
        </form>
      </div>
    </section>
  );
}
