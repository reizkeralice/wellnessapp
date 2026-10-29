import { describe, expect, it } from 'vitest';
import { parseMappedRows, type ImportMapping } from '@/lib/excel';

const mapping: ImportMapping = {
  Блюдо: 'name',
  'Приём пищи': 'category',
  'Ингредиенты и граммовки': 'ingredientName',
  ккал: 'calories',
  'Белки, г': 'protein',
  'Жиры, г': 'fat',
  'Углеводы, г': 'carbs',
};

describe('Excel dish import', () => {
  it('imports per-serving nutrition and all inline ingredient amounts', () => {
    const result = parseMappedRows(
      [
        {
          Блюдо: 'Омлет с овощами',
          'Приём пищи': 'Завтрак',
          'Ингредиенты и граммовки': 'яйца — 150 г, сыр — 15 г, брокколи — 100 г',
          ккал: '452',
          'Белки, г': '31',
          'Жиры, г': '24',
          'Углеводы, г': '30',
        },
      ],
      mapping,
    );

    expect(result.dishes).toHaveLength(1);
    expect(result.dishes[0]).toMatchObject({
      category: 'breakfast',
      servingLabel: '1 порция по граммовкам из файла',
      nutrition: { calories: 452, protein: 31, fat: 24, carbs: 30 },
    });

    expect(result.dishes[0]?.ingredients.map(({ name, amount, unit }) => [name, amount, unit])).toEqual([
      ['Яйца', 150, 'г'],
      ['Сыр', 15, 'г'],
      ['Брокколи', 100, 'г'],
    ]);
  });

  it('combines repeated ingredients without losing their total portion amount', () => {
    const result = parseMappedRows(
      [
        {
          Блюдо: 'Запеканка',
          'Приём пищи': 'Завтрак',
          'Ингредиенты и граммовки': 'творог — 100 г, творог — 50 г',
          ккал: '200',
          'Белки, г': '20',
          'Жиры, г': '8',
          'Углеводы, г': '10',
        },
      ],
      mapping,
    );

    expect(result.dishes[0]?.ingredients).toHaveLength(1);
    expect(result.dishes[0]?.ingredients[0]).toMatchObject({ name: 'Творог', amount: 150, unit: 'г' });
  });

  it('keeps recipe variants distinct, skips snacks, and ignores summary rows', () => {
    const original = {
      Блюдо: 'Курица с рисом',
      'Приём пищи': 'Обед',
      'Ингредиенты и граммовки': 'курица — 150 г, рис — 55 г',
      ккал: '450',
      'Белки, г': '35',
      'Жиры, г': '10',
      'Углеводы, г': '50',
    };
    const result = parseMappedRows(
      [
        original,
        { ...original, 'Ингредиенты и граммовки': 'курица — 160 г, рис — 60 г' },
        original,
        { ...original, 'Приём пищи': 'Перекус' },
        { ...original, Блюдо: '', 'Ингредиенты и граммовки': '', 'Приём пищи': 'ИТОГО ЗА ДЕНЬ' },
      ],
      mapping,
    );

    expect(result.dishes).toHaveLength(2);
    expect(result.dishes.map((dish) => dish.name)).toEqual(['Курица с рисом', 'Курица с рисом']);
    expect(result.dishes.map((dish) => dish.ingredients.map((ingredient) => ingredient.amount))).toEqual([
      [150, 55],
      [160, 60],
    ]);
    expect(result.skippedUnsupportedCategory).toBe(1);
    expect(result.skippedEmpty).toBe(1);
  });
});
