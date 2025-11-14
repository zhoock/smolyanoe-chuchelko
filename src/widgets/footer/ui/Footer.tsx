import { useEffect } from 'react';
import { useLang } from '@app/providers/lang';
import { useAppDispatch } from '@shared/lib/hooks/useAppDispatch';
import { useAppSelector } from '@shared/lib/hooks/useAppSelector';
import {
  fetchUiDictionary,
  selectUiDictionaryStatus,
  selectUiDictionaryFirst,
} from '@shared/model/uiDictionary';
import './style.scss';

const socialNetwork = [
  { id: 1, name: 'youtube', href: 'https://www.youtube.com/channel/UC1Ok67ewgn1Wg2PF42rDxoA/' },
  { id: 2, name: 'instagram', href: 'https://www.instagram.com/smolyanoechuchelko/' },
  { id: 3, name: 'facebook', href: 'https://www.facebook.com/smolyanoechuchelko/' },
  { id: 4, name: 'vk', href: 'https://vk.com/smolyanoechuchelko' },
];

const supportLink = (label: string) => <a href="mailto:feedback@smolyanoechuchelko.ru">{label}</a>;

export function Footer() {
  const dispatch = useAppDispatch();
  const { lang } = useLang();
  const status = useAppSelector((state) => selectUiDictionaryStatus(state, lang));
  const ui = useAppSelector((state) => selectUiDictionaryFirst(state, lang));

  useEffect(() => {
    if (status === 'idle' || status === 'failed') {
      const promise = dispatch(fetchUiDictionary({ lang }));
      return () => {
        promise.abort();
      };
    }
  }, [dispatch, lang, status]);

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
            <small>{supportLink(ui?.titles?.support ?? 'Поддержка')}</small>
          </li>
        </ul>
      </div>
    </footer>
  );
}

export default Footer;
