import { useMemo } from 'react';
import { useLang } from '@app/providers/lang';
import { useAppSelector } from '@shared/lib/hooks/useAppSelector';
import { selectUiDictionaryFirst } from '@shared/model/uiDictionary';

export function useEmailVerificationCopy() {
  const { lang } = useLang();
  const ui = useAppSelector((state) => selectUiDictionaryFirst(state, lang));
  const ev = ui?.auth?.emailVerification;

  return useMemo(() => {
    const en = lang !== 'ru';
    const fallback = en
      ? {
          verifyTitle: 'Verify your email',
          verifyBody:
            'We sent a verification link to your email address. Please check your inbox and click the link to verify your email address.',
          resendEmail: 'Resend email',
          changeEmail: 'Change email',
          continueLater: 'Continue later',
          bannerText: 'Verify your email to unlock all features',
          bannerSubtitle: 'We sent a verification link to {{email}}',
          successTitle: 'Email verified',
          successBody:
            'Your email has been successfully verified. You now have full access to all features.',
          continue: 'Continue',
          continueToHome: 'Continue to Home',
          openDashboard: 'Open dashboard',
          openDashboardPrefix: 'Or open your ',
          openDashboardLink: 'dashboard',
          expiredTitle: 'Verification link expired',
          expiredBody:
            'This link is no longer valid or has expired. Please request a new verification link.',
          sendNewLink: 'Send new link',
          backToLogin: 'Back to login',
          changeEmailTitle: 'Change email',
          changeEmailBody:
            "Enter your new email address. We'll send a verification link to the new email.",
          newEmailLabel: 'New email',
          newEmailPlaceholder: 'name@example.com',
          sendVerificationEmail: 'Send verification email',
          cancel: 'Cancel',
          back: 'Back',
          restrictedHint: 'Verify your email to unlock',
          emailRequired: 'Enter your email',
          emailInvalid: 'Enter a valid email address',
          resendFailed: 'Could not send email. Try again later.',
          close: 'Close',
          restrictedPremium: 'Verify your email to purchase Premium',
          restrictedUpload: 'Verify your email to upload content',
          restrictedPaymentSettings: 'Payment Settings',
          restrictedPaymentSettingsHint: 'Verify your email to configure payment settings',
          restrictedMixer: 'Mixer',
          restrictedMixerHint: 'Verify your email to upload stems and manage the mixer',
        }
      : {
          verifyTitle: 'Подтвердите email',
          verifyBody:
            'Мы отправили ссылку для подтверждения на ваш email. Проверьте почту и перейдите по ссылке.',
          resendEmail: 'Отправить снова',
          changeEmail: 'Изменить email',
          continueLater: 'Продолжить позже',
          bannerText: 'Подтвердите email, чтобы открыть все функции',
          bannerSubtitle: 'Мы отправили ссылку для подтверждения на {{email}}',
          successTitle: 'Email подтверждён',
          successBody: 'Ваш email успешно подтверждён. Теперь вам доступны все функции проекта.',
          continue: 'Продолжить',
          continueToHome: 'На главную',
          openDashboard: 'Открыть дашборд',
          openDashboardPrefix: 'Или открыть ',
          openDashboardLink: 'дашборд',
          expiredTitle: 'Ссылка устарела',
          expiredBody:
            'Ссылка недействительна или истекла. Запросите новую ссылку для подтверждения.',
          sendNewLink: 'Отправить новую ссылку',
          backToLogin: 'Вернуться ко входу',
          changeEmailTitle: 'Изменить email',
          changeEmailBody:
            'Укажите новый email. Мы отправим ссылку для подтверждения на новый адрес.',
          newEmailLabel: 'Новый email',
          newEmailPlaceholder: 'name@example.com',
          sendVerificationEmail: 'Отправить письмо',
          cancel: 'Отмена',
          back: 'Назад',
          restrictedHint: 'Подтвердите email для доступа',
          emailRequired: 'Укажите email',
          emailInvalid: 'Укажите корректный email',
          resendFailed: 'Не удалось отправить письмо. Попробуйте позже.',
          close: 'Закрыть',
          restrictedPremium: 'Подтвердите email, чтобы оформить Premium',
          restrictedUpload: 'Подтвердите email, чтобы загружать контент',
          restrictedPaymentSettings: 'Настройки оплаты',
          restrictedPaymentSettingsHint: 'Подтвердите email, чтобы настроить приём платежей',
          restrictedMixer: 'Миксер',
          restrictedMixerHint: 'Подтвердите email, чтобы загружать стемы и управлять миксером',
        };
    return { ...fallback, ...ev };
  }, [lang, ev]);
}
