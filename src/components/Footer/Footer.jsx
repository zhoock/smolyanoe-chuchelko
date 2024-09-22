export default function Footer() {
  const socialNetwork = [
    {
      name: "youtube",
      href: "https://www.youtube.com/channel/UC1Ok67ewgn1Wg2PF42rDxoA/",
    },
    {
      name: "instagram",
      href: "https://www.instagram.com/smolyanoechuchelko/",
    },
    {
      name: "facebook",
      href: "https://www.facebook.com/smolyanoechuchelko/",
    },
    {
      name: "vk",
      href: "https://vk.com/smolyanoechuchelko",
    },
  ];

  return (
    <footer role="contentinfo">
      <div className="row">
        <div className="small-12 column">
          <ul className="b-social-networks">
            {socialNetwork.map((item, i) => (
              <li key={i}>
                <a className={`icon-${item.name}`} href={item.href}>
                  <span>{item.name}</span>
                </a>
              </li>
            ))}
          </ul>
          <ul className="b-copyright">
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
