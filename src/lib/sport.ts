import type { Intensity } from '@/types';

export interface ActivityPreset {
  id: string;
  name: string;
  met: Record<Intensity, number>;
}

export const ACTIVITY_PRESETS: ActivityPreset[] = [
  { id: 'walking', name: 'Ходьба', met: { low: 2.5, medium: 3.5, high: 4.5 } },
  { id: 'running', name: 'Бег', met: { low: 7, medium: 9.8, high: 11.5 } },
  { id: 'strength', name: 'Силовая тренировка', met: { low: 3.5, medium: 5, high: 6 } },
  { id: 'cycling', name: 'Велосипед', met: { low: 4, medium: 6.8, high: 10 } },
  { id: 'swimming', name: 'Плавание', met: { low: 5, medium: 7, high: 9.5 } },
  { id: 'elliptical', name: 'Эллипс', met: { low: 4.6, medium: 5, high: 8 } },
  { id: 'stepper', name: 'Степпер', met: { low: 4, medium: 6, high: 8.5 } },
  { id: 'yoga', name: 'Йога', met: { low: 2.5, medium: 3, high: 4 } },
  { id: 'other', name: 'Другое', met: { low: 3, medium: 4.5, high: 6 } },
];

export const INTENSITY_LABELS: Record<Intensity, string> = {
  low: 'Низкая',
  medium: 'Средняя',
  high: 'Высокая',
};

/** Ккал = MET × 3,5 × вес в кг / 200 × длительность в минутах */
export function estimateCalories(met: number, weightKg: number, durationMin: number): number {
  if (met <= 0 || weightKg <= 0 || durationMin <= 0) return 0;
  return Math.round(((met * 3.5 * weightKg) / 200) * durationMin);
}
