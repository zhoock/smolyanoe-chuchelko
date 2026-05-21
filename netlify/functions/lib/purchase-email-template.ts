import { fillEmailTemplate, getEmailCopy } from './email-copy';
import { getSupportEmail } from './email-support';
import type { EmailLocale } from './email-locale';
import { escapeHtml } from './email-utils';

export interface PurchaseEmailContent {
  html: string;
  text: string;
  subject: string;
}

export function buildPurchaseEmailContent(options: {
  locale: EmailLocale;
  customerName?: string;
  albumName: string;
  artistName: string;
  orderId: string;
  purchaseToken: string;
  siteUrl: string;
  tracks: Array<{ trackId: string; title: string }>;
}): PurchaseEmailContent {
  const copy = getEmailCopy('purchase', options.locale);
  const orderShort = options.orderId.slice(0, 8);
  const greetingTemplate = options.customerName ? copy.greetingNamed : copy.greetingGeneric;
  const greeting = fillEmailTemplate(greetingTemplate, {
    name: options.customerName?.trim() ?? '',
  });
  const orderPaid = fillEmailTemplate(copy.orderPaid, { orderId: orderShort });
  const supportEmail = getSupportEmail();

  const tracksList = options.tracks
    .map(
      (track, index) => `
        <tr style="border-bottom: 1px solid #e0e0e0;">
          <td style="padding: 12px 0; color: #333;">${index + 1}.</td>
          <td style="padding: 12px 0; color: #333;">${escapeHtml(track.title)}</td>
          <td style="padding: 12px 0; text-align: right;">
            <a href="${options.siteUrl}/api/download?token=${options.purchaseToken}&track=${track.trackId}"
               style="color: #4CAF50; text-decoration: none; font-weight: 500;">
              ${escapeHtml(copy.download)}
            </a>
          </td>
        </tr>
      `
    )
    .join('');

  const html = `
<!DOCTYPE html>
<html lang="${options.locale}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(copy.htmlTitle)}</title>
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px;background-color:#f5f5f5;">
  <div style="background-color:white;border-radius:8px;padding:30px;box-shadow:0 2px 4px rgba(0,0,0,0.1);">
    <h1 style="color:#4CAF50;margin-top:0;">${escapeHtml(copy.htmlTitle)}</h1>
    <p>${escapeHtml(greeting)}</p>
    <p>${orderPaid}</p>
    <h2 style="color:#333;margin-top:30px;margin-bottom:15px;">
      ${escapeHtml(options.artistName)} — ${escapeHtml(options.albumName)}
    </h2>
    <table style="width:100%;border-collapse:collapse;margin:20px 0;">
      <thead>
        <tr style="border-bottom:2px solid #4CAF50;">
          <th style="text-align:left;padding:10px 0;color:#666;font-weight:600;width:40px;">#</th>
          <th style="text-align:left;padding:10px 0;color:#666;font-weight:600;">${escapeHtml(copy.trackColumn)}</th>
          <th style="text-align:right;padding:10px 0;color:#666;font-weight:600;">${escapeHtml(copy.download)}</th>
        </tr>
      </thead>
      <tbody>
        ${tracksList}
      </tbody>
    </table>
    <hr style="border:none;border-top:1px solid #e0e0e0;margin:30px 0;">
    <p style="color:#666;font-size:14px;margin:0;">
      ${escapeHtml(copy.supportPrompt)}
      <a href="mailto:${escapeHtml(supportEmail)}" style="color:#4CAF50;">${escapeHtml(supportEmail)}</a>
    </p>
  </div>
</body>
</html>`.trim();

  const text = `${copy.textThanks}

${greeting}

${fillEmailTemplate(copy.orderPaid.replace(/<\/?strong>/g, ''), { orderId: orderShort })}

${options.artistName} — ${options.albumName}

${copy.textTracksHeader}
${options.tracks
  .map(
    (t, i) =>
      `${i + 1}. ${t.title}\n   ${copy.textDownloadLabel}: ${options.siteUrl}/api/download?token=${options.purchaseToken}&track=${t.trackId}`
  )
  .join('\n')}

${copy.textSupportPrompt} ${supportEmail}`;

  return {
    html,
    text,
    subject: `${copy.subjectPrefix}: ${options.artistName} — ${options.albumName}`,
  };
}
