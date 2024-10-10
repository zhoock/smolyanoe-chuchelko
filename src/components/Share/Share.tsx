import React, { useState, MouseEvent} from "react";

export default function Share() {
  const [share, setShare] = useState(false);

  function handleClick(e: MouseEvent<HTMLElement>) {
    e.preventDefault();
    setShare(!share);
  }

  return (
    <div className="b-share js-share-item">
      <ul>
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
          <a
            className="icon-twitter"
            href="#"
            title="Поделиться на Twitter"
          ></a>
        </li>
      </ul>
    </div>
  );
}

// // share
// TARBABY.share = function() {

//     function shareOnFacebook(e) {
//         "this" == e && (e = window.location.href);
//         var t = "https://www.facebook.com/sharer/sharer.php?u=" + encodeURIComponent(e);
//         popUpWindow(t, "Share on Facebook", "464", "210", "no", "center");
//     }

//     function shareOnTwitter(e) {
//         "this" == e && (e = window.location.href);
//         var t = "https://twitter.com/home?status=" + encodeURIComponent(e);
//         popUpWindow(t, "Share on Twitter", "464", "210", "no", "center");
//     }

//     function popUpWindow(e, t, n, o, a, i) {
//       "center" == i
//         ? ((LeftPosition = screen.width ? (screen.width - n) / 2 : 100),
//           (TopPosition = screen.height ? (screen.height - o) / 2 : 100))
//         : (("center" != i && "random" != i) || null == i) &&
//           ((LeftPosition = 0), (TopPosition = 20)),
//         (settings =
//           "width=" +
//           n +
//           ",height=" +
//           o +
//           ",top=" +
//           TopPosition +
//           ",left=" +
//           LeftPosition +
//           ",scrollbars=" +
//           a +
//           ",location=no,directories=no,status=no,menubar=no,toolbar=no,resizable=no"),
//         (win = window.open(e, t, settings));
//     }

//     $(".js-share-item li:first-child").on("click", function (t) {
//         t.preventDefault(),
//         $(".js-share-item li").toggleClass("show");
//     });

//     $(".js-share-item a").on("click", function (t) {
//         t.preventDefault();

//         $(this).hasClass("icon-facebook1") && shareOnFacebook("this"),
//         $(this).hasClass("icon-twitter") && shareOnTwitter("this");
//     });

//     return this;
// };
