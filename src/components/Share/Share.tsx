import React, { useState, MouseEvent } from "react";
import "./style.scss";

export default function Share() {
  const [share, setShare] = useState(false);

  function handleClick(e: MouseEvent<HTMLElement>) {
    e.preventDefault();
    setShare(!share);
  }

  return (
    <ul className="share js-share-item">
      <li onClick={handleClick}>
        <a
          className={`icon-share ${share ? "active" : null}`}
          href=""
          title="Поделиться"
        ></a>
      </li>
      <li className={share ? "show" : ""}>
        <a
          className="icon-facebook1"
          href="#"
          title="Поделиться на Facebook"
        ></a>
      </li>
      <li className={share ? "show" : ""}>
        <a className="icon-twitter" href="#" title="Поделиться на Twitter"></a>
      </li>
    </ul>
  );
}

// share

// function shareOnFacebook(uri: any) {
//   "this" == uri && (uri = window.location.href);
//   let base =
//     "https://www.facebook.com/sharer/sharer.php?u=" + encodeURIComponent(uri);
//   popUpWindow(base, "Share on Facebook", "464", "210", "no", "center");
// }

// function shareOnTwitter(uri: any) {
//   "this" == uri && (uri = window.location.href);
//   let base = "https://twitter.com/home?status=" + encodeURIComponent(uri);
//   popUpWindow(base, "Share on Twitter", "464", "210", "no", "center");
// }

// function popUpWindow(
//   mypage: any,
//   myname: any,
//   w: any,
//   h: any,
//   scroll: any,
//   pos: any,
// ) {
//   let LeftPosition,
//     TopPosition,
//     settings,
//     win = null;
//   if (pos == "center") {
//     LeftPosition = screen.width ? (screen.width - w) / 2 : 100;
//     TopPosition = screen.height ? (screen.height - h) / 2 : 100;
//   } else if ((pos != "center" && pos != "random") || pos == null) {
//     LeftPosition = 0;
//     TopPosition = 20;
//   }
//   settings =
//     "width=" +
//     w +
//     ",height=" +
//     h +
//     ",top=" +
//     TopPosition +
//     ",left=" +
//     LeftPosition +
//     ",scrollbars=" +
//     scroll +
//     ",location=no,directories=no,status=no,menubar=no,toolbar=no,resizable=no";
//   win = window.open(mypage, myname, settings);
// }

// // $(".js-share-item li:first-child").on("click", function (t) {
// //   t.preventDefault(), $(".js-share-item li").toggleClass("show");
// // });

// const link = document.querySelector(".js-share-item a");

// link &&
//   link.addEventListener("click", function (e) {
//     e.preventDefault();

//     link.classList.contains("icon-facebook1") && shareOnFacebook("this"),
//       link.classList.contains("icon-twitter") && shareOnTwitter("this");
//   });

// return link;
