import React from "react";
import "./style.scss";

export default function Footer() {
  const socialNetwork = [
    {
      id: 1,
      name: "youtube",
      href: "https://www.youtube.com/channel/UC1Ok67ewgn1Wg2PF42rDxoA/",
    },
    {
      id: 2,
      name: "instagram",
      href: "https://www.instagram.com/smolyanoechuchelko/",
    },
    {
      id: 3,
      name: "facebook",
      href: "https://www.facebook.com/smolyanoechuchelko/",
    },
    {
      id: 4,
      name: "vk",
      href: "https://vk.com/smolyanoechuchelko",
    },
  ];

  return (
    <footer role="contentinfo">
      <div className="row">
        <div className="column">
          <ul className="social-networks">
            {socialNetwork.map((item) => (
              <li key={item.id}>
                <a className={`icon-${item.name}`} href={item.href}>
                  <span>{item.name}</span>
                </a>
              </li>
            ))}
          </ul>
          <ul className="copyright">
            <li>
              <small>
                <span>© 2021—2024 Смоляное чучелко</span>
              </small>
            </li>
            <li>
              <small>
                <a href="mailto:feedback@smolyanoechuchelko.ru">Поддержка</a>
              </small>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
