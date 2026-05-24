export const SOCIAL_PLATFORMS = ['instagram', 'facebook', 'youtube', 'vk'] as const;

export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

export type SocialLinks = Partial<Record<SocialPlatform, string>>;

export type SocialLinksFormState = Record<SocialPlatform, string>;

export const EMPTY_SOCIAL_LINKS_FORM: SocialLinksFormState = {
  instagram: '',
  facebook: '',
  youtube: '',
  vk: '',
};

export function socialLinksToFormState(
  links: SocialLinks | null | undefined
): SocialLinksFormState {
  return {
    instagram: links?.instagram?.trim() ?? '',
    facebook: links?.facebook?.trim() ?? '',
    youtube: links?.youtube?.trim() ?? '',
    vk: links?.vk?.trim() ?? '',
  };
}

export function normalizeSocialLinksForSave(form: SocialLinksFormState): SocialLinks {
  const result: SocialLinks = {};
  for (const platform of SOCIAL_PLATFORMS) {
    const trimmed = form[platform]?.trim();
    if (trimmed) {
      result[platform] = trimmed;
    }
  }
  return result;
}

export function socialLinksFormStatesEqual(
  a: SocialLinksFormState,
  b: SocialLinksFormState
): boolean {
  return SOCIAL_PLATFORMS.every((platform) => a[platform] === b[platform]);
}

export function parseSocialLinksFromApi(value: unknown): SocialLinks {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const parsed: SocialLinks = {};
  for (const platform of SOCIAL_PLATFORMS) {
    const url = (value as Record<string, unknown>)[platform];
    if (typeof url === 'string' && url.trim()) {
      parsed[platform] = url.trim();
    }
  }
  return parsed;
}

export function socialLinksToList(
  links: SocialLinks | null | undefined
): Array<{ platform: SocialPlatform; href: string }> {
  return SOCIAL_PLATFORMS.filter((platform) => Boolean(links?.[platform]?.trim())).map(
    (platform) => ({
      platform,
      href: links![platform]!.trim(),
    })
  );
}
