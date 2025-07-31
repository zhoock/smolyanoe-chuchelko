import React, { useState, MouseEvent } from 'react';

import './style.scss';

export default function Share() {
  const [share, setShare] = useState(false);

  function handleClick(e: MouseEvent<HTMLElement>) {
    e.preventDefault();
    setShare(!share);
  }

  function handleShareClick(platform: 'facebook' | 'twitter', uri: string) {
    if (uri === 'this') {
      uri = window.location.href;
    }

    if (platform === 'facebook') {
      const base = 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(uri);
      popUpWindow(base, 'Share on Facebook', 464, 210, 'no', 'center');
    } else if (platform === 'twitter') {
      const base = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(uri);
      popUpWindow(base, 'Share on Twitter', 464, 210, 'no', 'center');
    }
  }

  function popUpWindow(
    mypage: string,
    myname: string,
    w: number,
    h: number,
    scroll: string,
    pos: string
  ) {
    let LeftPosition = 0;
    let TopPosition = 0;

    if (pos === 'center') {
      LeftPosition = screen.width ? (screen.width - w) / 2 : 100;
      TopPosition = screen.height ? (screen.height - h) / 2 : 100;
    } else if (pos !== 'center' && pos !== 'random') {
      LeftPosition = 0;
      TopPosition = 20;
    }

    const settings =
      `width=${w},height=${h},top=${TopPosition},left=${LeftPosition},scrollbars=${scroll},` +
      'location=no,directories=no,status=no,menubar=no,toolbar=no,resizable=no';

    window.open(mypage, myname, settings);
  }

  return (
    <ul className="share-list js-share-item">
      <li className="share-list__item" onClick={handleClick}>
        <a
          className={`share-list__link icon-share ${share ? 'active' : ''}`}
          href="#"
          title="Поделиться"
        ></a>
      </li>
      <li className={`share-list__item ${share ? 'show' : ''}`}>
        <a
          className="share-list__link icon-facebook1"
          href="#"
          title="Поделиться на Facebook"
          onClick={() => handleShareClick('facebook', 'this')}
        ></a>
      </li>
      <li className={`share-list__item ${share ? 'show' : ''}`}>
        <a
          className="share-list__link icon-twitter"
          href="#"
          title="Поделиться на Twitter"
          onClick={() => handleShareClick('twitter', 'this')}
        ></a>
      </li>
    </ul>
  );
}
