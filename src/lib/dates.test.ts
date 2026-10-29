import { describe, expect, it } from 'vitest';
import { formatDate } from '@/lib/dates';

describe('date formatting', () => {
  it('formats ISO dates as day.month.year', () => {
    expect(formatDate('2026-10-29')).toBe('29.10.2026');
  });

  it('returns an invalid date string unchanged', () => {
    expect(formatDate('not-a-date')).toBe('not-a-date');
  });
});
