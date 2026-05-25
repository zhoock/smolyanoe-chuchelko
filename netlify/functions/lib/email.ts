/**
 * Утилиты для отправки email через Resend
 */

import { Resend } from 'resend';
import { buildAccountDeletedEmailContent } from './account-deleted-email-template';
import { buildPasswordResetEmailContent } from './password-reset-email-template';
import { buildPurchaseEmailContent } from './purchase-email-template';
import { buildVerificationEmailContent } from './verification-email-template';
import type { EmailLocale } from './email-locale';
import { getSiteDisplayName } from './email-utils';

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
  locale?: EmailLocale;
}

export async function sendPurchaseEmail(
  options: SendPurchaseEmailOptions
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!process.env.RESEND_API_KEY) {
      console.error('❌ RESEND_API_KEY is not set');
      return { success: false, error: 'Email service not configured: RESEND_API_KEY is missing' };
    }

    const siteUrl =
      options.siteUrl || process.env.NETLIFY_SITE_URL || 'https://smolyanoechuchelko.ru';
    const locale = options.locale ?? 'en';
    const { html, text, subject } = buildPurchaseEmailContent({
      locale,
      customerName: options.customerName,
      albumName: options.albumName,
      artistName: options.artistName,
      orderId: options.orderId,
      purchaseToken: options.purchaseToken,
      siteUrl,
      tracks: options.tracks,
    });

    const result = await resend.emails.send({
      from: 'Смоляное чучелко <noreply@smolyanoechuchelko.ru>',
      to: options.to,
      subject,
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
      locale,
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

interface SendVerificationEmailOptions {
  to: string;
  verifyUrl: string;
  userName?: string;
  locale?: EmailLocale;
}

export async function sendVerificationEmail(
  options: SendVerificationEmailOptions
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!process.env.RESEND_API_KEY) {
      console.error('❌ RESEND_API_KEY is not set');
      return { success: false, error: 'Email service not configured: RESEND_API_KEY is missing' };
    }

    const locale = options.locale ?? 'en';
    const { html, text, subject } = buildVerificationEmailContent({
      locale,
      verifyUrl: options.verifyUrl,
      userName: options.userName,
      siteName: getSiteDisplayName(),
    });

    const result = await resend.emails.send({
      from: 'Смоляное чучелко <noreply@smolyanoechuchelko.ru>',
      to: options.to,
      subject,
      html,
      text,
    });

    if (result.error) {
      console.error('❌ Error sending verification email:', result.error);
      return { success: false, error: result.error.message || 'Failed to send email' };
    }

    return { success: true };
  } catch (error) {
    console.error('❌ Error in sendVerificationEmail:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

interface SendPasswordResetEmailOptions {
  to: string;
  resetUrl: string;
  userName?: string | null;
  expiresInMinutes: number;
  locale?: EmailLocale;
}

export async function sendPasswordResetEmail(
  options: SendPasswordResetEmailOptions
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!process.env.RESEND_API_KEY) {
      console.error('❌ RESEND_API_KEY is not set');
      return { success: false, error: 'Email service not configured: RESEND_API_KEY is missing' };
    }

    const locale = options.locale ?? 'en';
    const { html, text, subject } = buildPasswordResetEmailContent({
      locale,
      resetUrl: options.resetUrl,
      userName: options.userName ?? undefined,
      siteName: getSiteDisplayName(),
      expiresInMinutes: options.expiresInMinutes,
    });

    const result = await resend.emails.send({
      from: 'Смоляное чучелко <noreply@smolyanoechuchelko.ru>',
      to: options.to,
      subject,
      html,
      text,
    });

    if (result.error) {
      console.error('❌ Error sending password reset email:', result.error);
      return { success: false, error: result.error.message || 'Failed to send email' };
    }

    return { success: true };
  } catch (error) {
    console.error('❌ Error in sendPasswordResetEmail:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

interface SendAccountDeletedEmailOptions {
  to: string;
  locale?: EmailLocale;
}

export async function sendAccountDeletedEmail(
  options: SendAccountDeletedEmailOptions
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!process.env.RESEND_API_KEY) {
      console.error('❌ RESEND_API_KEY is not set');
      return { success: false, error: 'Email service not configured: RESEND_API_KEY is missing' };
    }

    const locale = options.locale ?? 'en';
    const { html, text, subject } = buildAccountDeletedEmailContent(locale);

    const result = await resend.emails.send({
      from: 'Смоляное чучелко <noreply@smolyanoechuchelko.ru>',
      to: options.to,
      subject,
      html,
      text,
    });

    if (result.error) {
      console.error('❌ Error sending account deleted email:', result.error);
      return { success: false, error: result.error.message || 'Failed to send email' };
    }

    console.log('✅ Account deleted email sent successfully:', {
      to: options.to,
      locale,
      emailId: result.data?.id,
    });

    return { success: true };
  } catch (error) {
    console.error('❌ Error in sendAccountDeletedEmail:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
