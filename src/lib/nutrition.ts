import type { DayPlan, Nutrition, PlannedMealItem } from '@/types';

export const EMPTY_NUTRITION: Nutrition = {
  calories: 0,
  protein: 0,
  fat: 0,
  carbs: 0,
};

export function scaleNutrition(n: Nutrition, multiplier: number): Nutrition {
  return {
    calories: round1(n.calories * multiplier),
    protein: round1(n.protein * multiplier),
    fat: round1(n.fat * multiplier),
    carbs: round1(n.carbs * multiplier),
  };
}

export function addNutrition(a: Nutrition, b: Nutrition): Nutrition {
  return {
    calories: round1(a.calories + b.calories),
    protein: round1(a.protein + b.protein),
    fat: round1(a.fat + b.fat),
    carbs: round1(a.carbs + b.carbs),
  };
}

export function sumNutrition(items: Nutrition[]): Nutrition {
  return items.reduce(addNutrition, EMPTY_NUTRITION);
}

export function mealNutrition(items: PlannedMealItem[]): Nutrition {
  return sumNutrition(items.map((item) => scaleNutrition(item.nutrition, item.portionMultiplier)));
}

export function dayNutrition(plan: DayPlan | undefined): Nutrition {
  if (!plan) return EMPTY_NUTRITION;
  return sumNutrition([
    mealNutrition(plan.breakfast),
    mealNutrition(plan.lunch),
    mealNutrition(plan.dinner),
  ]);
}

export function dayFillCount(plan: DayPlan | undefined): number {
  if (!plan) return 0;
  return [plan.breakfast, plan.lunch, plan.dinner].filter((m) => m.length > 0).length;
}

export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function round0(value: number): number {
  return Math.round(value);
}

export function formatKcal(value: number): string {
  return `${round0(value)} ккал`;
}

export function formatMacro(value: number): string {
  return `${round1(value)} г`;
}
