import { DataAwait } from '@shared/DataAwait';
import { Popup } from '@shared/ui/popup';
import { Text } from '@shared/ui/text';
import { Hamburger } from '@shared/ui/hamburger';
import aboutStyles from '@components/AboutUs/AboutUs.module.scss';
import type { AlbumsDeferred } from '@/routes/loaders/albumsLoader';

type AboutSectionProps = {
  data: AlbumsDeferred | null;
  isAboutModalOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
};

export function AboutSection({ data, isAboutModalOpen, onOpen, onClose }: AboutSectionProps) {
  return (
    <section
      id="about"
      className={`${aboutStyles.about} main-background`}
      aria-labelledby="home-about-heading"
    >
      <div className="wrapper">
        {data ? (
          <DataAwait value={data.templateC} fallback={<h2>…</h2>} error={null}>
            {(ui) => {
              const dict = ui?.[0];
              const title = dict?.titles?.theBand ?? '';
              const theBand = Array.isArray(dict?.theBand)
                ? (dict.theBand as string[]).filter(Boolean)
                : [];
              const previewParagraphs = theBand.slice(0, 1);
              const showLabel = dict?.buttons?.show ?? '';

              return (
                <>
                  <h2 id="home-about-heading">{title}</h2>

                  {previewParagraphs.map(
                    (paragraph, index) =>
                      paragraph && (
                        <Text key={index} className={aboutStyles.aboutText}>
                          {paragraph}
                        </Text>
                      )
                  )}

                  <button
                    className={aboutStyles.aboutLookMore}
                    onClick={onOpen}
                    type="button"
                    aria-haspopup="dialog"
                  >
                    {showLabel}
                  </button>

                  <Popup
                    isActive={isAboutModalOpen}
                    onClose={onClose}
                    aria-labelledby="about-popup-title"
                  >
                    <div className={aboutStyles.aboutPopup}>
                      <Hamburger
                        isActive={isAboutModalOpen}
                        onToggle={onClose}
                        zIndex="1200"
                        className={aboutStyles.aboutPopupHamburger}
                      />

                      <div className={aboutStyles.aboutPopupInner}>
                        <h3 id="about-popup-title">{title}</h3>

                        {theBand.map(
                          (paragraph, index) =>
                            paragraph && (
                              <Text key={index} className={aboutStyles.aboutText}>
                                {paragraph}
                              </Text>
                            )
                        )}
                      </div>
                    </div>
                  </Popup>
                </>
              );
            }}
          </DataAwait>
        ) : (
          <h2 id="home-about-heading">{''}</h2>
        )}
      </div>
    </section>
  );
}
