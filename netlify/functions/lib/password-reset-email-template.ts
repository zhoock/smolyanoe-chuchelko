import { fillEmailTemplate, getEmailCopy } from './email-copy';
import type { EmailLocale } from './email-locale';
import { escapeHtml } from './email-utils';

export interface PasswordResetEmailContent {
  html: string;
  text: string;
  subject: string;
}

/**
 * Dark / gold visual language matching the public app's auth modal.
 * Kept in inline styles for max compatibility with email clients.
 */
const COLORS = {
  pageBg: '#050508',
  cardBg: '#0e0f12',
  cardBorder: '#1f2126',
  title: '#ffffff',
  body: '#b5b6b8',
  bodyMuted: '#7c7e83',
  gold: '#c9b458',
  goldStrong: '#d4c76a',
  goldSoft: 'rgba(201, 180, 88, 0.12)',
  divider: '#1f2126',
};

const LOCK_ICON_SVG = `
  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="4" y="11" width="16" height="10" rx="2" stroke="${COLORS.gold}" stroke-width="1.5" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="${COLORS.gold}" stroke-width="1.5" stroke-linecap="round" />
    <circle cx="12" cy="16" r="1.2" fill="${COLORS.gold}" />
  </svg>
`.trim();

function lockIconCell(): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 24px auto;">
      <tr>
        <td align="center" valign="middle" width="64" height="64" style="width:64px;height:64px;border-radius:999px;background:${COLORS.goldSoft};border:1px solid ${COLORS.gold};">
          ${LOCK_ICON_SVG}
        </td>
      </tr>
    </table>
  `.trim();
}

export function buildPasswordResetEmailContent(options: {
  locale: EmailLocale;
  resetUrl: string;
  userName?: string | null;
  siteName: string;
  expiresInMinutes: number;
}): PasswordResetEmailContent {
  const copy = getEmailCopy('passwordReset', options.locale);
  const resetUrl = escapeHtml(options.resetUrl);
  const greetingTemplate = options.userName ? copy.greetingNamed : copy.greetingGeneric;
  const greeting = escapeHtml(
    fillEmailTemplate(greetingTemplate, {
      name: options.userName?.trim() ?? '',
    })
  );
  const body = escapeHtml(fillEmailTemplate(copy.body, { siteName: options.siteName }));
  const expiryNotice = escapeHtml(
    fillEmailTemplate(copy.expiryNotice, { minutes: String(options.expiresInMinutes) })
  );
  const ignoreNotice = escapeHtml(copy.ignoreNotice);
  const footer = escapeHtml(fillEmailTemplate(copy.footer, { siteName: options.siteName }));

  const html = `
<!DOCTYPE html>
<html lang="${options.locale}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${escapeHtml(copy.title)}</title>
</head>
<body style="margin:0;padding:0;background-color:${COLORS.pageBg};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${COLORS.pageBg};">
    <tr>
      <td align="center" style="padding:48px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background-color:${COLORS.cardBg};border-radius:16px;border:1px solid ${COLORS.cardBorder};">
          <tr>
            <td style="padding:44px 40px 36px 40px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
              ${lockIconCell()}
              <h1 style="margin:0 0 16px 0;padding:0;color:${COLORS.title};font-size:26px;line-height:1.25;font-weight:700;text-align:center;letter-spacing:0.01em;">
                ${escapeHtml(copy.title)}
              </h1>
              <table role="presentation" width="64" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 24px auto;">
                <tr>
                  <td style="height:1px;background-color:${COLORS.gold};border-radius:999px;font-size:0;line-height:0;">&nbsp;</td>
                </tr>
              </table>
              <p style="margin:0 0 12px 0;color:${COLORS.body};font-size:15px;line-height:1.6;text-align:center;">
                ${greeting}
              </p>
              <p style="margin:0 0 32px 0;color:${COLORS.body};font-size:15px;line-height:1.6;text-align:center;">
                ${body}
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 24px auto;">
                <tr>
                  <td align="center" bgcolor="${COLORS.gold}" style="border-radius:10px;background-color:${COLORS.gold};">
                    <a href="${resetUrl}"
                       style="display:inline-block;padding:14px 32px;color:#111111;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:15px;line-height:1.2;font-weight:700;text-decoration:none;letter-spacing:0.02em;">
                      ${escapeHtml(copy.cta)}
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 28px 0;color:${COLORS.bodyMuted};font-size:13px;line-height:1.5;text-align:center;">
                ${expiryNotice}
              </p>
              <p style="margin:0 0 8px 0;color:${COLORS.bodyMuted};font-size:12px;line-height:1.5;text-align:center;">
                ${escapeHtml(copy.fallbackLabel)}
              </p>
              <p style="margin:0 0 32px 0;color:${COLORS.bodyMuted};font-size:12px;line-height:1.5;text-align:center;word-break:break-all;">
                <a href="${resetUrl}" style="color:${COLORS.goldStrong};text-decoration:underline;">${resetUrl}</a>
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid ${COLORS.divider};">
                <tr>
                  <td style="padding-top:20px;color:${COLORS.bodyMuted};font-size:12px;line-height:1.55;text-align:center;">
                    ${ignoreNotice}
                  </td>
                </tr>
                <tr>
                  <td style="padding-top:12px;color:${COLORS.bodyMuted};font-size:11px;line-height:1.5;text-align:center;">
                    ${footer}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();

  const textGreeting = fillEmailTemplate(greetingTemplate, {
    name: options.userName?.trim() ?? '',
  });
  const textBody = fillEmailTemplate(copy.body, { siteName: options.siteName });
  const textExpiry = fillEmailTemplate(copy.expiryNotice, {
    minutes: String(options.expiresInMinutes),
  });
  const textFooter = fillEmailTemplate(copy.footer, { siteName: options.siteName });

  const text = `${copy.title}

${textGreeting}

${textBody}

${copy.cta}: ${options.resetUrl}

${textExpiry}

${copy.ignoreNotice}

${textFooter}`;

  return {
    html,
    text,
    subject: copy.subject,
  };
}
