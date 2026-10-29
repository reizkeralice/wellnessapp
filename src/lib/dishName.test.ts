import { describe, expect, it } from 'vitest';
import { cleanDishName, containsLactoseIngredient } from '@/lib/dishName';

describe('dish names and lactose tags', () => {
  it('removes import variant labels, repeated words, and capitalizes title words', () => {
    expect(cleanDishName('запечённый омлет с сыром (помидор, помидор) (вариант 2)')).toBe(
      'Запечённый омлет с сыром (помидор)',
    );
    expect(cleanDishName('Запеканка из творога без сахара Вариант 35')).toBe(
      'Запеканка из творога без сахара',
    );
  });

  it('marks recipes containing milk ingredients', () => {
    expect(containsLactoseIngredient(['Куриная грудка', 'Молоко'])).toBe(true);
    expect(containsLactoseIngredient(['Рис', 'Брокколи'])).toBe(false);
    expect(containsLactoseIngredient(['Молоко безлактозное'])).toBe(false);
  });
});
