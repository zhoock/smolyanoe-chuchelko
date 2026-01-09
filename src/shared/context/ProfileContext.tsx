import { createContext, useContext } from 'react';
import type { PublicProfileData } from '@entities/user/lib/types';

export interface ProfileContextValue {
  username: string;
  profile: PublicProfileData | null;
  isOwner: boolean;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({
  value,
  children,
}: {
  value: ProfileContextValue;
  children: React.ReactNode;
}) {
  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfileContext(): ProfileContextValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) {
    throw new Error('useProfileContext must be used within a ProfileProvider');
  }
  return ctx;
}
