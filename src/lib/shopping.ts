import type { Ingredient, ShoppingCategory, ShoppingItem } from '@/types';

export function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function normalizeUnit(unit: string): string {
  return unit.trim().toLowerCase().replace(/\./g, '');
}

export function mergeKey(name: string, unit: string): string {
  return `${normalizeName(name)}|${normalizeUnit(unit)}`;
}

export function unitsCompatible(a: string, b: string): boolean {
  return normalizeUnit(a) === normalizeUnit(b);
}

export function inferShoppingCategory(name: string): ShoppingCategory {
  const n = normalizeName(name);
  if (/яйц/.test(n)) return 'eggs';
  if (/хлеб|батон|лаваш|булк|тост/.test(n)) return 'bread';
  if (/курин|говяд|свин|индей|фарш|мясо|филе|грудк|бекон|колбас/.test(n)) return 'meat';
  if (/молок|кефир|творог|сыр|йогурт|сметан|сливк|масло сливоч/.test(n)) return 'dairy';
  if (/яблок|банан|апельсин|груш|ягод|клубник|лимон|фрукт/.test(n)) return 'fruits';
  if (/рис|гречк|овсян|макарон|мук|круп|чечевиц|нут|фасол|сахар|соль|оливков/.test(n)) {
    return 'grains';
  }
  if (
    /помидор|огурец|салат|капуст|морков|лук|чеснок|перец|картоф|брокколи|шпинат|кабачок|овощ/.test(
      n,
    )
  ) {
    return 'vegetables';
  }
  return 'other';
}

export function scaleIngredients(items: Ingredient[], multiplier: number): Ingredient[] {
  return items.map((item) => ({
    ...item,
    amount: roundAmount(item.amount * multiplier),
  }));
}

export function mergeIngredients(items: Ingredient[]): Ingredient[] {
  const map = new Map<string, Ingredient>();
  for (const item of items) {
    const key = mergeKey(item.name, item.unit);
    const existing = map.get(key);
    if (existing && unitsCompatible(existing.unit, item.unit)) {
      existing.amount = roundAmount(existing.amount + item.amount);
    } else if (!existing) {
      map.set(key, { ...item, id: item.id });
    } else {
      map.set(`${key}-${item.id}`, { ...item });
    }
  }
  return [...map.values()];
}

export function roundAmount(value: number): number {
  return Math.round(value * 100) / 100;
}

export function applyAddToShopping(
  existing: ShoppingItem[],
  incoming: Ingredient[],
  nowIso: string,
  createId: () => string,
): ShoppingItem[] {
  const result = existing.map((item) => ({ ...item }));
  for (const ing of incoming) {
    const key = mergeKey(ing.name, ing.unit);
    const found = result.find((item) => item.mergeKey === key);
    if (found) {
      found.amount = roundAmount(found.amount + ing.amount);
      found.updatedAt = nowIso;
      found.purchased = false;
    } else {
      result.push({
        id: createId(),
        name: ing.name.trim(),
        amount: roundAmount(ing.amount),
        unit: ing.unit.trim() || 'г',
        category: ing.shoppingCategory || inferShoppingCategory(ing.name),
        purchased: false,
        mergeKey: key,
        updatedAt: nowIso,
      });
    }
  }
  return result;
}

export function addMissingToShopping(
  existing: ShoppingItem[],
  incoming: Ingredient[],
  nowIso: string,
  createId: () => string,
): ShoppingItem[] {
  const result = existing.map((item) => ({ ...item }));
  const existingKeys = new Set(result.map((item) => mergeKey(item.name, item.unit)));
  for (const ing of mergeIngredients(incoming)) {
    const key = mergeKey(ing.name, ing.unit);
    if (existingKeys.has(key)) continue;
    result.push({
      id: createId(),
      name: ing.name.trim(),
      amount: roundAmount(ing.amount),
      unit: ing.unit.trim() || 'г',
      category: ing.shoppingCategory || inferShoppingCategory(ing.name),
      purchased: false,
      mergeKey: key,
      updatedAt: nowIso,
    });
    existingKeys.add(key);
  }
  return result;
}
