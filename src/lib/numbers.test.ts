import { describe, expect, it } from 'vitest';
import { parseLocalizedDecimal } from '@/lib/numbers';

describe('localized decimal input', () => {
  it('accepts comma and dot decimal separators', () => {
    expect(parseLocalizedDecimal('72,5')).toBe(72.5);
    expect(parseLocalizedDecimal('72.5')).toBe(72.5);
  });

  it('rejects empty and malformed values', () => {
    expect(parseLocalizedDecimal('')).toBeUndefined();
    expect(parseLocalizedDecimal('72,5,1')).toBeUndefined();
    expect(parseLocalizedDecimal('abc')).toBeUndefined();
  });
});
