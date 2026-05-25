import { buildPasswordResetEmailContent } from '../password-reset-email-template';

describe('password-reset-email-template', () => {
  const baseOptions = {
    locale: 'en' as const,
    resetUrl: 'https://example.com/auth/reset-password?token=abc123',
    siteName: 'Mixer',
    expiresInMinutes: 60,
  };

  it('builds a dark / gold reset email with required sections (en)', () => {
    const { html, text, subject } = buildPasswordResetEmailContent({
      ...baseOptions,
      userName: 'Alex',
    });

    expect(subject).toBe('Reset your password');
    expect(html).toContain('Reset your password');
    expect(html).toContain('Hi Alex,');
    expect(html).toContain('Reset password');
    expect(html).toContain(baseOptions.resetUrl);
    expect(html).toContain('This link will expire in 60 minutes.');
    // The body is HTML-escaped, so the apostrophe shows up as &#039;.
    expect(html).toContain('If you didn&#039;t request a password reset');
    expect(html).toContain('Or copy this link into your browser:');
    expect(html).toContain('background-color:#050508');
    expect(text).toContain('Reset your password');
    expect(text).toContain('https://example.com/auth/reset-password?token=abc123');
  });

  it('builds localized Russian password reset email', () => {
    const { html, text, subject } = buildPasswordResetEmailContent({
      ...baseOptions,
      locale: 'ru',
      userName: 'Алексей',
    });

    expect(subject).toBe('Сброс пароля');
    expect(html).toContain('Сброс пароля');
    expect(html).toContain('Здравствуйте, Алексей!');
    expect(html).toContain('Ссылка действительна 60 мин.');
    expect(text).toContain('Mixer');
  });

  it('uses generic greeting when user name is missing', () => {
    const { html } = buildPasswordResetEmailContent(baseOptions);

    expect(html).toContain('Hi there,');
    expect(html).not.toContain('Hi ,');
  });

  it('escapes user-controlled values into the HTML body', () => {
    const { html } = buildPasswordResetEmailContent({
      ...baseOptions,
      userName: 'Robert<script>alert(1)</script>',
    });

    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
