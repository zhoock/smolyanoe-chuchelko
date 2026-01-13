/**
 * Утилиты для отправки email через Resend
 */

import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

interface SendPurchaseEmailOptions {
  to: string;
  customerName?: string;
  albumName: string;
  artistName: string;
  orderId: string;
  purchaseToken: string;
  tracks: Array<{
    trackId: string;
    title: string;
  }>;
  siteUrl?: string;
}

/**
 * Отправляет email покупателю с информацией о покупке и ссылками на скачивание
 */
export async function sendPurchaseEmail(
  options: SendPurchaseEmailOptions
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!process.env.RESEND_API_KEY) {
      console.error('❌ RESEND_API_KEY is not set');
      console.error('❌ Available env vars:', {
        hasResendKey: !!process.env.RESEND_API_KEY,
        hasNetlifySiteUrl: !!process.env.NETLIFY_SITE_URL,
        nodeEnv: process.env.NODE_ENV,
      });
      return { success: false, error: 'Email service not configured: RESEND_API_KEY is missing' };
    }

    const siteUrl =
      options.siteUrl || process.env.NETLIFY_SITE_URL || 'https://smolyanoechuchelko.ru';

    // Формируем список треков с ссылками на скачивание
    const tracksList = options.tracks
      .map(
        (track, index) => `
        <tr style="border-bottom: 1px solid #e0e0e0;">
          <td style="padding: 12px 0; color: #333;">${index + 1}.</td>
          <td style="padding: 12px 0; color: #333;">${escapeHtml(track.title)}</td>
          <td style="padding: 12px 0; text-align: right;">
            <a href="${siteUrl}/api/download?token=${options.purchaseToken}&track=${track.trackId}" 
               style="color: #4CAF50; text-decoration: none; font-weight: 500;">
              Скачать
            </a>
          </td>
        </tr>
      `
      )
      .join('');

    const customerGreeting = options.customerName
      ? `Здравствуйте, ${escapeHtml(options.customerName)}!`
      : 'Здравствуйте!';

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Спасибо за покупку!</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
  <div style="background-color: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    <h1 style="color: #4CAF50; margin-top: 0;">Спасибо за покупку! ✅</h1>
    
    <p>${customerGreeting}</p>
    
    <p>Ваш заказ <strong>#${options.orderId.slice(0, 8)}</strong> успешно оплачен.</p>
    
    <h2 style="color: #333; margin-top: 30px; margin-bottom: 15px;">
      ${escapeHtml(options.artistName)} — ${escapeHtml(options.albumName)}
    </h2>
    
    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
      <thead>
        <tr style="border-bottom: 2px solid #4CAF50;">
          <th style="text-align: left; padding: 10px 0; color: #666; font-weight: 600; width: 40px;">#</th>
          <th style="text-align: left; padding: 10px 0; color: #666; font-weight: 600;">Трек</th>
          <th style="text-align: right; padding: 10px 0; color: #666; font-weight: 600;">Скачать</th>
        </tr>
      </thead>
      <tbody>
        ${tracksList}
      </tbody>
    </table>
    
    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
    
    <p style="color: #666; font-size: 14px; margin: 0;">
      Если у вас возникли вопросы, пожалуйста, свяжитесь с нами: 
      <a href="mailto:feedback@smolyanoechuchelko.ru" style="color: #4CAF50;">feedback@smolyanoechuchelko.ru</a>
    </p>
  </div>
</body>
</html>
    `;

    const text = `
Спасибо за покупку!

${customerGreeting}

Ваш заказ #${options.orderId.slice(0, 8)} успешно оплачен.

${options.artistName} — ${options.albumName}

Треки:
${options.tracks.map((t, i) => `${i + 1}. ${t.title}\n   Скачать: ${siteUrl}/api/download?token=${options.purchaseToken}&track=${t.trackId}`).join('\n')}

Если у вас возникли вопросы, пожалуйста, свяжитесь с нами: feedback@smolyanoechuchelko.ru
    `;

    const result = await resend.emails.send({
      from: 'Смоляное чучелко <noreply@smolyanoechuchelko.ru>',
      to: options.to,
      subject: `Спасибо за покупку: ${options.artistName} — ${options.albumName}`,
      html,
      text,
    });

    if (result.error) {
      console.error('❌ Error sending email:', result.error);
      return { success: false, error: result.error.message || 'Failed to send email' };
    }

    console.log('✅ Purchase email sent successfully:', {
      to: options.to,
      orderId: options.orderId,
      emailId: result.data?.id,
    });

    return { success: true };
  } catch (error) {
    console.error('❌ Error in sendPurchaseEmail:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Экранирует HTML символы для безопасности
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}
