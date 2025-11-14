import { AlbumsSection } from './AlbumsSection';
import { ArticlesSection } from './ArticlesSection';
import { AboutSection } from './AboutSection';
import { useHomeData } from '@pages/Home/model/useHomeData';
import '@entities/album/ui/style.scss';
import '@entities/article/ui/style.scss';

export function HomePage() {
  const { isAboutModalOpen, openAboutModal, closeAboutModal } = useHomeData();

  return (
    <>
      <AlbumsSection />
      <ArticlesSection />
      <AboutSection
        isAboutModalOpen={isAboutModalOpen}
        onOpen={openAboutModal}
        onClose={closeAboutModal}
      />
    </>
  );
}

export default HomePage;
