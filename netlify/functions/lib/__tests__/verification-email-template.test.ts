import { buildVerificationEmailContent } from '../verification-email-template';

describe('verification-email-template', () => {
  const baseOptions = {
    locale: 'en' as const,
    verifyUrl: 'https://example.com/api/auth/verify-email?token=abc123',
    siteName: 'Mixer',
  };

  it('builds light premium verification email with required sections (en)', () => {
    const { html, text, subject } = buildVerificationEmailContent({
      ...baseOptions,
      userName: 'Alex',
    });

    expect(subject).toBe('Verify your email');
    expect(html).toContain('Verify your email');
    expect(html).toContain('Hi Alex,');
    expect(html).toContain('Verify email address');
    expect(html).toContain('Or copy this link:');
    expect(html).toContain(baseOptions.verifyUrl);
    expect(html).toContain('background-color:#ffffff');
    expect(html).not.toContain('#1A1A1A');
    expect(text).toContain('Thanks for joining Mixer!');
  });

  it('builds localized Russian verification email', () => {
    const { html, text, subject } = buildVerificationEmailContent({
      ...baseOptions,
      locale: 'ru',
    });

    expect(subject).toBe('Подтвердите email');
    expect(html).toContain('Подтвердите email');
    expect(text).toContain('Mixer');
  });

  it('uses generic greeting when user name is missing', () => {
    const { html } = buildVerificationEmailContent(baseOptions);

    expect(html).toContain('Hi there,');
  });
});
