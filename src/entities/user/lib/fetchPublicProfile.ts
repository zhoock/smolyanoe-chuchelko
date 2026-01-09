import type { PublicProfileData } from './types';

interface ApiResponse {
  success: boolean;
  data?:
    | (PublicProfileData & {
        password?: string;
        siteName?: string | null;
      })
    | null;
  error?: string;
}

export async function fetchPublicProfile(
  username: string,
  lang?: string
): Promise<PublicProfileData> {
  const params = new URLSearchParams({ username });
  if (lang) {
    params.set('lang', lang);
  }

  const response = await fetch(`/api/user-profile?${params.toString()}`, {
    headers: {
      'Cache-Control': 'no-cache',
    },
  });

  if (response.status === 404) {
    throw Object.assign(new Error('User not found'), { status: 404 });
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to load profile: ${response.status} ${text}`);
  }

  const payload: ApiResponse = await response.json();
  if (!payload.success || !payload.data) {
    throw new Error(payload.error || 'Profile request failed');
  }

  return {
    userId: payload.data.userId,
    username: payload.data.username,
    siteName: payload.data.siteName,
    role: payload.data.role,
    musicianStatus: payload.data.musicianStatus,
    musicianRejectReason: payload.data.musicianRejectReason,
    musicianAppliedAt: payload.data.musicianAppliedAt,
    musicianApprovedAt: payload.data.musicianApprovedAt,
    artistName: payload.data.artistName,
    bio: payload.data.bio,
    links: payload.data.links,
    theBand: payload.data.theBand,
    headerImages: payload.data.headerImages,
  };
}
