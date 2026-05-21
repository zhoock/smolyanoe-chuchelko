import type { EmailLocale } from './email-locale';

export interface VerificationEmailCopy {
  subject: string;
  htmlTitle: string;
  greetingNamed: string;
  greetingGeneric: string;
  body: string;
  cta: string;
  copyLinkLabel: string;
  footer: string;
}

export interface AccountDeletedEmailCopy {
  subject: string;
  htmlTitle: string;
  subtitle: string;
  warningTitle: string;
  warningBody: string;
  cta: string;
  footer: string;
  textIntro: string;
  textWarningTitle: string;
  textWarningBody: string;
  textCtaLabel: string;
}

export interface PurchaseEmailCopy {
  subjectPrefix: string;
  htmlTitle: string;
  greetingNamed: string;
  greetingGeneric: string;
  orderPaid: string;
  trackColumn: string;
  download: string;
  supportPrompt: string;
  textThanks: string;
  textTracksHeader: string;
  textDownloadLabel: string;
  textSupportPrompt: string;
}

export interface PasswordResetEmailCopy {
  subject: string;
  title: string;
  body: string;
  cta: string;
  footer: string;
}

export interface SupportSubjectsCopy {
  accountDeleted: string;
  purchase: string;
  passwordReset: string;
}

const COPY = {
  supportSubjects: {
    en: {
      accountDeleted: 'Unauthorized account deletion',
      purchase: 'Purchase support',
      passwordReset: 'Password reset help',
    },
    ru: {
      accountDeleted: 'Несанкционированное удаление аккаунта',
      purchase: 'Вопрос по покупке',
      passwordReset: 'Помощь со сбросом пароля',
    },
  },
  verification: {
    en: {
      subject: 'Verify your email',
      htmlTitle: 'Verify your email',
      greetingNamed: 'Hi {{name}},',
      greetingGeneric: 'Hi there,',
      body: 'Thanks for joining {{siteName}}! Please verify your email address to activate your account and unlock all features.',
      cta: 'Verify email address',
      copyLinkLabel: 'Or copy this link:',
      footer: '© {{siteName}}. All rights reserved.',
    },
    ru: {
      subject: 'Подтвердите email',
      htmlTitle: 'Подтвердите email',
      greetingNamed: 'Здравствуйте, {{name}}!',
      greetingGeneric: 'Здравствуйте!',
      body: 'Спасибо, что присоединились к {{siteName}}! Подтвердите email, чтобы активировать аккаунт и открыть все функции.',
      cta: 'Подтвердить email',
      copyLinkLabel: 'Или скопируйте ссылку:',
      footer: '© {{siteName}}. Все права защищены.',
    },
  },
  accountDeleted: {
    en: {
      subject: 'Your account has been deleted',
      htmlTitle: 'Your account has been deleted',
      subtitle:
        'Your account on {{siteName}} and all associated data have been permanently deleted.',
      warningTitle: 'Didn&rsquo;t do this?',
      warningBody:
        'If you didn&rsquo;t delete your account, please contact our support team immediately.',
      cta: 'Contact Support',
      footer: 'This is an automated message, please do not reply.',
      textIntro:
        'Your account on {{siteName}} and all associated data have been permanently deleted.',
      textWarningTitle: "Didn't do this?",
      textWarningBody:
        "If you didn't delete your account, please contact our support team immediately.",
      textCtaLabel: 'Contact Support',
    },
    ru: {
      subject: 'Ваш аккаунт удалён',
      htmlTitle: 'Ваш аккаунт удалён',
      subtitle: 'Ваш аккаунт на {{siteName}} и все связанные данные были безвозвратно удалены.',
      warningTitle: 'Это были не вы?',
      warningBody: 'Если вы не удаляли аккаунт, немедленно свяжитесь с нашей службой поддержки.',
      cta: 'Связаться с поддержкой',
      footer: 'Это автоматическое сообщение, пожалуйста, не отвечайте на него.',
      textIntro: 'Ваш аккаунт на {{siteName}} и все связанные данные были безвозвратно удалены.',
      textWarningTitle: 'Это были не вы?',
      textWarningBody:
        'Если вы не удаляли аккаунт, немедленно свяжитесь с нашей службой поддержки.',
      textCtaLabel: 'Связаться с поддержкой',
    },
  },
  purchase: {
    en: {
      subjectPrefix: 'Thank you for your purchase',
      htmlTitle: 'Thank you for your purchase! ✅',
      greetingNamed: 'Hello, {{name}}!',
      greetingGeneric: 'Hello!',
      orderPaid: 'Your order <strong>#{{orderId}}</strong> has been paid successfully.',
      trackColumn: 'Track',
      download: 'Download',
      supportPrompt: 'If you have any questions, please contact us:',
      textThanks: 'Thank you for your purchase!',
      textTracksHeader: 'Tracks:',
      textDownloadLabel: 'Download',
      textSupportPrompt: 'If you have any questions, please contact us:',
    },
    ru: {
      subjectPrefix: 'Спасибо за покупку',
      htmlTitle: 'Спасибо за покупку! ✅',
      greetingNamed: 'Здравствуйте, {{name}}!',
      greetingGeneric: 'Здравствуйте!',
      orderPaid: 'Ваш заказ <strong>#{{orderId}}</strong> успешно оплачен.',
      trackColumn: 'Трек',
      download: 'Скачать',
      supportPrompt: 'Если у вас возникли вопросы, свяжитесь с нами:',
      textThanks: 'Спасибо за покупку!',
      textTracksHeader: 'Треки:',
      textDownloadLabel: 'Скачать',
      textSupportPrompt: 'Если у вас возникли вопросы, свяжитесь с нами:',
    },
  },
  passwordReset: {
    en: {
      subject: 'Reset your password',
      title: 'Reset your password',
      body: 'We received a request to reset your password. Use the button below to choose a new one.',
      cta: 'Reset password',
      footer: 'If you did not request this, you can safely ignore this email.',
    },
    ru: {
      subject: 'Сброс пароля',
      title: 'Сброс пароля',
      body: 'Мы получили запрос на сброс пароля. Нажмите кнопку ниже, чтобы задать новый пароль.',
      cta: 'Сбросить пароль',
      footer: 'Если вы не запрашивали сброс, просто проигнорируйте это письмо.',
    },
  },
} as const;

export type EmailCopyKey = keyof typeof COPY;

export function getEmailCopy<K extends EmailCopyKey>(
  key: K,
  locale: EmailLocale
): (typeof COPY)[K]['en'] {
  return COPY[key][locale === 'ru' ? 'ru' : 'en'];
}

export function fillEmailTemplate(template: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (result, [key, value]) => result.replaceAll(`{{${key}}}`, value),
    template
  );
}
