import { useAlbumsData } from '@shared/api/albums';
import { DataAwait } from '@shared/DataAwait';
import { useLang } from '@contexts/lang';
import './style.scss';

const socialNetwork = [
  { id: 1, name: 'youtube', href: 'https://www.youtube.com/channel/UC1Ok67ewgn1Wg2PF42rDxoA/' },
  { id: 2, name: 'instagram', href: 'https://www.instagram.com/smolyanoechuchelko/' },
  { id: 3, name: 'facebook', href: 'https://www.facebook.com/smolyanoechuchelko/' },
  { id: 4, name: 'vk', href: 'https://vk.com/smolyanoechuchelko' },
];

const supportLink = (label: string) => <a href="mailto:feedback@smolyanoechuchelko.ru">{label}</a>;

export function Footer() {
  const { lang } = useLang();
  const data = useAlbumsData(lang);

  return (
    <footer role="contentinfo" className="footer extra-background">
      <div className="wrapper">
        <ul className="social-networks-list">
          {socialNetwork.map((item) => (
            <li className="social-networks-list__item" key={item.id}>
              <a
                className={`social-networks__link icon-${item.name}`}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="visually-hidden">{item.name}</span>
              </a>
            </li>
          ))}
        </ul>

        <ul className="copyright-list">
          <li className="copyright-list__item">
            <small>
              <span>© 2021—2025 Смоляное чучелко</span>
            </small>
          </li>
          <li>
            <small>
              {data ? (
                <DataAwait value={data.templateC} fallback={supportLink('Поддержка')} error={null}>
                  {(ui) => supportLink(ui?.[0]?.titles?.support ?? 'Поддержка')}
                </DataAwait>
              ) : (
                supportLink('Поддержка')
              )}
            </small>
          </li>
        </ul>
      </div>
    </footer>
  );
}

export default Footer;
