import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { scrollToHash } from '@pages/Home/lib/scrollToHash';

type UseHomeDataResult = {
  isAboutModalOpen: boolean;
  openAboutModal: () => void;
  closeAboutModal: () => void;
};

export function useHomeData(): UseHomeDataResult {
  const location = useLocation();
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);

  const openAboutModal = useCallback(() => setIsAboutModalOpen(true), []);
  const closeAboutModal = useCallback(() => setIsAboutModalOpen(false), []);

  useEffect(() => {
    scrollToHash(location.hash);
  }, [location.hash]);

  return { isAboutModalOpen, openAboutModal, closeAboutModal };
}
