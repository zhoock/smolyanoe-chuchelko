import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useLang } from '@contexts/lang';
import { useAlbumsData } from '@shared/api/albums';
import type { AlbumsDeferred } from '@/routes/loaders/albumsLoader';
import { scrollToHash } from '@pages/Home/lib/scrollToHash';

type UseHomeDataResult = {
  data: AlbumsDeferred | null;
  isAboutModalOpen: boolean;
  openAboutModal: () => void;
  closeAboutModal: () => void;
};

export function useHomeData(): UseHomeDataResult {
  const { lang } = useLang();
  const data = useAlbumsData(lang);
  const location = useLocation();
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);

  const openAboutModal = useCallback(() => setIsAboutModalOpen(true), []);
  const closeAboutModal = useCallback(() => setIsAboutModalOpen(false), []);

  useEffect(() => {
    scrollToHash(location.hash);
  }, [location.hash]);

  return { data, isAboutModalOpen, openAboutModal, closeAboutModal };
}
