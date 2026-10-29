import type { AppSettings } from '@/types';

export interface WaterRestrictionReminder {
  time: string;
  type: 'before' | 'after';
  meal: string;
}

function toMinutes(time: string): number | undefined {
  const match = time.match(/^(\d{2}):(\d{2})$/);
  if (!match) return undefined;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return undefined;
  return hours * 60 + minutes;
}

function fromMinutes(value: number): string {
  const normalized = ((value % 1440) + 1440) % 1440;
  return `${String(Math.floor(normalized / 60)).padStart(2, '0')}:${String(normalized % 60).padStart(2, '0')}`;
}

export function getWaterRestrictionReminders(
  settings: Pick<AppSettings, 'breakfastTime' | 'lunchStartTime' | 'lunchEndTime' | 'dinnerStartTime' | 'dinnerEndTime'>,
): WaterRestrictionReminder[] {
  const windows = [
    { meal: 'завтрака', start: settings.breakfastTime, end: settings.breakfastTime },
    { meal: 'обеда', start: settings.lunchStartTime, end: settings.lunchEndTime },
    { meal: 'ужина', start: settings.dinnerStartTime, end: settings.dinnerEndTime },
  ];

  return windows.flatMap(({ meal, start, end }) => {
    const startMinutes = toMinutes(start);
    const endMinutes = toMinutes(end);
    if (startMinutes === undefined || endMinutes === undefined || endMinutes < startMinutes) return [];
    return [
      { meal, time: fromMinutes(startMinutes - 30), type: 'before' as const },
      { meal, time: fromMinutes(endMinutes + 60), type: 'after' as const },
    ];
  });
}

export function isWaterRestrictedAt(
  time: string,
  settings: Pick<AppSettings, 'breakfastTime' | 'lunchStartTime' | 'lunchEndTime' | 'dinnerStartTime' | 'dinnerEndTime'>,
): boolean {
  const current = toMinutes(time);
  if (current === undefined) return false;
  const windows = [
    { start: settings.breakfastTime, end: settings.breakfastTime },
    { start: settings.lunchStartTime, end: settings.lunchEndTime },
    { start: settings.dinnerStartTime, end: settings.dinnerEndTime },
  ];
  return windows.some(({ start, end }) => {
    const startMinutes = toMinutes(start);
    const endMinutes = toMinutes(end);
    return startMinutes !== undefined && endMinutes !== undefined &&
      current >= startMinutes - 30 && current <= endMinutes + 60;
  });
}
