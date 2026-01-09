import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useLang } from '@app/providers/lang';
import { fetchPublicProfile } from '@entities/user/lib/fetchPublicProfile';
import type { PublicProfileData } from '@entities/user/lib/types';
import { ProfileProvider } from '@shared/context/ProfileContext';
import { useAppDispatch } from '@shared/lib/hooks/useAppDispatch';
import { useAppSelector } from '@shared/lib/hooks/useAppSelector';
import { getIsPopupOpen, closePopup, openPopup } from '@features/popupToggle';
import { getUser } from '@shared/lib/auth';
import { Header } from '@widgets/header';
import { Hero } from '@widgets/hero';
import { Popup } from '@shared/ui/popup';
import { Navigation } from '@features/navigation';
import { Hamburger } from '@shared/ui/hamburger';
import { Footer } from '@widgets/footer';
import { PlayerShell } from '@features/player';
import { FloatingCart } from '@entities/service/ui/FloatingCart';
import { NotFoundPage } from '@widgets/notFound';

const PageLoader = () => <p>Загрузка...</p>;

export function ProfileLayout() {
  const dispatch = useAppDispatch();
  const popup = useAppSelector(getIsPopupOpen);
  const location = useLocation();
  const params = useParams<{ username: string }>();
  const username = params.username?.toLowerCase() || '';
  const { lang } = useLang() as { lang: 'ru' | 'en' };

  const [profile, setProfile] = useState<PublicProfileData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') {
      return 'dark';
    }
    const stored = localStorage.getItem('theme');
    if (stored === 'light' || stored === 'dark') {
      return stored;
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  const refresh = useCallback(async () => {
    if (!username) {
      setProfile(null);
      setError('404');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPublicProfile(username, lang);
      setProfile(data);
    } catch (error) {
      setProfile(null);
      if ((error as any)?.status === 404) {
        setError('404');
      } else {
        setError((error as Error).message);
      }
    } finally {
      setLoading(false);
    }
  }, [username, lang]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    document.documentElement.classList.toggle('theme-dark', theme === 'dark');
    document.documentElement.classList.toggle('theme-light', theme === 'light');
    if (typeof window !== 'undefined') {
      localStorage.setItem('theme', theme);
    }
  }, [theme]);

  // Сохраняем предыдущий путь для навигации внутри профиля
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest('a[href]');
      if (link && link.getAttribute('href')?.startsWith('/')) {
        sessionStorage.setItem('previousPath', location.pathname);
      }
    };

    document.addEventListener('click', handleClick, true);
    return () => {
      document.removeEventListener('click', handleClick, true);
    };
  }, [location.pathname]);

  useLayoutEffect(() => {
    const previousPath = sessionStorage.getItem('previousPath');
    if (!previousPath && location.pathname !== '/') {
      sessionStorage.setItem('previousPath', location.pathname);
    }
  }, [location.pathname]);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const refreshProfile = useCallback(async () => {
    await refresh();
  }, [refresh]);

  const isOwner = useMemo(() => {
    const authUser = getUser();
    return Boolean(authUser?.id && profile?.userId === authUser.id);
  }, [profile?.userId]);

  const contextValue = useMemo(
    () => ({
      username,
      profile,
      isOwner,
      loading,
      error,
      refresh: refreshProfile,
    }),
    [username, profile, isOwner, loading, error, refreshProfile]
  );

  if (!username || error === '404') {
    return <NotFoundPage />;
  }

  return (
    <ProfileProvider value={contextValue}>
      <Helmet>
        <title>{profile?.siteName || `${username} — Смоляное чучелко`}</title>
      </Helmet>
      <Header
        theme={theme}
        onToggleTheme={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
      />
      <main>
        <Hero />
        <Popup isActive={popup} onClose={() => dispatch(closePopup())}>
          <Hamburger isActive={popup} onToggle={() => dispatch(closePopup())} zIndex="1000" />
          <Navigation onToggle={() => dispatch(closePopup())} />
        </Popup>

        {!popup && (
          <Hamburger isActive={popup} onToggle={() => dispatch(openPopup())} zIndex="1000" />
        )}

        {loading ? (
          <PageLoader />
        ) : error ? (
          <div role="alert">{error}</div>
        ) : (
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        )}
      </main>
      <Footer />
      <PlayerShell />
      <FloatingCart />
    </ProfileProvider>
  );
}
