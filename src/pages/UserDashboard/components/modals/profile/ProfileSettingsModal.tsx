// src/pages/UserDashboard/components/ProfileSettingsModal.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Popup } from '@shared/ui/popup';
import { useLang } from '@app/providers/lang';
import { useAppSelector } from '@shared/lib/hooks/useAppSelector';
import { selectUiDictionaryFirst } from '@shared/model/uiDictionary';
import { getUser, getToken, updateStoredUserName } from '@shared/lib/auth';
import {
  loadTheBandFromDatabase,
  saveTheBandToDatabase,
  loadHeaderImagesFromDatabase,
  saveHeaderImagesToDatabase,
} from '@entities/user/lib';
import { HeaderImagesUpload } from '../../upload/HeaderImagesUpload';
import { GENRE_OPTIONS } from '../album/EditAlbumModal.constants';
import { DashboardSaveSpinner } from '@shared/ui/dashboard-save/DashboardSaveSpinner';
import '@shared/ui/dashboard-save/dashboard-save.scss';
import './ProfileSettingsModal.style.scss';

interface ProfileSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userName?: string;
  userEmail?: string;
}

type TabType = 'general' | 'profile' | 'security';

export function ProfileSettingsModal({
  isOpen,
  onClose,
  userName = 'Site Owner',
  userEmail = '',
}: ProfileSettingsModalProps) {
  const { lang: currentLang, setLang } = useLang();
  const ui = useAppSelector((state) => selectUiDictionaryFirst(state, currentLang));
  const [activeTab, setActiveTab] = useState<TabType>('general');
  const [name, setName] = useState(userName);
  const [publicSlug, setPublicSlug] = useState('');
  const [selectedLang, setSelectedLang] = useState<'ru' | 'en'>(currentLang || 'ru');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [headerImages, setHeaderImages] = useState<string[]>([]);
  const [initialHeaderImages, setInitialHeaderImages] = useState<string[]>([]);
  const [genreCode, setGenreCode] = useState<string>('other');
  const [initialGenreCode, setInitialGenreCode] = useState<string>('other');
  const [isLoadingHeaderImages, setIsLoadingHeaderImages] = useState(false);
  const [aboutTextRu, setAboutTextRu] = useState<string>('');
  const [aboutTextEn, setAboutTextEn] = useState<string>('');
  const [aboutText, setAboutText] = useState<string>(''); // Текущий текст для выбранного языка
  const [isLoadingAboutText, setIsLoadingAboutText] = useState(false);
  const [isSavingAboutText, setIsSavingAboutText] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Поля для смены пароля
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Состояние для показа/скрытия паролей
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Состояние для смены пароля
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  // Исходные значения для отслеживания изменений
  const [initialName, setInitialName] = useState(userName);
  const [initialPublicSlug, setInitialPublicSlug] = useState('');
  const [initialLang, setInitialLang] = useState<'ru' | 'en'>(currentLang || 'ru');
  const [initialAboutTextRu, setInitialAboutTextRu] = useState<string>('');
  const [initialAboutTextEn, setInitialAboutTextEn] = useState<string>('');
  const [initialAboutText, setInitialAboutText] = useState<string>('');

  const dropdownRef = useRef<HTMLDivElement>(null);
  const selectRef = useRef<HTMLDivElement>(null);

  const languages = [
    { value: 'ru', label: 'Русский' },
    { value: 'en', label: 'English' },
  ];

  const selectedLanguage = languages.find((l) => l.value === selectedLang) || languages[0];

  const normalizePublicSlug = useCallback((value: string): string => {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+/, '')
      .replace(/-+$/, '');
  }, []);

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

  // Валидация формы смены пароля
  const getPasswordValidationError = (): string | null => {
    if (activeTab !== 'security') return null;

    // Если поля пустые, ошибки валидации нет (но форма невалидна для сохранения)
    if (!currentPassword && !newPassword && !confirmPassword) return null;

    if (!currentPassword) {
      return (
        ui?.dashboard?.profileSettingsModal?.validation?.enterCurrentPassword ??
        'Введите текущий пароль'
      );
    }

    if (!newPassword) {
      return (
        ui?.dashboard?.profileSettingsModal?.validation?.enterNewPassword ?? 'Введите новый пароль'
      );
    }

    if (newPassword.length < 8) {
      return (
        ui?.dashboard?.profileSettingsModal?.validation?.passwordMinLength ??
        'Новый пароль должен содержать минимум 8 символов'
      );
    }

    if (newPassword === currentPassword) {
      return (
        ui?.dashboard?.profileSettingsModal?.validation?.passwordDifferent ??
        'Новый пароль должен отличаться от текущего'
      );
    }

    if (newPassword !== confirmPassword) {
      return (
        ui?.dashboard?.profileSettingsModal?.validation?.passwordsNotMatch ?? 'Пароли не совпадают'
      );
    }

    return null;
  };

  const passwordValidationError = getPasswordValidationError();
  const isPasswordFormValid =
    passwordValidationError === null && currentPassword && newPassword && confirmPassword;

  // Проверка наличия изменений
  const hasProfileChanges =
    (activeTab === 'general' && selectedLang !== initialLang) ||
    (activeTab === 'profile' &&
      (name !== initialName ||
        publicSlug !== initialPublicSlug ||
        genreCode !== initialGenreCode ||
        aboutText !== initialAboutText ||
        (headerImages || []).length !== (initialHeaderImages || []).length ||
        (headerImages || []).some((url, index) => url !== (initialHeaderImages || [])[index]))) ||
    (activeTab === 'security' && (currentPassword || newPassword || confirmPassword));
  const hasPasswordChanges =
    activeTab === 'security' && (currentPassword || newPassword || confirmPassword);
  const hasChanges = hasProfileChanges || hasPasswordChanges;

  const isDashboardBusy = isChangingPassword || isSavingAboutText || isSavingProfile;

  const handleCancel = () => {
    // Возвращаем исходные значения в зависимости от активной вкладки
    if (activeTab === 'general') {
      setSelectedLang(initialLang);
    } else if (activeTab === 'profile') {
      setName(initialName);
      setPublicSlug(initialPublicSlug);
      setGenreCode(initialGenreCode);
      // Восстанавливаем текст для текущего выбранного языка
      setAboutText(selectedLang === 'ru' ? initialAboutTextRu : initialAboutTextEn);
      setHeaderImages([...(initialHeaderImages || [])]);
    } else if (activeTab === 'security') {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordError(null);
      setPasswordSuccess(false);
    }
    onClose();
  };

  const handleSave = async () => {
    if (activeTab === 'general') {
      // Сохраняем только язык
      if (selectedLang !== initialLang) {
        setLang(selectedLang);
        setInitialLang(selectedLang);
      }
    } else if (activeTab === 'security') {
      // Валидация формы пароля
      if (!isPasswordFormValid) {
        setPasswordError(
          passwordValidationError ||
            ui?.dashboard?.profileSettingsModal?.validation?.fillAllFields ||
            'Заполните все поля'
        );
        return;
      }

      // Смена пароля через API
      setIsChangingPassword(true);
      setPasswordError(null);
      setPasswordSuccess(false);

      try {
        const token = getToken();
        if (!token) {
          setPasswordError('Не удалось получить токен авторизации');
          setIsChangingPassword(false);
          return;
        }

        console.log('🔄 Sending password change request...');
        const response = await fetch('/api/change-password', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            currentPassword,
            newPassword,
          }),
        });

        console.log('📥 Response status:', response.status);
        const result = await response.json();
        console.log('📥 Response data:', result);

        if (!response.ok) {
          console.error('❌ Password change failed:', result.error);
          setPasswordError(result.error || 'Ошибка при смене пароля');
          setIsChangingPassword(false);
          return;
        }

        console.log('✅ Password changed successfully!');

        // Успех - перезагружаем пароль из БД и обновляем состояние
        setPasswordSuccess(true);
        setNewPassword('');
        setConfirmPassword('');
        setPasswordError(null);

        // Перезагружаем пароль из БД, чтобы получить актуальное значение
        const reloadPassword = async () => {
          try {
            const token = getToken();
            if (!token) return;

            const reloadResponse = await fetch('/api/user-profile', {
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
            });

            if (reloadResponse.ok) {
              const reloadResult = await reloadResponse.json();
              console.log('🔄 Reloaded password from DB:', reloadResult);
              if (reloadResult.success && reloadResult.data?.password) {
                setCurrentPassword(reloadResult.data.password);
                console.log('✅ Updated currentPassword state:', reloadResult.data.password);
              } else {
                // Если пароль не загрузился из БД, используем новый пароль
                setCurrentPassword(newPassword);
                console.log('⚠️ Password not found in DB response, using new password');
              }
            }
          } catch (error) {
            console.error('Ошибка перезагрузки пароля:', error);
            // В случае ошибки используем новый пароль
            setCurrentPassword(newPassword);
          }
        };

        await reloadPassword();

        // Закрываем модалку через небольшую задержку, чтобы пользователь увидел сообщение об успехе
        setTimeout(() => {
          onClose();
          setPasswordSuccess(false);
        }, 1500);
      } catch (error) {
        console.error('Ошибка при смене пароля:', error);
        setPasswordError(error instanceof Error ? error.message : 'Неизвестная ошибка');
      } finally {
        setIsChangingPassword(false);
      }
    } else if (activeTab === 'profile') {
      // Сохранение изменений профиля (имя, о группе, header images)
      // Сохранение текста "О Группе" для текущего выбранного языка
      if (aboutText !== initialAboutText) {
        setIsSavingAboutText(true);
        try {
          // Разбиваем текст на параграфы по переносам строк
          const paragraphs = aboutText
            .split('\n')
            .map((p) => p.trim())
            .filter((p) => p.length > 0);

          // Сохраняем только для текущего выбранного языка
          // API автоматически сохранит оба языка (обновит только выбранный, сохранив другой)
          const result = await saveTheBandToDatabase(paragraphs, selectedLang);

          if (!result.success) {
            console.error('Ошибка сохранения текста "О Группе":', result.error);
            alert(`Ошибка сохранения: ${result.error || 'Неизвестная ошибка'}`);
            setIsSavingAboutText(false);
            return;
          }

          // Обновляем локальное состояние для сохраненного языка
          if (selectedLang === 'ru') {
            setAboutTextRu(aboutText);
            setInitialAboutTextRu(aboutText);
          } else {
            setAboutTextEn(aboutText);
            setInitialAboutTextEn(aboutText);
          }
        } catch (error) {
          console.error('Ошибка сохранения текста "О Группе":', error);
          alert(
            `Ошибка сохранения: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`
          );
          setIsSavingAboutText(false);
          return;
        } finally {
          setIsSavingAboutText(false);
        }
      }

      // Сохранение site_name (название группы) и header images
      const needsSiteNameUpdate = name !== initialName;
      const needsPublicSlugUpdate = publicSlug !== initialPublicSlug;
      const needsGenreUpdate = genreCode !== initialGenreCode;
      const safeHeaderImages = Array.isArray(headerImages) ? headerImages : [];
      const safeInitialHeaderImages = Array.isArray(initialHeaderImages) ? initialHeaderImages : [];
      const needsHeaderImagesUpdate =
        safeHeaderImages.length !== safeInitialHeaderImages.length ||
        safeHeaderImages.some((url, index) => url !== safeInitialHeaderImages[index]);

      console.log('💾 [ProfileSettingsModal] Сохранение профиля:', {
        needsSiteNameUpdate,
        needsPublicSlugUpdate,
        needsGenreUpdate,
        needsHeaderImagesUpdate,
        name,
        initialName,
        headerImagesLength: safeHeaderImages.length,
        initialHeaderImagesLength: safeInitialHeaderImages.length,
      });

      if (
        needsSiteNameUpdate ||
        needsPublicSlugUpdate ||
        needsHeaderImagesUpdate ||
        needsGenreUpdate
      ) {
        setIsSavingProfile(true);
        try {
          const token = getToken();
          if (!token) {
            alert('Ошибка: вы не авторизованы. Пожалуйста, войдите в систему.');
            return;
          }

          const updateData: Record<string, unknown> = {};
          if (needsSiteNameUpdate) {
            updateData.siteName = name.trim() || null;
          }
          if (needsPublicSlugUpdate) {
            updateData.publicSlug = publicSlug.trim();
          }
          if (needsGenreUpdate) {
            updateData.genreCode = genreCode;
          }
          if (needsHeaderImagesUpdate) {
            updateData.headerImages = safeHeaderImages;
            console.log('📤 [ProfileSettingsModal] Header images для сохранения:', {
              count: safeHeaderImages.length,
              urls: safeHeaderImages,
            });
          }

          console.log('📤 [ProfileSettingsModal] Отправка данных:', updateData);

          const response = await fetch('/api/user-profile', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(updateData),
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error((errorData as any)?.error || `HTTP error! status: ${response.status}`);
          }

          // Отправляем событие для обновления Hero компонента
          if (needsSiteNameUpdate) {
            localStorage.setItem('profile-name', name);
            updateStoredUserName(name);
            window.dispatchEvent(
              new CustomEvent('profile-name-updated', {
                detail: { name, publicSlug: publicSlug.trim() || undefined },
              })
            );
          }

          // Отправляем событие для обновления header images в Hero компоненте
          if (needsHeaderImagesUpdate) {
            console.log(
              '✅ [ProfileSettingsModal] Header images успешно сохранены в БД, отправляем событие обновления'
            );
            window.dispatchEvent(
              new CustomEvent('header-images-updated', {
                detail: { images: safeHeaderImages },
              })
            );
          }

          console.log('✅ [ProfileSettingsModal] Профиль успешно сохранен');
        } catch (error) {
          console.error('❌ [ProfileSettingsModal] Ошибка сохранения профиля:', error);
          alert(
            `Ошибка сохранения: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`
          );
          return;
        } finally {
          setIsSavingProfile(false);
        }
      } else {
        console.log('ℹ️ [ProfileSettingsModal] Нет изменений для сохранения');
      }

      setInitialName(name);
      setInitialPublicSlug(publicSlug);
      setInitialGenreCode(genreCode);
      setInitialHeaderImages([...(headerImages || [])]);
      setInitialAboutText(aboutText);

      console.log('🔄 [ProfileSettingsModal] Обновлены начальные значения:', {
        initialName: name,
        initialHeaderImagesCount: (headerImages || []).length,
      });

      window.dispatchEvent(new Event('artist:updated'));

      onClose();
    }
  };

  const handleHeaderClose = () => {
    if (isDashboardBusy) return;
    if (hasChanges) {
      // Если есть изменения, отменяем их и закрываем
      handleCancel();
    } else {
      onClose();
    }
  };

  // Загрузка текущего пароля при открытии вкладки "Безопасность"
  useEffect(() => {
    if (isOpen && activeTab === 'security') {
      const loadPassword = async () => {
        try {
          const token = getToken();
          if (!token) {
            console.log('⚠️ Токен не найден для загрузки пароля');
            return;
          }

          const response = await fetch('/api/user-profile', {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
          });

          if (response.ok) {
            const result = await response.json();
            if (result.success && result.data?.password) {
              setCurrentPassword(result.data.password);
            }
          }
        } catch (error) {
          console.error('Ошибка загрузки пароля:', error);
        }
      };

      loadPassword();
    }
  }, [isOpen, activeTab]);

  // Сброс состояния пароля при переключении вкладок
  useEffect(() => {
    if (activeTab !== 'security') {
      setPasswordError(null);
      setPasswordSuccess(false);
    }
  }, [activeTab]);

  // Загрузка текста "О Группе" и header images при открытии модального окна или переключении на вкладку "Профиль"
  useEffect(() => {
    if (isOpen && activeTab === 'profile') {
      const loadAboutText = async () => {
        setIsLoadingAboutText(true);
        try {
          // Загружаем оба языка из БД
          const [ruData, enData] = await Promise.all([
            loadTheBandFromDatabase('ru', { includeArtist: false, useAuth: true }),
            loadTheBandFromDatabase('en', { includeArtist: false, useAuth: true }),
          ]);
          const bilingualData = { ru: ruData, en: enData };
          const source = 'БД';

          const textRu =
            bilingualData.ru && bilingualData.ru.length > 0 ? bilingualData.ru.join('\n') : '';
          const textEn =
            bilingualData.en && bilingualData.en.length > 0 ? bilingualData.en.join('\n') : '';

          // Сохраняем оба языка в состояние
          setAboutTextRu(textRu);
          setAboutTextEn(textEn);
          setInitialAboutTextRu(textRu);
          setInitialAboutTextEn(textEn);

          // Показываем текст для текущего выбранного языка
          const currentText = selectedLang === 'ru' ? textRu : textEn;
          setAboutText(currentText);
          setInitialAboutText(currentText);

          if (
            (bilingualData.ru && bilingualData.ru.length > 0) ||
            (bilingualData.en && bilingualData.en.length > 0)
          ) {
            console.log('✅ Текст "О Группе" загружен:', {
              source,
              ruParagraphs: bilingualData.ru?.length || 0,
              enParagraphs: bilingualData.en?.length || 0,
              currentLang: selectedLang,
            });
          } else {
            console.log('ℹ️ Текст "О Группе" пуст, можно ввести новый');
          }
        } catch (error) {
          console.error('Ошибка загрузки текста "О Группе":', error);
          setAboutTextRu('');
          setAboutTextEn('');
          setAboutText('');
          setInitialAboutTextRu('');
          setInitialAboutTextEn('');
          setInitialAboutText('');
        } finally {
          setIsLoadingAboutText(false);
        }
      };

      const loadHeaderImages = async () => {
        setIsLoadingHeaderImages(true);
        try {
          const images = await loadHeaderImagesFromDatabase(true, {
            includeArtist: false,
            useAuth: true,
          });
          // Гарантируем, что images всегда массив
          const safeImages = Array.isArray(images) ? images : [];
          console.log('📥 [ProfileSettingsModal] Header images загружены из БД:', {
            count: safeImages.length,
            urls: safeImages,
            raw: images,
          });
          setHeaderImages(safeImages);
          setInitialHeaderImages(safeImages);
          if (safeImages.length > 0) {
            console.log('✅ Header images загружены:', safeImages.length);
          } else {
            console.log('ℹ️ Header images отсутствуют в БД (пустой массив)');
          }
        } catch (error) {
          console.error('❌ Ошибка загрузки header images:', error);
          setHeaderImages([]);
          setInitialHeaderImages([]);
        } finally {
          setIsLoadingHeaderImages(false);
        }
      };

      loadAboutText();
      loadHeaderImages();
    }
  }, [isOpen, activeTab, selectedLang]);

  // Обновляем отображаемый текст при изменении выбранного языка
  useEffect(() => {
    if (isOpen && activeTab === 'profile') {
      const currentText = selectedLang === 'ru' ? aboutTextRu : aboutTextEn;
      setAboutText(currentText);
      setInitialAboutText(currentText);
    }
  }, [selectedLang, isOpen, activeTab, aboutTextRu, aboutTextEn]);

  // Сброс значений при открытии модального окна
  useEffect(() => {
    if (isOpen) {
      // Загружаем название группы из API
      const loadSiteName = async () => {
        try {
          const token = getToken();
          if (!token) {
            // Если не авторизован, используем значение из localStorage или userName
            const storedName = localStorage.getItem('profile-name');
            const initialUserName = storedName || userName || '';
            setInitialName(initialUserName);
            setName(initialUserName);
            setGenreCode('other');
            setInitialGenreCode('other');
            return;
          }

          const response = await fetch('/api/user-profile', {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
          });

          if (response.ok) {
            const result = await response.json();
            const profileName = result.success
              ? (result.data?.siteName ?? result.data?.name ?? null)
              : null;
            const loadedPublicSlug = result.success ? (result.data?.publicSlug ?? '') : '';
            const allowedGenreCodes = new Set(GENRE_OPTIONS.map((g) => g.code));
            const rawLoaded =
              result.success && typeof result.data?.genreCode === 'string'
                ? result.data.genreCode.trim().toLowerCase()
                : '';
            const loadedGenre = rawLoaded && allowedGenreCodes.has(rawLoaded) ? rawLoaded : 'other';
            setGenreCode(loadedGenre);
            setInitialGenreCode(loadedGenre);
            if (profileName) {
              setInitialName(profileName);
              setName(profileName);
              // Сохраняем в localStorage для использования в Hero
              localStorage.setItem('profile-name', profileName);
              updateStoredUserName(profileName);
            } else {
              // Если в API нет siteName, используем значение из localStorage или userName
              const storedName = localStorage.getItem('profile-name');
              const initialUserName = storedName || userName || '';
              setInitialName(initialUserName);
              setName(initialUserName);
            }
            setInitialPublicSlug(loadedPublicSlug);
            setPublicSlug(loadedPublicSlug);
          } else {
            // В случае ошибки используем значение из localStorage или userName
            const storedName = localStorage.getItem('profile-name');
            const initialUserName = storedName || userName || '';
            setInitialName(initialUserName);
            setName(initialUserName);
            setInitialPublicSlug('');
            setPublicSlug('');
            setGenreCode('other');
            setInitialGenreCode('other');
          }
        } catch (error) {
          console.warn('⚠️ Ошибка загрузки site_name из профиля:', error);
          // В случае ошибки используем значение из localStorage или userName
          const storedName = localStorage.getItem('profile-name');
          const initialUserName = storedName || userName || '';
          setInitialName(initialUserName);
          setName(initialUserName);
          setInitialPublicSlug('');
          setPublicSlug('');
          setGenreCode('other');
          setInitialGenreCode('other');
        }
      };

      loadSiteName();

      const initialUserLang = currentLang || 'ru';
      setInitialLang(initialUserLang);
      setSelectedLang(initialUserLang);
      // Сбрасываем поля пароля при открытии (кроме currentPassword - он загружается отдельно)
      setNewPassword('');
      setConfirmPassword('');
      setPasswordError(null);
      setPasswordSuccess(false);
      // Текст "О Группе" будет загружен отдельно при открытии вкладки "Профиль"
    }
  }, [isOpen, userName, currentLang]);

  // Закрытие при нажатии Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isDashboardBusy) return;
        if (isDropdownOpen) {
          setIsDropdownOpen(false);
        } else {
          handleHeaderClose();
        }
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
    // isDashboardBusy: блокируем Escape во время сохранения; handleHeaderClose — см. стабильность выше
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isDropdownOpen, isDashboardBusy]);

  const handleSelectLanguage = (lang: 'ru' | 'en') => {
    setSelectedLang(lang);
    setIsDropdownOpen(false);
    // Не изменяем язык интерфейса сразу, только при сохранении
  };

  return (
    <Popup isActive={isOpen} onClose={handleHeaderClose} closeBlocked={isDashboardBusy}>
      <div className="profile-settings-modal">
        <div
          className={`profile-settings-modal__card${isDashboardBusy ? ' dashboard-save-card--busy' : ''}`}
          aria-busy={isDashboardBusy}
        >
          <div className="profile-settings-modal__header">
            <button
              type="button"
              className="profile-settings-modal__close"
              onClick={handleHeaderClose}
              disabled={isDashboardBusy}
              aria-label={ui?.dashboard?.close ?? 'Закрыть'}
            >
              ×
            </button>
            <h2 className="profile-settings-modal__title">
              {ui?.dashboard?.profileSettings ?? 'Настройки профиля'}
            </h2>
          </div>

          <nav className="profile-settings-modal__tabs">
            <button
              type="button"
              className={`profile-settings-modal__tab ${
                activeTab === 'general' ? 'profile-settings-modal__tab--active' : ''
              }`}
              onClick={() => setActiveTab('general')}
            >
              {ui?.dashboard?.profileSettingsModal?.tabs?.general ?? 'General'}
            </button>
            <button
              type="button"
              className={`profile-settings-modal__tab ${
                activeTab === 'profile' ? 'profile-settings-modal__tab--active' : ''
              }`}
              onClick={() => setActiveTab('profile')}
            >
              {ui?.dashboard?.profileSettingsModal?.tabs?.profile ?? 'Profile'}
            </button>
            <button
              type="button"
              className={`profile-settings-modal__tab ${
                activeTab === 'security' ? 'profile-settings-modal__tab--active' : ''
              }`}
              onClick={() => setActiveTab('security')}
            >
              {ui?.dashboard?.profileSettingsModal?.tabs?.security ?? 'Security'}
            </button>
          </nav>

          <div className="profile-settings-modal__body">
            <div className="profile-settings-modal__content">
              {activeTab === 'general' && (
                <div className="profile-settings-modal__general-tab">
                  <h3 className="profile-settings-modal__section-title">
                    {ui?.dashboard?.profileSettingsModal?.tabs?.general ?? 'General'}
                  </h3>
                  <div className="profile-settings-modal__field">
                    <label className="profile-settings-modal__label">
                      {ui?.dashboard?.profileSettingsModal?.fields?.language ?? 'Язык'}
                    </label>
                    <div className="profile-settings-modal__select-wrapper">
                      <div
                        ref={selectRef}
                        className="profile-settings-modal__select"
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
                        <span className="profile-settings-modal__select-value">
                          {selectedLanguage.label}
                        </span>
                        <svg
                          className={`profile-settings-modal__select-arrow ${
                            isDropdownOpen ? 'profile-settings-modal__select-arrow--open' : ''
                          }`}
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
                        <div ref={dropdownRef} className="profile-settings-modal__dropdown">
                          {languages.map((lang) => (
                            <button
                              key={lang.value}
                              type="button"
                              className={`profile-settings-modal__option ${
                                selectedLang === lang.value
                                  ? 'profile-settings-modal__option--selected'
                                  : ''
                              }`}
                              onClick={() => handleSelectLanguage(lang.value as 'ru' | 'en')}
                            >
                              {lang.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'profile' && (
                <div className="profile-settings-modal__profile-tab">
                  <h3 className="profile-settings-modal__section-title">
                    {ui?.dashboard?.profileSettingsModal?.tabs?.profile ?? 'Profile'}
                  </h3>
                  <div className="profile-settings-modal__field">
                    <label htmlFor="profile-name" className="profile-settings-modal__label">
                      {ui?.dashboard?.profileSettingsModal?.fields?.bandName ?? 'Band Name'}
                    </label>
                    <input
                      id="profile-name"
                      type="text"
                      className="profile-settings-modal__input"
                      placeholder={
                        ui?.dashboard?.profileSettingsModal?.placeholders?.bandName ??
                        'Enter the name of your band'
                      }
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>

                  <div className="profile-settings-modal__field">
                    <label
                      htmlFor="profile-primary-genre"
                      className="profile-settings-modal__label"
                    >
                      {ui?.dashboard?.profileSettingsModal?.fields?.primaryGenre ?? 'Основной жанр'}
                    </label>
                    <select
                      id="profile-primary-genre"
                      className="profile-settings-modal__input"
                      value={genreCode}
                      onChange={(e) => setGenreCode(e.target.value)}
                    >
                      {GENRE_OPTIONS.map((opt) => (
                        <option key={opt.code} value={opt.code}>
                          {opt.label[currentLang === 'en' ? 'en' : 'ru']}
                        </option>
                      ))}
                    </select>
                    <div className="profile-settings-modal__field-hint">
                      {ui?.dashboard?.profileSettingsModal?.hints?.primaryGenreCatalog ??
                        'Этот жанр используется для отображения артиста в каталоге'}
                    </div>
                  </div>

                  <div className="profile-settings-modal__field">
                    <label htmlFor="profile-public-slug" className="profile-settings-modal__label">
                      Public URL (slug)
                    </label>
                    <input
                      id="profile-public-slug"
                      type="text"
                      className="profile-settings-modal__input"
                      placeholder="my-band"
                      value={publicSlug}
                      onChange={(e) => setPublicSlug(normalizePublicSlug(e.target.value))}
                      onBlur={(e) => setPublicSlug(normalizePublicSlug(e.target.value))}
                    />
                    <div className="profile-settings-modal__field-hint">
                      {ui?.dashboard?.profileSettingsModal?.hints?.publicSlug ??
                        (currentLang === 'en'
                          ? 'Changing the slug may affect existing public links.'
                          : 'Изменение slug может повлиять на существующие публичные ссылки.')}
                    </div>
                  </div>

                  <div className="profile-settings-modal__field">
                    <label htmlFor="profile-email" className="profile-settings-modal__label">
                      {ui?.dashboard?.profileSettingsModal?.fields?.email ?? 'Email'}
                    </label>
                    <input
                      id="profile-email"
                      type="email"
                      className="profile-settings-modal__input"
                      value={userEmail}
                      disabled
                    />
                  </div>

                  <div className="profile-settings-modal__field">
                    <label htmlFor="profile-about" className="profile-settings-modal__label">
                      {ui?.dashboard?.profileSettingsModal?.fields?.aboutBand ?? 'О Группе'}
                      {selectedLang === 'ru' ? ' (RU)' : ' (EN)'}
                    </label>
                    {isLoadingAboutText ? (
                      <div className="profile-settings-modal__loading">
                        {ui?.dashboard?.loading ?? ui?.dashboard?.uploading ?? 'Загрузка...'}
                      </div>
                    ) : (
                      <textarea
                        id="profile-about"
                        className="profile-settings-modal__textarea"
                        placeholder={
                          selectedLang === 'ru'
                            ? (ui?.dashboard?.profileSettingsModal?.placeholders?.aboutBand ??
                              'Введите описание группы на русском языке. Каждая строка будет отдельным параграфом.')
                            : (ui?.dashboard?.profileSettingsModal?.placeholders?.aboutBand ??
                              'Enter band description in English. Each line will be a separate paragraph.')
                        }
                        value={aboutText}
                        onChange={(e) => setAboutText(e.target.value)}
                        rows={8}
                      />
                    )}
                    <div className="profile-settings-modal__field-hint">
                      {selectedLang === 'ru'
                        ? (ui?.dashboard?.profileSettingsModal?.hints?.aboutBand ??
                          'Каждая строка будет отдельным параграфом в описании группы')
                        : (ui?.dashboard?.profileSettingsModal?.hints?.aboutBand ??
                          'Each line will be a separate paragraph in the band description')}
                    </div>
                  </div>

                  <div className="profile-settings-modal__field">
                    {isLoadingHeaderImages ? (
                      <div>Загрузка изображений...</div>
                    ) : (
                      <HeaderImagesUpload
                        currentImages={headerImages || []}
                        onImagesUpdated={(urls) => {
                          setHeaderImages(Array.isArray(urls) ? urls : []);
                        }}
                      />
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'security' && (
                <div className="profile-settings-modal__security-tab">
                  <h3 className="profile-settings-modal__section-title">
                    {ui?.dashboard?.profileSettingsModal?.buttons?.changePassword ?? 'Смена пароля'}
                  </h3>

                  {passwordSuccess && (
                    <div className="profile-settings-modal__success-message">
                      {ui?.dashboard?.profileSettingsModal?.messages?.passwordUpdated ??
                        'Пароль обновлён'}
                    </div>
                  )}

                  {passwordError && (
                    <div className="profile-settings-modal__error-message">{passwordError}</div>
                  )}

                  {passwordValidationError && !passwordError && (
                    <div className="profile-settings-modal__validation-error">
                      {passwordValidationError}
                    </div>
                  )}

                  <div className="profile-settings-modal__field">
                    <label htmlFor="current-password" className="profile-settings-modal__label">
                      {ui?.dashboard?.profileSettingsModal?.fields?.currentPassword ??
                        'Текущий пароль'}
                    </label>
                    <div className="profile-settings-modal__input-wrapper">
                      <input
                        id="current-password"
                        type={showCurrentPassword ? 'text' : 'password'}
                        className="profile-settings-modal__input"
                        value={currentPassword}
                        onChange={(e) => {
                          setCurrentPassword(e.target.value);
                          setPasswordError(null);
                        }}
                        disabled={isChangingPassword}
                      />
                      <button
                        type="button"
                        className="profile-settings-modal__password-toggle"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        aria-label={showCurrentPassword ? 'Скрыть пароль' : 'Показать пароль'}
                        tabIndex={-1}
                      >
                        {showCurrentPassword ? (
                          <svg
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              d="M10.94 6.08A6.93 6.93 0 0 1 12 6c3.18 0 6.17 2.29 7.91 6a15.23 15.23 0 0 1-.9 1.64 1 1 0 0 1-1.7-1.05A13.07 13.07 0 0 0 12 8a4.93 4.93 0 0 0-2.94 1.08L10.94 6.08ZM12 18a4.93 4.93 0 0 0 2.94-1.08L13.06 17.92A6.93 6.93 0 0 1 12 18c-3.18 0-6.17-2.29-7.91-6a15.23 15.23 0 0 1 .9-1.64 1 1 0 0 1 1.7 1.05A13.07 13.07 0 0 0 12 16a4.93 4.93 0 0 0 2.94-1.08L13.06 17.92Z"
                              fill="currentColor"
                            />
                            <path
                              d="M8 8l8 8M16 8l-8 8"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                            />
                          </svg>
                        ) : (
                          <svg
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            <circle
                              cx="12"
                              cy="12"
                              r="3"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="profile-settings-modal__field">
                    <label htmlFor="new-password" className="profile-settings-modal__label">
                      {ui?.dashboard?.profileSettingsModal?.fields?.newPassword ?? 'Новый пароль'}
                    </label>
                    <div className="profile-settings-modal__input-wrapper">
                      <input
                        id="new-password"
                        type={showNewPassword ? 'text' : 'password'}
                        className="profile-settings-modal__input"
                        value={newPassword}
                        onChange={(e) => {
                          setNewPassword(e.target.value);
                          setPasswordError(null);
                        }}
                        disabled={isChangingPassword}
                        minLength={8}
                      />
                      <button
                        type="button"
                        className="profile-settings-modal__password-toggle"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        aria-label={showNewPassword ? 'Скрыть пароль' : 'Показать пароль'}
                        tabIndex={-1}
                      >
                        {showNewPassword ? (
                          <svg
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              d="M10.94 6.08A6.93 6.93 0 0 1 12 6c3.18 0 6.17 2.29 7.91 6a15.23 15.23 0 0 1-.9 1.64 1 1 0 0 1-1.7-1.05A13.07 13.07 0 0 0 12 8a4.93 4.93 0 0 0-2.94 1.08L10.94 6.08ZM12 18a4.93 4.93 0 0 0 2.94-1.08L13.06 17.92A6.93 6.93 0 0 1 12 18c-3.18 0-6.17-2.29-7.91-6a15.23 15.23 0 0 1 .9-1.64 1 1 0 0 1 1.7 1.05A13.07 13.07 0 0 0 12 16a4.93 4.93 0 0 0 2.94-1.08L13.06 17.92Z"
                              fill="currentColor"
                            />
                            <path
                              d="M8 8l8 8M16 8l-8 8"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                            />
                          </svg>
                        ) : (
                          <svg
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            <circle
                              cx="12"
                              cy="12"
                              r="3"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="profile-settings-modal__field">
                    <label htmlFor="confirm-password" className="profile-settings-modal__label">
                      {ui?.dashboard?.profileSettingsModal?.fields?.confirmPassword ??
                        'Подтвердите новый пароль'}
                    </label>
                    <div className="profile-settings-modal__input-wrapper">
                      <input
                        id="confirm-password"
                        type={showConfirmPassword ? 'text' : 'password'}
                        className="profile-settings-modal__input"
                        value={confirmPassword}
                        onChange={(e) => {
                          setConfirmPassword(e.target.value);
                          setPasswordError(null);
                        }}
                        disabled={isChangingPassword}
                      />
                      <button
                        type="button"
                        className="profile-settings-modal__password-toggle"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        aria-label={showConfirmPassword ? 'Скрыть пароль' : 'Показать пароль'}
                        tabIndex={-1}
                      >
                        {showConfirmPassword ? (
                          <svg
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              d="M10.94 6.08A6.93 6.93 0 0 1 12 6c3.18 0 6.17 2.29 7.91 6a15.23 15.23 0 0 1-.9 1.64 1 1 0 0 1-1.7-1.05A13.07 13.07 0 0 0 12 8a4.93 4.93 0 0 0-2.94 1.08L10.94 6.08ZM12 18a4.93 4.93 0 0 0 2.94-1.08L13.06 17.92A6.93 6.93 0 0 1 12 18c-3.18 0-6.17-2.29-7.91-6a15.23 15.23 0 0 1 .9-1.64 1 1 0 0 1 1.7 1.05A13.07 13.07 0 0 0 12 16a4.93 4.93 0 0 0 2.94-1.08L13.06 17.92Z"
                              fill="currentColor"
                            />
                            <path
                              d="M8 8l8 8M16 8l-8 8"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                            />
                          </svg>
                        ) : (
                          <svg
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            <circle
                              cx="12"
                              cy="12"
                              r="3"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {hasChanges && (
            <div className="profile-settings-modal__footer">
              <button
                type="button"
                className="profile-settings-modal__button profile-settings-modal__button--cancel"
                onClick={handleCancel}
                disabled={isDashboardBusy}
              >
                {ui?.dashboard?.cancel ?? 'Отмена'}
              </button>
              <button
                type="button"
                className={`profile-settings-modal__button profile-settings-modal__button--save${
                  isDashboardBusy ? ' profile-settings-modal__button--save-loading' : ''
                }`}
                onClick={handleSave}
                disabled={isDashboardBusy || (activeTab === 'security' && !isPasswordFormValid)}
              >
                {isDashboardBusy ? (
                  <>
                    <DashboardSaveSpinner />
                    {ui?.dashboard?.saving ?? ui?.dashboard?.uploading ?? 'Сохранение...'}
                  </>
                ) : (
                  (ui?.dashboard?.save ?? 'Сохранить')
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </Popup>
  );
}
