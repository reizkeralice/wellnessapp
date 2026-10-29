import { describe, expect, it } from 'vitest';
import type { Ingredient } from '@/types';
import {
  addMissingToShopping,
  applyAddToShopping,
  mergeIngredients,
  mergeKey,
  unitsCompatible,
} from '@/lib/shopping';

const ing = (name: string, amount: number, unit: string, id = name): Ingredient => ({
  id,
  name,
  amount,
  unit,
  shoppingCategory: 'other',
});

describe('shopping merge', () => {
  it('merges same product and unit', () => {
    const merged = mergeIngredients([ing('Курица', 150, 'г', 'a'), ing('курица', 50, 'г', 'b')]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.amount).toBe(200);
  });

  it('does not merge incompatible units', () => {
    const merged = mergeIngredients([ing('Молоко', 200, 'мл', 'a'), ing('Молоко', 1, 'шт', 'b')]);
    expect(merged).toHaveLength(2);
    expect(unitsCompatible('мл', 'шт')).toBe(false);
  });

  it('increases amount when adding again', () => {
    const first = applyAddToShopping([], [ing('Рис', 80, 'г')], 't1', () => 'id1');
    const second = applyAddToShopping(first, [ing('Рис', 80, 'г')], 't2', () => 'id2');
    expect(second).toHaveLength(1);
    expect(second[0]?.amount).toBe(160);
    expect(second[0]?.purchased).toBe(false);
  });

  it('does not increase existing ingredients when importing them again', () => {
    const first = addMissingToShopping([], [ing('Рис', 80, 'г')], 't1', () => 'id1');
    const second = addMissingToShopping(first, [ing('Рис', 80, 'г')], 't2', () => 'id2');
    expect(second).toHaveLength(1);
    expect(second[0]?.amount).toBe(80);
  });

  it('preserves purchase state when an existing ingredient is added from a plan again', () => {
    const first = addMissingToShopping([], [ing('Молоко', 200, 'мл')], 't1', () => 'id1');
    first[0]!.purchased = true;
    const second = addMissingToShopping(first, [ing('молоко', 200, 'мл')], 't2', () => 'id2');
    expect(second[0]?.amount).toBe(200);
    expect(second[0]?.purchased).toBe(true);
  });

  it('builds merge key from name and unit', () => {
    expect(mergeKey('  Рис  ', 'Г.')).toBe('рис|г');
  });
});
