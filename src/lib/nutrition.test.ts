import { describe, expect, it } from 'vitest';
import type { DayPlan, PlannedMealItem } from '@/types';
import { dayNutrition, mealNutrition, scaleNutrition, sumNutrition } from '@/lib/nutrition';

const item = (calories: number, protein: number, fat: number, carbs: number, m = 1): PlannedMealItem => ({
  id: '1',
  dishId: 'd',
  name: 'Тест',
  category: 'breakfast',
  nutrition: { calories, protein, fat, carbs },
  ingredients: [],
  portionMultiplier: m,
});

describe('nutrition', () => {
  it('scales portion', () => {
    expect(scaleNutrition({ calories: 200, protein: 10, fat: 5, carbs: 20 }, 0.5)).toEqual({
      calories: 100,
      protein: 5,
      fat: 2.5,
      carbs: 10,
    });
  });

  it('sums meals with multipliers', () => {
    const n = mealNutrition([item(200, 10, 4, 20, 2), item(100, 5, 2, 10, 1)]);
    expect(n).toEqual({ calories: 500, protein: 25, fat: 10, carbs: 50 });
  });

  it('sums day from three meals only', () => {
    const plan: DayPlan = {
      date: '2026-10-28',
      breakfast: [item(300, 20, 10, 30)],
      lunch: [item(500, 30, 15, 40)],
      dinner: [item(400, 25, 12, 35)],
      updatedAt: '',
    };
    expect(dayNutrition(plan)).toEqual({ calories: 1200, protein: 75, fat: 37, carbs: 105 });
  });

  it('does not invent values when summing empty', () => {
    expect(sumNutrition([])).toEqual({ calories: 0, protein: 0, fat: 0, carbs: 0 });
  });
});
