export function parseLocalizedDecimal(value: string): number | undefined {
  const trimmed = value.trim();
  if (!/^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(trimmed)) return undefined;
  const parsed = Number(trimmed.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : undefined;
}
