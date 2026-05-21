import type { EmailLocale } from './email-locale';
import { getEmailCopy } from './email-copy';

export function getSupportEmail(): string {
  return (process.env.SUPPORT_EMAIL || 'feedback@smolyanoechuchelko.ru').trim();
}

export type SupportMailtoTemplate = 'accountDeleted' | 'purchase' | 'passwordReset';

export function buildSupportMailto(options?: {
  locale?: EmailLocale;
  template?: SupportMailtoTemplate;
  subject?: string;
}): string {
  const email = getSupportEmail();
  const locale = options?.locale ?? 'en';
  const subject =
    options?.subject ??
    (options?.template ? getEmailCopy('supportSubjects', locale)[options.template] : undefined);

  if (!subject) {
    return `mailto:${email}`;
  }

  return `mailto:${email}?subject=${encodeURIComponent(subject)}`;
}
