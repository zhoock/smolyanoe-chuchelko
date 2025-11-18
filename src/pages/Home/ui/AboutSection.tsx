import { useState, useEffect } from 'react';
import { Popup } from '@shared/ui/popup';
import { Text } from '@shared/ui/text';
import { Hamburger } from '@shared/ui/hamburger';
import { useLang } from '@app/providers/lang';
import { useAppSelector } from '@shared/lib/hooks/useAppSelector';
import { selectUiDictionaryFirst } from '@shared/model/uiDictionary';
import { selectAlbumsData } from '@entities/album';
import { loadTheBandFromDatabase } from '@entities/user/lib';
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

  // Состояние для theBand из БД
  const [theBandFromDb, setTheBandFromDb] = useState<string[] | null>(null);
  const [isLoadingTheBand, setIsLoadingTheBand] = useState(true);

  const title = ui?.titles?.theBand ?? '';
  const artistName = albums[0]?.artist ?? '';

  // Загружаем theBand из БД (если пользователь авторизован)
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setIsLoadingTheBand(true);
      try {
        const theBand = await loadTheBandFromDatabase(lang);
        if (!cancelled) {
          setTheBandFromDb(theBand);
        }
      } catch (error) {
        if (!cancelled) {
          console.warn('⚠️ Ошибка загрузки theBand из БД:', error);
          setTheBandFromDb(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingTheBand(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [lang]);

  // Используем theBand из БД, если есть и не пустой, иначе из JSON (fallback)
  const theBandFromJson = (ui?.theBand || []).filter(Boolean) as string[];
  const theBand = (
    theBandFromDb !== null && theBandFromDb.length > 0 ? theBandFromDb : theBandFromJson
  ).filter(Boolean);
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
            <div className={aboutStyles.aboutPopupHeader}>
              <h3 id="about-popup-title">
                {title} {artistName}
              </h3>
              <Hamburger
                isActive={isAboutModalOpen}
                onToggle={onClose}
                className={aboutStyles.aboutPopupHamburger}
              />
            </div>

            <div className={aboutStyles.aboutPopupInner}>
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
