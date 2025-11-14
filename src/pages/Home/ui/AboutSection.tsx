import { Popup } from '@shared/ui/popup';
import { Text } from '@shared/ui/text';
import { Hamburger } from '@shared/ui/hamburger';
import { useLang } from '@app/providers/lang';
import { useAppSelector } from '@shared/lib/hooks/useAppSelector';
import { selectUiDictionaryFirst } from '@shared/model/uiDictionary';
import aboutStyles from './AboutSection.module.scss';

type AboutSectionProps = {
  isAboutModalOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
};

export function AboutSection({ isAboutModalOpen, onOpen, onClose }: AboutSectionProps) {
  const { lang } = useLang();
  const ui = useAppSelector((state) => selectUiDictionaryFirst(state, lang));

  // UI словарь загружается через loader

  const title = ui?.titles?.theBand ?? '';
  const theBand = Array.isArray(ui?.theBand) ? (ui.theBand as string[]).filter(Boolean) : [];
  const previewParagraphs = theBand.slice(0, 1);
  const showLabel = ui?.buttons?.show ?? '';

  return (
    <section
      id="about"
      className={`${aboutStyles.about} main-background`}
      aria-labelledby="home-about-heading"
    >
      <div className="wrapper">
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

        <Popup isActive={isAboutModalOpen} onClose={onClose} aria-labelledby="about-popup-title">
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
      </div>
    </section>
  );
}
