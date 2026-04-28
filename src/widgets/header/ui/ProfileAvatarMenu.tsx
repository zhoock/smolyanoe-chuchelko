import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useLang } from '@app/providers/lang';
import { useAppSelector } from '@shared/lib/hooks/useAppSelector';
import { selectUiDictionaryFirst } from '@shared/model/uiDictionary';
import { clearAuth } from '@shared/lib/auth';
import { useStoredProfileAvatarUrl } from '@shared/lib/hooks/useAvatar';
import { IconLogOut, IconSettings, IconUpgradeSparkle } from './headerProfileMenuIcons';
import './profileAvatarMenu.scss';

export type ProfileAvatarMenuProps = {
  /** Когда меню языка в шапке открыто — закрываем дропдаун профиля */
  closeWhenLangMenuOpen?: boolean;
  /** Уведомление родителя при открытии/закрытии (например, закрыть язык при открытии профиля) */
  onOpenChange?: (open: boolean) => void;
  /** Дополнительный класс для img аватара (например модификатор главной) */
  avatarImgClassName?: string;
};

function ProfileAvatarMenuComponent({
  closeWhenLangMenuOpen = false,
  onOpenChange,
  avatarImgClassName,
}: ProfileAvatarMenuProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { lang } = useLang();
  const ui = useAppSelector((state) => selectUiDictionaryFirst(state, lang));
  const [menuOpen, setMenuOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const avatarSrc = useStoredProfileAvatarUrl();

  const dashboardLinkState = { backgroundLocation: location };

  const updateOpen = useCallback(
    (next: boolean) => {
      setMenuOpen(next);
      onOpenChange?.(next);
    },
    [onOpenChange]
  );

  useEffect(() => {
    if (closeWhenLangMenuOpen) updateOpen(false);
  }, [closeWhenLangMenuOpen, updateOpen]);

  useEffect(() => {
    const onDocMouseDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (wrapRef.current && !wrapRef.current.contains(t)) updateOpen(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [updateOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') updateOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen, updateOpen]);

  const toggleMenu = useCallback(() => {
    updateOpen(!menuOpen);
  }, [menuOpen, updateOpen]);

  const handleLogout = useCallback(() => {
    updateOpen(false);
    clearAuth();
    navigate('/');
  }, [navigate, updateOpen]);

  const avatarLabels = ui?.header?.avatarMenu;

  return (
    <div className="header__profile-wrap" ref={wrapRef}>
      <button
        type="button"
        className="header__profile"
        onClick={toggleMenu}
        aria-label={ui?.header?.openProfile ?? 'Account menu'}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
      >
        <img
          className={['header__profile-avatar', avatarImgClassName].filter(Boolean).join(' ')}
          src={avatarSrc}
          alt=""
          width={36}
          height={36}
          decoding="async"
        />
      </button>
      {menuOpen ? (
        <div
          className="header__profile-menu"
          role="menu"
          aria-label={ui?.header?.openProfile ?? 'Account'}
        >
          <Link
            className="header__profile-menu-item"
            role="menuitem"
            to="/dashboard-new/profile"
            state={dashboardLinkState}
            onClick={() => updateOpen(false)}
          >
            <IconSettings className="header__profile-menu-icon" />
            <span>{avatarLabels?.settings ?? 'Settings'}</span>
          </Link>
          <Link
            className="header__profile-menu-item"
            role="menuitem"
            to="/dashboard-new/payment-settings"
            state={dashboardLinkState}
            onClick={() => updateOpen(false)}
          >
            <IconUpgradeSparkle className="header__profile-menu-icon" />
            <span>{avatarLabels?.upgradePlan ?? 'Upgrade plan'}</span>
          </Link>
          <button
            type="button"
            className="header__profile-menu-item header__profile-menu-item--danger"
            role="menuitem"
            onClick={handleLogout}
          >
            <IconLogOut className="header__profile-menu-icon" />
            <span>{avatarLabels?.logOut ?? 'Log out'}</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}

export const ProfileAvatarMenu = memo(ProfileAvatarMenuComponent);
