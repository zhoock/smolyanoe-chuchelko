import { buildAccountDeletedEmailContent } from '../account-deleted-email-template';
import { buildSupportMailto, getSupportEmail } from '../email-support';
import { getSiteDisplayName } from '../email-utils';

describe('account-deleted-email-template', () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env };
    delete process.env.SITE_DISPLAY_NAME;
    delete process.env.SUPPORT_EMAIL;
  });

  afterAll(() => {
    process.env = env;
  });

  it('builds light premium account deleted email with required sections (en)', () => {
    const { html, text, subject } = buildAccountDeletedEmailContent('en');

    expect(subject).toBe('Your account has been deleted');
    expect(html).toContain('Your account has been deleted');
    expect(html).toContain('Didn&rsquo;t do this?');
    expect(html).toContain('Contact Support');
    expect(html).toContain('This is an automated message, please do not reply.');
    expect(text).toContain('Your account on Mixer');
    expect(text).toContain(getSupportEmail());
  });

  it('builds localized Russian account deleted email', () => {
    const { html, text, subject } = buildAccountDeletedEmailContent('ru');

    expect(subject).toBe('Ваш аккаунт удалён');
    expect(html).toContain('Ваш аккаунт удалён');
    expect(text).toContain('Mixer');
  });

  it('uses support mailto link for Contact Support CTA', () => {
    const { html } = buildAccountDeletedEmailContent('en');
    expect(html).toContain(buildSupportMailto({ locale: 'en', template: 'accountDeleted' }));
  });

  it('respects SITE_DISPLAY_NAME and SUPPORT_EMAIL env vars', () => {
    process.env.SITE_DISPLAY_NAME = 'OTHER Music Archive';
    process.env.SUPPORT_EMAIL = 'support@example.com';

    const { html, text } = buildAccountDeletedEmailContent('en');

    expect(html).toContain('OTHER Music Archive');
    expect(text).toContain('OTHER Music Archive');
    expect(html).toContain('mailto:support@example.com');
    expect(getSiteDisplayName()).toBe('OTHER Music Archive');
  });
});
