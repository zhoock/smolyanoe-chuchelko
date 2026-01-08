/**
 * Компонент онбординга "Стать музыкантом"
 * Форма для подачи заявки на статус музыканта
 */

import React, { useState } from 'react';
import { getToken } from '@shared/lib/auth';
import type { MusicianApplication } from '@shared/types/user';
import './MusicianOnboarding.style.scss';

interface MusicianOnboardingProps {
  onSuccess: () => void;
  onCancel?: () => void;
}

export function MusicianOnboarding({ onSuccess, onCancel }: MusicianOnboardingProps) {
  const [formData, setFormData] = useState<MusicianApplication>({
    artistName: '',
    bio: '',
    links: [],
  });
  const [currentLink, setCurrentLink] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.artistName.trim()) {
      setError('Название артиста/группы обязательно');
      return;
    }

    setIsSubmitting(true);

    try {
      const token = getToken();
      if (!token) {
        throw new Error('Необходима авторизация');
      }

      const response = await fetch('/api/musician/apply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Ошибка при отправке заявки');
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при отправке заявки');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddLink = () => {
    if (currentLink.trim() && !formData.links?.includes(currentLink.trim())) {
      setFormData((prev) => ({
        ...prev,
        links: [...(prev.links || []), currentLink.trim()],
      }));
      setCurrentLink('');
    }
  };

  const handleRemoveLink = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      links: prev.links?.filter((_, i) => i !== index) || [],
    }));
  };

  return (
    <div className="musician-onboarding">
      <h2 className="musician-onboarding__title">Стать музыкантом</h2>
      <p className="musician-onboarding__description">
        Заполните форму, чтобы подать заявку на статус музыканта. После рассмотрения заявки вам
        станет доступен полный функционал личного кабинета.
      </p>

      <form onSubmit={handleSubmit} className="musician-onboarding__form">
        <div className="musician-onboarding__field">
          <label htmlFor="artist-name" className="musician-onboarding__label">
            Название артиста/группы <span className="musician-onboarding__required">*</span>
          </label>
          <input
            id="artist-name"
            type="text"
            value={formData.artistName}
            onChange={(e) => setFormData((prev) => ({ ...prev, artistName: e.target.value }))}
            className="musician-onboarding__input"
            placeholder="Введите название артиста или группы"
            required
            disabled={isSubmitting}
          />
        </div>

        <div className="musician-onboarding__field">
          <label htmlFor="bio" className="musician-onboarding__label">
            Биография (необязательно)
          </label>
          <textarea
            id="bio"
            value={formData.bio}
            onChange={(e) => setFormData((prev) => ({ ...prev, bio: e.target.value }))}
            className="musician-onboarding__textarea"
            placeholder="Расскажите о себе или своей группе"
            rows={5}
            disabled={isSubmitting}
          />
        </div>

        <div className="musician-onboarding__field">
          <label className="musician-onboarding__label">Ссылки (необязательно)</label>
          <div className="musician-onboarding__links-input">
            <input
              type="url"
              value={currentLink}
              onChange={(e) => setCurrentLink(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddLink();
                }
              }}
              className="musician-onboarding__input"
              placeholder="https://..."
              disabled={isSubmitting}
            />
            <button
              type="button"
              onClick={handleAddLink}
              className="musician-onboarding__add-link"
              disabled={isSubmitting || !currentLink.trim()}
            >
              Добавить
            </button>
          </div>
          {formData.links && formData.links.length > 0 && (
            <ul className="musician-onboarding__links-list">
              {formData.links.map((link, index) => (
                <li key={index} className="musician-onboarding__link-item">
                  <a
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="musician-onboarding__link"
                  >
                    {link}
                  </a>
                  <button
                    type="button"
                    onClick={() => handleRemoveLink(index)}
                    className="musician-onboarding__remove-link"
                    disabled={isSubmitting}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {error && <div className="musician-onboarding__error">{error}</div>}

        <div className="musician-onboarding__actions">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="musician-onboarding__cancel"
              disabled={isSubmitting}
            >
              Отмена
            </button>
          )}
          <button
            type="submit"
            className="musician-onboarding__submit"
            disabled={isSubmitting || !formData.artistName.trim()}
          >
            {isSubmitting ? 'Отправка...' : 'Отправить заявку'}
          </button>
        </div>
      </form>
    </div>
  );
}
