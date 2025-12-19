import { useState, useEffect, useRef } from 'react';
import { Popup } from '@shared/ui/popup';
import { useLang } from '@app/providers/lang';
import './LanguageSelectModal.scss';

interface LanguageSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLanguageSelected: (lang: 'ru' | 'en') => void;
}

export function LanguageSelectModal({
  isOpen,
  onClose,
  onLanguageSelected,
}: LanguageSelectModalProps) {
  const { lang: currentLang } = useLang();
  const [selectedLang, setSelectedLang] = useState<'ru' | 'en'>(currentLang || 'ru');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const selectRef = useRef<HTMLDivElement>(null);

  // Закрытие при нажатии Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isDropdownOpen) {
          setIsDropdownOpen(false);
        } else {
          onClose();
        }
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, isDropdownOpen, onClose]);

  // Закрытие dropdown при клике вне
  useEffect(() => {
    if (!isDropdownOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        selectRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        !selectRef.current.contains(e.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isDropdownOpen]);

  const languages = [
    { value: 'ru', label: 'Русский' },
    { value: 'en', label: 'English' },
  ];

  const selectedLanguage = languages.find((l) => l.value === selectedLang) || languages[0];

  const handleSelectLanguage = (lang: 'ru' | 'en') => {
    setSelectedLang(lang);
    setIsDropdownOpen(false);
  };

  const handleContinue = () => {
    onLanguageSelected(selectedLang);
  };

  return (
    <Popup isActive={isOpen} onClose={onClose}>
      <div className="language-select-modal">
        <div className="language-select-modal__card">
          <button
            type="button"
            className="language-select-modal__close"
            onClick={onClose}
            aria-label="Закрыть"
          >
            ×
          </button>

          <h2 className="language-select-modal__title">Выбор языка</h2>

          <p className="language-select-modal__instruction">Выберите язык интерфейса</p>

          <div className="language-select-modal__select-wrapper">
            <div
              ref={selectRef}
              className="language-select-modal__select"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setIsDropdownOpen(!isDropdownOpen);
                }
              }}
            >
              <span className="language-select-modal__select-value">{selectedLanguage.label}</span>
              <svg
                className={`language-select-modal__select-arrow ${isDropdownOpen ? 'language-select-modal__select-arrow--open' : ''}`}
                width="12"
                height="8"
                viewBox="0 0 12 8"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M1 1L6 6L11 1"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            {isDropdownOpen && (
              <div ref={dropdownRef} className="language-select-modal__dropdown">
                {languages.map((lang) => (
                  <button
                    key={lang.value}
                    type="button"
                    className={`language-select-modal__option ${selectedLang === lang.value ? 'language-select-modal__option--selected' : ''}`}
                    onClick={() => handleSelectLanguage(lang.value as 'ru' | 'en')}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <p className="language-select-modal__description">
            Язык, который увидят посетители при просмотре вашего сайта.
          </p>

          <button
            type="button"
            className="language-select-modal__continue"
            onClick={handleContinue}
          >
            Продолжить
          </button>
        </div>
      </div>
    </Popup>
  );
}
