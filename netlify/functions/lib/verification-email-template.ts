import { fillEmailTemplate, getEmailCopy } from './email-copy';
import type { EmailLocale } from './email-locale';
import { escapeHtml } from './email-utils';

export interface VerificationEmailContent {
  html: string;
  text: string;
  subject: string;
}

export function buildVerificationEmailContent(options: {
  locale: EmailLocale;
  verifyUrl: string;
  userName?: string;
  siteName: string;
}): VerificationEmailContent {
  const copy = getEmailCopy('verification', options.locale);
  const siteName = escapeHtml(options.siteName);
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
  <title>${escapeHtml(copy.htmlTitle)}</title>
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#A1A1AA;max-width:600px;margin:0 auto;padding:24px;background-color:#1A1A1A;">
  <div style="background-color:#1A1A1A;border:1px solid #3f3f46;border-radius:12px;padding:32px;">
    <p style="margin:0 0 8px;color:#D4A017;font-size:14px;font-weight:600;letter-spacing:0.05em;">${siteName}</p>
    <div style="text-align:center;margin:24px 0;">
      <div style="display:inline-block;width:64px;height:64px;border-radius:50%;background:rgba(212,160,23,0.15);line-height:64px;font-size:28px;">✉</div>
    </div>
    <h1 style="color:#ffffff;margin:0 0 16px;font-size:24px;text-align:center;">${escapeHtml(copy.htmlTitle)}</h1>
    <p style="margin:0 0 24px;text-align:center;">${greeting}</p>
    <p style="margin:0 0 24px;text-align:center;">${body}</p>
    <p style="text-align:center;margin:0 0 32px;">
      <a href="${verifyUrl}"
         style="display:inline-block;background-color:#D4A017;color:#1A1A1A;text-decoration:none;font-weight:600;padding:14px 28px;border-radius:8px;">
        ${escapeHtml(copy.cta)}
      </a>
    </p>
    <p style="margin:0;font-size:12px;color:#71717a;word-break:break-all;text-align:center;">
      ${escapeHtml(copy.copyLinkLabel)}<br>
      <a href="${verifyUrl}" style="color:#D4A017;">${verifyUrl}</a>
    </p>
    <hr style="border:none;border-top:1px solid #3f3f46;margin:32px 0 16px;">
    <p style="margin:0;font-size:12px;color:#71717a;text-align:center;">${footer}</p>
  </div>
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
