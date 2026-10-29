export function todayIso(): string {
  return toIsoDate(new Date());
}

export function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function addDays(iso: string, days: number): string {
  const date = parseIsoDate(iso);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

export function startOfWeekMonday(iso: string): string {
  const date = parseIsoDate(iso);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return toIsoDate(date);
}

export function weekDates(iso: string): string[] {
  const start = startOfWeekMonday(iso);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function formatLongDate(iso: string): string {
  return parseIsoDate(iso).toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

export function formatDate(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const [year, month, day] = iso.split('-');
  if (!year || !month || !day) return iso;
  return `${day}.${month}.${year}`;
}

export function formatShortDate(iso: string): string {
  return parseIsoDate(iso).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
  });
}

export function formatMonthYear(iso: string): string {
  return parseIsoDate(iso).toLocaleDateString('ru-RU', {
    month: 'long',
    year: 'numeric',
  });
}

export function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

export function isSameDay(a: string, b: string): boolean {
  return a === b;
}

export function nowTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function compareTime(a: string, b: string): number {
  return a.localeCompare(b);
}

export function dateInRange(iso: string, from?: string, to?: string): boolean {
  if (from && iso < from) return false;
  if (to && iso > to) return false;
  return true;
}
