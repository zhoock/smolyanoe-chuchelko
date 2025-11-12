import { AlbumsSection } from './AlbumsSection';
import { ArticlesSection } from './ArticlesSection';
import { AboutSection } from './AboutSection';
import { useHomeData } from '../model/useHomeData';
import '@entities/album/ui/style.scss';
import '@entities/article/ui/style.scss';

export function HomePage() {
  const { data, isAboutModalOpen, openAboutModal, closeAboutModal } = useHomeData();

  return (
    <>
      <AlbumsSection data={data} />
      <ArticlesSection data={data} />
      <AboutSection
        data={data}
        isAboutModalOpen={isAboutModalOpen}
        onOpen={openAboutModal}
        onClose={closeAboutModal}
      />
    </>
  );
}

export default HomePage;
