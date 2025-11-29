// src/pages/UserDashboard/components/ProfileSection.tsx
/**
 * Компонент секции профиля пользователя в новом дизайне dashboard
 */
import { useState, useEffect, memo } from 'react';
import { getUser } from '@shared/lib/auth';
import './ProfileSection.style.scss';

interface ProfileSectionProps {
  userId?: string;
}

export const ProfileSection = memo(function ProfileSection({ userId }: ProfileSectionProps) {
  const user = getUser();

  // Инициализируем состояние один раз при монтировании
  const [profileData, setProfileData] = useState(() => ({
    name: user?.name || '',
    username: user?.email?.split('@')[0] || '', // Временно используем часть email как username
    email: user?.email || '',
    location: '', // Пока нет в API, будет добавлено позже
  }));

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Обновляем только при изменении userId или user.id
  useEffect(() => {
    if (user?.id === userId && user) {
      setProfileData({
        name: user.name || '',
        username: user.email?.split('@')[0] || '',
        email: user.email || '',
        location: '',
      });
    }
  }, [user?.id, user?.name, user?.email, userId]);

  const handleInputChange = (field: keyof typeof profileData, value: string) => {
    setProfileData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    // TODO: Здесь будет API для сохранения профиля
    // Пока просто имитируем сохранение
    setTimeout(() => {
      setIsSaving(false);
      setIsEditing(false);
      alert('Profile saved successfully');
    }, 500);
  };

  const handleCancel = () => {
    if (user) {
      setProfileData({
        name: user.name || '',
        username: user.email?.split('@')[0] || '',
        email: user.email || '',
        location: '',
      });
    }
    setIsEditing(false);
  };

  // Показываем placeholder аватар, если нет фото
  const avatarUrl = user?.name
    ? `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&size=128&background=random`
    : null;

  return (
    <div className="profile-section">
      <div className="profile-section__avatar">
        {avatarUrl ? (
          <img src={avatarUrl} alt={user?.name || 'User'} className="profile-section__avatar-img" />
        ) : (
          <div className="profile-section__avatar-placeholder">
            {user?.name?.[0]?.toUpperCase() || 'U'}
          </div>
        )}
      </div>

      <h2 className="profile-section__title">Profile</h2>

      <div className="profile-section__fields">
        <div className="profile-section__field">
          <label htmlFor="profile-name" className="profile-section__label">
            Name
          </label>
          <input
            id="profile-name"
            type="text"
            className="profile-section__input"
            value={profileData.name}
            onChange={(e) => handleInputChange('name', e.target.value)}
            disabled={!isEditing}
            placeholder="John Doe"
          />
        </div>

        <div className="profile-section__field">
          <label htmlFor="profile-username" className="profile-section__label">
            Username
          </label>
          <input
            id="profile-username"
            type="text"
            className="profile-section__input"
            value={profileData.username}
            onChange={(e) => handleInputChange('username', e.target.value)}
            disabled={!isEditing}
            placeholder="johndoe"
          />
        </div>

        <div className="profile-section__field">
          <label htmlFor="profile-email" className="profile-section__label">
            Email
          </label>
          <input
            id="profile-email"
            type="email"
            className="profile-section__input"
            value={profileData.email}
            onChange={(e) => handleInputChange('email', e.target.value)}
            disabled={!isEditing}
            placeholder="johndoe@example.com"
          />
        </div>

        <div className="profile-section__field">
          <label htmlFor="profile-location" className="profile-section__label">
            Location
          </label>
          <input
            id="profile-location"
            type="text"
            className="profile-section__input"
            value={profileData.location}
            onChange={(e) => handleInputChange('location', e.target.value)}
            disabled={!isEditing}
            placeholder="San Francisco, CA"
          />
        </div>
      </div>

      {isEditing ? (
        <div className="profile-section__actions">
          <button
            type="button"
            className="profile-section__button profile-section__button--save"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
          <button
            type="button"
            className="profile-section__button profile-section__button--cancel"
            onClick={handleCancel}
            disabled={isSaving}
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="profile-section__button profile-section__button--edit"
          onClick={() => setIsEditing(true)}
        >
          Edit Profile
        </button>
      )}
    </div>
  );
});
