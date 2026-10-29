import { describe, expect, it } from 'vitest';
import { getWaterRestrictionReminders, isWaterRestrictedAt } from '@/lib/mealReminders';

const settings = {
  breakfastTime: '07:30',
  lunchStartTime: '13:00',
  lunchEndTime: '14:00',
  dinnerStartTime: '19:00',
  dinnerEndTime: '20:00',
};

describe('meal-related water reminders', () => {
  it('creates reminder times before meals and after their configured windows', () => {
    expect(getWaterRestrictionReminders(settings).map(({ time }) => time)).toEqual([
      '07:00',
      '08:30',
      '12:30',
      '15:00',
      '18:30',
      '21:00',
    ]);
  });

  it('suppresses routine water prompts throughout configured meal windows', () => {
    expect(isWaterRestrictedAt('06:59', settings)).toBe(false);
    expect(isWaterRestrictedAt('07:00', settings)).toBe(true);
    expect(isWaterRestrictedAt('08:30', settings)).toBe(true);
    expect(isWaterRestrictedAt('08:31', settings)).toBe(false);
    expect(isWaterRestrictedAt('14:30', settings)).toBe(true);
    expect(isWaterRestrictedAt('15:01', settings)).toBe(false);
  });
});
