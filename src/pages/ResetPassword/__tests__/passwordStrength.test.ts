import { computePasswordStrength } from '../passwordStrength';

describe('computePasswordStrength', () => {
  it('returns score 0 for empty input', () => {
    expect(computePasswordStrength('')).toEqual({ score: 0, meetsMinLength: false });
  });

  it('flags below-minimum-length as score 1 and meetsMinLength false', () => {
    const r = computePasswordStrength('abc12');
    expect(r.score).toBe(1);
    expect(r.meetsMinLength).toBe(false);
  });

  it('returns at least 2 for a single-class long-enough password', () => {
    const r = computePasswordStrength('aaaaaaaa');
    expect(r.meetsMinLength).toBe(true);
    expect(r.score).toBeGreaterThanOrEqual(2);
  });

  it('upgrades a two-class moderately long password to score 3', () => {
    const r = computePasswordStrength('abcdefgh1234');
    expect(r.score).toBe(3);
  });

  it('returns score 4 for a 3-class password of normal length', () => {
    const r = computePasswordStrength('AbcdEfg1');
    expect(r.score).toBe(4);
  });

  it('returns score 5 for a strong 16+ char mixed-class password', () => {
    const r = computePasswordStrength('AbcdEfgh1234!@#$');
    expect(r.score).toBe(5);
  });

  it('reports meetsMinLength true at exactly 8 chars', () => {
    expect(computePasswordStrength('12345678').meetsMinLength).toBe(true);
  });
});
