import type { EmailVerificationOnboardingContext } from './EmailVerificationOnboarding.types';

type OnboardingCopy = {
  onboardingBodyAlbums?: string;
  onboardingBodyPosts?: string;
  onboardingBodyMixer?: string;
  onboardingBodyPaymentSettings?: string;
  onboardingBodyContent?: string;
  verifyBody?: string;
};

export function getEmailVerificationOnboardingBody(
  copy: OnboardingCopy,
  context: EmailVerificationOnboardingContext
): string {
  switch (context) {
    case 'albums':
      return copy.onboardingBodyAlbums ?? copy.verifyBody ?? '';
    case 'posts':
      return copy.onboardingBodyPosts ?? copy.verifyBody ?? '';
    case 'mixer':
      return copy.onboardingBodyMixer ?? copy.verifyBody ?? '';
    case 'payment-settings':
      return copy.onboardingBodyPaymentSettings ?? copy.verifyBody ?? '';
    default:
      return copy.onboardingBodyContent ?? copy.verifyBody ?? '';
  }
}
