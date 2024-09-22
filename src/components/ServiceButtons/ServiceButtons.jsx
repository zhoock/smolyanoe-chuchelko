import { ALBUMSDATA } from "../data.js";

/**
 * Компонент отображает блоки с кнопками-ссылками музыкальных агрегаторов.
 * @component
 * @param {string} nameAlbum - Название альбома.
 * @param {string} section - Название раздела.
 */
export default function ServiceButtonsPurchase({ nameAlbum, section }) {
  // деструктуризация
  const { buttons } = ALBUMSDATA.filter(
    (element) => element.nameAlbum === nameAlbum,
  )[0];
  // alert(JSON.stringify(AlbumButtons[0].buttons));

  /**
   * Компонент отображает кнопку-ссылку агрегатора.
   * @param {string} buttonClass
   * @param {string} buttonUrl
   * @param {string} buttonText
   */
  function GetButton({ buttonClass, buttonUrl, buttonText }) {
    return (
      <li>
        <a className={buttonClass} href={buttonUrl}>
          <span>{buttonText}</span>
        </a>
      </li>
    );
  }

  /**
   * Компонент отображает блок с кнопками-ссылками на агрегаторы.
   * @component
   * @param {Object[]} buttons - Объект c ссылками на агрегаторы.
   */
  function Buttons({
    itunes,
    bandcamp,
    amazon,
    apple,
    vk,
    youtube,
    spotify,
    yandex,
    deezer,
    tidal,
  }) {
    return (
      <div className="b-service-buttons">
        <h3>{section}</h3>
        {section === "Купить" && (
          <ul>
            <GetButton
              buttonClass="icon-applemusic"
              buttonUrl={itunes}
              buttonText="iTunes"
            />
            <GetButton
              buttonClass="icon-bandcamp"
              buttonUrl={bandcamp}
              buttonText="Bandcamp"
            />
            <GetButton
              buttonClass="icon-amazon"
              buttonUrl={amazon}
              buttonText="Amazon"
            />
          </ul>
        )}
        {section === "Слушать" && (
          <ul>
            <GetButton
              buttonClass="icon-apple"
              buttonUrl={apple}
              buttonText="Apple music"
            />
            <GetButton
              buttonClass="icon-vk"
              buttonUrl={vk}
              buttonText="ВКонтакте"
            />
            <GetButton
              buttonClass="icon-youtube1"
              buttonUrl={youtube}
              buttonText="YouTube"
            />
            <GetButton
              buttonClass="icon-spotify"
              buttonUrl={spotify}
              buttonText="YoSpotifyuTube"
            />
            <GetButton
              buttonClass="icon-yandex"
              buttonUrl={yandex}
              buttonText="Yandex"
            />
            <GetButton
              buttonClass="icon-deezer"
              buttonUrl={deezer}
              buttonText="Deezer"
            />
            <GetButton
              buttonClass="icon-tidal"
              buttonUrl={tidal}
              buttonText="Tidal"
            />
          </ul>
        )}
      </div>
    );
  }

  return buttons.map((data) => <Buttons {...data} key={data} />);
}
