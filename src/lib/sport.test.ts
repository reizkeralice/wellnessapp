import { describe, expect, it } from 'vitest';
import { estimateCalories } from '@/lib/sport';

describe('MET calories', () => {
  it('uses MET × 3.5 × weight / 200 × minutes', () => {
    expect(estimateCalories(5, 60, 40)).toBe(Math.round(((5 * 3.5 * 60) / 200) * 40));
  });

  it('returns 0 without weight or duration', () => {
    expect(estimateCalories(5, 0, 40)).toBe(0);
    expect(estimateCalories(5, 60, 0)).toBe(0);
  });
});
