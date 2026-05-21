import { fillEmailTemplate, getEmailCopy } from './email-copy';
import type { EmailLocale } from './email-locale';
import { escapeHtml } from './email-utils';

export interface VerificationEmailContent {
  html: string;
  text: string;
  subject: string;
}

const COLORS = {
  pageBg: '#f3f4f6',
  cardBg: '#ffffff',
  title: '#111827',
  body: '#6b7280',
  gold: '#c9a227',
  goldSoft: '#f7f1e3',
  footer: '#9ca3af',
  divider: '#e5dcc8',
};

function envelopeIconCell(): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 28px auto;">
      <tr>
        <td align="center" valign="middle" width="72" height="72" style="width:72px;height:72px;border-radius:999px;background:${COLORS.goldSoft};border:1px solid ${COLORS.divider};font-size:28px;line-height:72px;color:${COLORS.gold};">
          &#9993;
        </td>
      </tr>
    </table>
  `.trim();
}

export function buildVerificationEmailContent(options: {
  locale: EmailLocale;
  verifyUrl: string;
  userName?: string;
  siteName: string;
}): VerificationEmailContent {
  const copy = getEmailCopy('verification', options.locale);
  const verifyUrl = escapeHtml(options.verifyUrl);
  const greetingTemplate = options.userName ? copy.greetingNamed : copy.greetingGeneric;
  const greeting = escapeHtml(
    fillEmailTemplate(greetingTemplate, {
      name: options.userName?.trim() ?? '',
    })
  );
  const body = escapeHtml(fillEmailTemplate(copy.body, { siteName: options.siteName }));
  const footer = escapeHtml(fillEmailTemplate(copy.footer, { siteName: options.siteName }));

  const html = `
<!DOCTYPE html>
<html lang="${options.locale}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${escapeHtml(copy.htmlTitle)}</title>
</head>
<body style="margin:0;padding:0;background-color:${COLORS.pageBg};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${COLORS.pageBg};">
    <tr>
      <td align="center" style="padding:48px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background-color:${COLORS.cardBg};border-radius:18px;box-shadow:0 8px 32px rgba(17,24,39,0.08);">
          <tr>
            <td style="padding:48px 40px 40px 40px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
              ${envelopeIconCell()}
              <h1 style="margin:0 0 16px 0;padding:0;color:${COLORS.title};font-size:28px;line-height:1.25;font-weight:700;text-align:center;">
                ${escapeHtml(copy.htmlTitle)}
              </h1>
              <table role="presentation" width="72" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 24px auto;">
                <tr>
                  <td style="height:2px;background-color:${COLORS.gold};border-radius:999px;font-size:0;line-height:0;">&nbsp;</td>
                </tr>
              </table>
              <p style="margin:0 0 16px 0;color:${COLORS.body};font-size:16px;line-height:1.65;text-align:center;">
                ${greeting}
              </p>
              <p style="margin:0 0 32px 0;color:${COLORS.body};font-size:16px;line-height:1.65;text-align:center;">
                ${body}
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 32px auto;">
                <tr>
                  <td align="center" bgcolor="${COLORS.gold}" style="border-radius:12px;background-color:${COLORS.gold};">
                    <a href="${verifyUrl}"
                       style="display:inline-block;padding:14px 28px;color:#111827;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:15px;line-height:1.2;font-weight:700;text-decoration:none;">
                      ${escapeHtml(copy.cta)}
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 32px 0;color:${COLORS.footer};font-size:12px;line-height:1.5;text-align:center;word-break:break-all;">
                ${escapeHtml(copy.copyLinkLabel)}<br>
                <a href="${verifyUrl}" style="color:${COLORS.gold};text-decoration:underline;">${verifyUrl}</a>
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #eceff3;">
                <tr>
                  <td style="padding-top:20px;color:${COLORS.footer};font-size:12px;line-height:1.5;text-align:center;">
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
  const textFooter = fillEmailTemplate(copy.footer, { siteName: options.siteName });

  const text = `${copy.htmlTitle}

${textGreeting}

${textBody}

${copy.cta}: ${options.verifyUrl}

${textFooter}`;

  return {
    html,
    text,
    subject: copy.subject,
  };
}
