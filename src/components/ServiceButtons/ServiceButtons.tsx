import React from 'react';
import GetButton from './GetButton';
import { String } from '../../models';
import { IAlbums } from '../../models';

import './style.scss';

/**
 * Компонент отображает блоки с кнопками-ссылками музыкальных агрегаторов.
 */
export default function ServiceButtonsPurchase({
  album,
  section,
}: {
  album: IAlbums;
  section: string;
}) {
  /**
   * Компонент отображает блок с кнопками-ссылками на агрегаторы.
   */
  function Block({
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
  }: String) {
    return (
      <div className="service-buttons">
        <h3>{section}</h3>
        {section === 'Купить' && (
          <ul
            className="service-buttons__list"
            aria-label="Блок со ссылками на платные музыкальные агрегаторы"
          >
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
        {section === 'Слушать' && (
          <ul
            className="service-buttons__list"
            aria-label="Блок со ссылками на бесплатные музыкальные агрегаторы"
          >
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

  // оператор расширения или распространения (spread-оператор) ...
  return <Block {...album?.buttons} />;
}
