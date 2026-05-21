import { fillEmailTemplate, getEmailCopy } from './email-copy';
import { buildSupportMailto } from './email-support';
import type { EmailLocale } from './email-locale';
import { escapeHtml, getSiteDisplayName } from './email-utils';

export interface AccountDeletedEmailContent {
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
  warningBg: '#faf6ee',
  warningBorder: '#eadfca',
  warningTitle: '#374151',
  footer: '#9ca3af',
  divider: '#e5dcc8',
};

function trashIconCell(): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 28px auto;">
      <tr>
        <td align="center" valign="middle" width="72" height="72" style="width:72px;height:72px;border-radius:999px;background:${COLORS.goldSoft};border:1px solid ${COLORS.divider};font-size:28px;line-height:72px;color:${COLORS.gold};">
          &#128465;
        </td>
      </tr>
    </table>
  `.trim();
}

function shieldIconCell(): string {
  return `
    <td valign="top" width="28" style="width:28px;padding-top:2px;font-size:18px;line-height:1;color:${COLORS.gold};">
      &#9888;
    </td>
  `.trim();
}

export function buildAccountDeletedEmailContent(locale: EmailLocale): AccountDeletedEmailContent {
  const copy = getEmailCopy('accountDeleted', locale);
  const siteNameRaw = getSiteDisplayName();
  const siteName = escapeHtml(siteNameRaw);
  const supportMailto = buildSupportMailto({ locale, template: 'accountDeleted' });
  const subtitle = escapeHtml(fillEmailTemplate(copy.subtitle, { siteName: siteNameRaw }));

  const html = `
<!DOCTYPE html>
<html lang="${locale}">
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
              ${trashIconCell()}
              <h1 style="margin:0 0 16px 0;padding:0;color:${COLORS.title};font-size:28px;line-height:1.25;font-weight:700;text-align:center;">
                ${escapeHtml(copy.htmlTitle)}
              </h1>
              <table role="presentation" width="72" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 24px auto;">
                <tr>
                  <td style="height:2px;background-color:${COLORS.gold};border-radius:999px;font-size:0;line-height:0;">&nbsp;</td>
                </tr>
              </table>
              <p style="margin:0 0 32px 0;color:${COLORS.body};font-size:16px;line-height:1.65;text-align:center;">
                ${subtitle}
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 32px 0;background-color:${COLORS.warningBg};border:1px solid ${COLORS.warningBorder};border-radius:14px;">
                <tr>
                  <td style="padding:20px 22px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        ${shieldIconCell()}
                        <td style="padding-left:12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
                          <p style="margin:0 0 6px 0;color:${COLORS.warningTitle};font-size:15px;line-height:1.4;font-weight:700;">
                            ${copy.warningTitle}
                          </p>
                          <p style="margin:0;color:${COLORS.body};font-size:14px;line-height:1.6;">
                            ${copy.warningBody}
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 36px auto;">
                <tr>
                  <td align="center" bgcolor="${COLORS.gold}" style="border-radius:12px;background-color:${COLORS.gold};">
                    <a href="${supportMailto}"
                       style="display:inline-block;padding:14px 28px;color:#111827;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:15px;line-height:1.2;font-weight:700;text-decoration:none;">
                      &#127911; ${escapeHtml(copy.cta)}
                    </a>
                  </td>
                </tr>
              </table>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #eceff3;">
                <tr>
                  <td style="padding-top:20px;color:${COLORS.footer};font-size:12px;line-height:1.5;text-align:center;">
                    ${escapeHtml(copy.footer)}
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

  const text = `${copy.htmlTitle}

${fillEmailTemplate(copy.textIntro, { siteName: siteNameRaw })}

${copy.textWarningTitle}
${copy.textWarningBody}

${copy.textCtaLabel}: ${buildSupportMailto({ locale, template: 'accountDeleted' })}

${copy.footer}`;

  return {
    html,
    text,
    subject: copy.subject,
  };
}
