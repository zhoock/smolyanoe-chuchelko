import { useState, useEffect } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { Popup } from '@shared/ui/popup';
import { Text } from '@shared/ui/text';
import { Hamburger } from '@shared/ui/hamburger';
import { useLang } from '@app/providers/lang';
import { useAppSelector } from '@shared/lib/hooks/useAppSelector';
import { selectUiDictionaryFirst } from '@shared/model/uiDictionary';
import { useSiteArtistDisplayName } from '@shared/lib/hooks/useSiteArtistDisplayName';
import { loadTheBandFromDatabase, loadTheBandFromProfileJson } from '@entities/user/lib';
import aboutStyles from './AboutSection.module.scss';

type AboutSectionProps = {
  isAboutModalOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
};

export function AboutSection({ isAboutModalOpen, onOpen, onClose }: AboutSectionProps) {
  const { lang } = useLang();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const ui = useAppSelector((state) => selectUiDictionaryFirst(state, lang));
  const hasArtistParam = !!searchParams.get('artist');
  const artistParamKey = searchParams.get('artist')?.trim() ?? '';

  const { displayLabel: bandDisplayLabel } = useSiteArtistDisplayName(lang, {
    artistSlug: hasArtistParam ? artistParamKey || null : null,
  });

  // Состояние для theBand из БД
  const [theBandFromDb, setTheBandFromDb] = useState<string[] | null>(null);
  const [isLoadingTheBand, setIsLoadingTheBand] = useState(true);
  // Состояние для theBand из profile.json (fallback)
  const [theBandFromProfileJson, setTheBandFromProfileJson] = useState<string[] | null>(null);

  const title = ui?.titles?.theBand ?? '';

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
  }, [lang, location.search]);

  // Загружаем theBand из profile.json (fallback только для default-режима без artist)
  useEffect(() => {
    if (hasArtistParam) {
      setTheBandFromProfileJson(null);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const profileData = await loadTheBandFromProfileJson(lang);
        if (!cancelled) {
          setTheBandFromProfileJson(profileData);
        }
      } catch (error) {
        if (!cancelled) {
          console.warn('⚠️ Ошибка загрузки theBand из profile.json:', error);
          setTheBandFromProfileJson(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [lang, hasArtistParam]);

  // В artist-режиме показываем только данные выбранного артиста (без fallback на default content).
  // В default-режиме сохраняем старый fallback на profile.json.
  const theBand = (
    hasArtistParam
      ? theBandFromDb || []
      : theBandFromDb && theBandFromDb.length > 0
        ? theBandFromDb
        : theBandFromProfileJson || []
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
          {title} {bandDisplayLabel}
        </h2>

        {previewParagraph && (
          <Text className={`${aboutStyles.aboutText} ${aboutStyles.aboutTextPreview}`}>
            {previewParagraph}
          </Text>
        )}

        <div className={aboutStyles.aboutButtonWrapper}>
          <button
            className={aboutStyles.aboutLookMore}
            onClick={onOpen}
            type="button"
            aria-haspopup="dialog"
          >
            {showLabel}
          </button>
        </div>

        <Popup isActive={isAboutModalOpen} onClose={onClose} aria-labelledby="about-popup-title">
          <div className={aboutStyles.aboutPopup}>
            <div className={aboutStyles.aboutPopupHeader}>
              <h3 id="about-popup-title">
                {title} {bandDisplayLabel}
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
