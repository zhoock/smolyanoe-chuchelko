/**
 * Типы для ролей и статусов пользователей
 */

export type UserRole = 'user' | 'musician' | 'admin';

export type MusicianStatus = 'none' | 'pending' | 'approved' | 'rejected';

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  name?: string;
  role: UserRole;
  musicianStatus: MusicianStatus;
  musicianRejectReason?: string;
  musicianAppliedAt?: string;
  musicianApprovedAt?: string;
  artistName?: string;
  bio?: string;
  links?: string[];
  siteName?: string;
  theBand?: string[];
  headerImages?: string[];
}

export interface MusicianApplication {
  artistName: string;
  bio?: string;
  links?: string[];
}

/**
 * Проверяет, является ли пользователь одобренным музыкантом
 */
export function isMusicianApproved(profile: UserProfile): boolean {
  return profile.role === 'musician' && profile.musicianStatus === 'approved';
}

/**
 * Проверяет, находится ли заявка музыканта на рассмотрении
 */
export function isMusicianPending(profile: UserProfile): boolean {
  return profile.musicianStatus === 'pending';
}

/**
 * Проверяет, была ли отклонена заявка музыканта
 */
export function isMusicianRejected(profile: UserProfile): boolean {
  return profile.musicianStatus === 'rejected';
}

/**
 * Проверяет, может ли пользователь подать заявку на музыканта
 */
export function canApplyForMusician(profile: UserProfile): boolean {
  return profile.musicianStatus === 'none' || profile.musicianStatus === 'rejected';
}

/**
 * Проверяет, является ли пользователь админом
 */
export function isAdmin(profile: UserProfile): boolean {
  return profile.role === 'admin';
}

/**
 * Проверяет, имеет ли пользователь доступ к полному функционалу (админ или одобренный музыкант)
 */
export function hasFullAccess(profile: UserProfile): boolean {
  return isAdmin(profile) || isMusicianApproved(profile);
}
