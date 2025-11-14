import { Popup } from '@shared/ui/popup';
import { Text } from '@shared/ui/text';
import { Hamburger } from '@shared/ui/hamburger';
import { useLang } from '@app/providers/lang';
import { useAppSelector } from '@shared/lib/hooks/useAppSelector';
import { selectUiDictionaryFirst } from '@shared/model/uiDictionary';
import { selectAlbumsData } from '@entities/album';
import aboutStyles from './AboutSection.module.scss';

type AboutSectionProps = {
  isAboutModalOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
};

export function AboutSection({ isAboutModalOpen, onOpen, onClose }: AboutSectionProps) {
  const { lang } = useLang();
  const ui = useAppSelector((state) => selectUiDictionaryFirst(state, lang));
  const albums = useAppSelector((state) => selectAlbumsData(state, lang));

  const title = ui?.titles?.theBand ?? '';
  const artistName = albums[0]?.artist ?? '';
  const theBand = (ui?.theBand || []).filter(Boolean) as string[];
  const previewParagraph = theBand[0];
  const showLabel = ui?.buttons?.show ?? '';

  return (
    <section
      id="about"
      className={`${aboutStyles.about} main-background`}
      aria-labelledby="home-about-heading"
    >
      <div className="wrapper">
        <h2 id="home-about-heading">
          {title} {artistName}
        </h2>

        {previewParagraph && (
          <Text className={`${aboutStyles.aboutText} ${aboutStyles.aboutTextPreview}`}>
            {previewParagraph}
          </Text>
        )}

        <button
          className={aboutStyles.aboutLookMore}
          onClick={onOpen}
          type="button"
          aria-haspopup="dialog"
        >
          {showLabel}
        </button>

        <Popup isActive={isAboutModalOpen} onClose={onClose} aria-labelledby="about-popup-title">
          <div className={aboutStyles.aboutPopup}>
            <Hamburger
              isActive={isAboutModalOpen}
              onToggle={onClose}
              zIndex="1200"
              className={aboutStyles.aboutPopupHamburger}
            />

            <div className={aboutStyles.aboutPopupInner}>
              <h3 id="about-popup-title">
                {title} {artistName}
              </h3>

              {theBand.map((paragraph, index) => (
                <Text key={index} className={aboutStyles.aboutText}>
                  {paragraph}
                </Text>
              ))}
            </div>
          </div>
        </Popup>
      </div>
    </section>
  );
}
