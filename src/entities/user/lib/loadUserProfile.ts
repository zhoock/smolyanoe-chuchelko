/**
 * Утилита для загрузки полного профиля пользователя с ролями и статусами
 */

import { getToken, getUser } from '@shared/lib/auth';
import type { UserProfile } from '@shared/types/user';

export async function loadUserProfile(): Promise<UserProfile | null> {
  try {
    const token = getToken();
    if (!token) {
      return null;
    }

    const user = getUser();
    if (!user) {
      return null;
    }

    const response = await fetch('/api/user-profile', {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      return null;
    }

    const result = await response.json();

    if (!result.success || !result.data) {
      return null;
    }

    const data = result.data;

    return {
      id: user.id,
      email: user.email || '',
      name: user.name || undefined,
      role: (data.role as any) || 'user',
      musicianStatus: (data.musicianStatus as any) || 'none',
      musicianRejectReason: data.musicianRejectReason || undefined,
      musicianAppliedAt: data.musicianAppliedAt || undefined,
      musicianApprovedAt: data.musicianApprovedAt || undefined,
      artistName: data.artistName || undefined,
      bio: data.bio || undefined,
      links: data.links || undefined,
      siteName: data.siteName || undefined,
      theBand: data.theBand || undefined,
      headerImages: data.headerImages || undefined,
    };
  } catch (error) {
    console.error('Error loading user profile:', error);
    return null;
  }
}
