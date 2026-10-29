export type MealCategory = 'breakfast' | 'lunch' | 'dinner';

export type ShoppingCategory =
  | 'meat'
  | 'dairy'
  | 'vegetables'
  | 'fruits'
  | 'grains'
  | 'bread'
  | 'eggs'
  | 'other';

export type Intensity = 'low' | 'medium' | 'high';
export type VitaminMealSlot = MealCategory | 'bedtime' | 'any';

export interface Ingredient {
  id: string;
  name: string;
  amount: number;
  unit: string;
  shoppingCategory: ShoppingCategory;
}

export interface Nutrition {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}

export interface Dish {
  id: string;
  name: string;
  category: MealCategory;
  ingredients: Ingredient[];
  nutrition: Nutrition;
  instructions?: string;
  cookTimeMinutes?: number;
  imageDataUrl?: string;
  favorite: boolean;
  importKey?: string;
  servingLabel?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlannedMealItem {
  id: string;
  dishId: string;
  name: string;
  category: MealCategory;
  nutrition: Nutrition;
  ingredients: Ingredient[];
  imageDataUrl?: string;
  portionMultiplier: number;
  cookTimeMinutes?: number;
  instructions?: string;
}

export interface DayPlan {
  date: string;
  breakfast: PlannedMealItem[];
  lunch: PlannedMealItem[];
  dinner: PlannedMealItem[];
  updatedAt: string;
}

export interface ShoppingItem {
  id: string;
  name: string;
  amount: number;
  unit: string;
  category: ShoppingCategory;
  purchased: boolean;
  mergeKey: string;
  updatedAt: string;
}

export interface WeightEntry {
  id: string;
  date: string;
  kg: number;
  note?: string;
  createdAt: string;
}

export interface Vitamin {
  id: string;
  name: string;
  dosage: number;
  dosageUnit: string;
  scheduleTimes: string[];
  mealSlot?: VitaminMealSlot;
  condition?: 'lactose';
  weekdays: number[];
  startDate?: string;
  endDate?: string;
  notes?: string;
  remindersEnabled: boolean;
  createdAt: string;
}

export type VitaminDoseStatus = 'planned' | 'taken' | 'missed';

export interface VitaminLog {
  id: string;
  vitaminId: string;
  date: string;
  time: string;
  status: VitaminDoseStatus;
  takenAt?: string;
}

export interface WaterLog {
  id: string;
  date: string;
  ml: number;
  createdAt: string;
}

export interface Workout {
  id: string;
  date: string;
  activityId: string;
  activityName: string;
  durationMin: number;
  intensity: Intensity;
  met: number;
  calories: number;
  caloriesManual: boolean;
  comment?: string;
  createdAt: string;
}

export interface MetOverride {
  id: string;
  activityId: string;
  intensity: Intensity;
  met: number;
}

export interface AppSettings {
  id: 'app';
  calorieGoal: number;
  proteinGoal?: number;
  fatGoal?: number;
  carbsGoal?: number;
  weightGoalKg?: number;
  waterGoalMl: number;
  wakeTime: string;
  sleepTime: string;
  waterRemindersEnabled: boolean;
  waterReminderIntervalMin: number;
  vitaminRemindersEnabled: boolean;
  waterMealRemindersEnabled: boolean;
  breakfastTime: string;
  lunchStartTime: string;
  lunchEndTime: string;
  dinnerStartTime: string;
  dinnerEndTime: string;
  createdAt: string;
  updatedAt: string;
}

export type AppRoute =
  | 'home'
  | 'dishes'
  | 'planner'
  | 'shopping'
  | 'weight'
  | 'vitamins'
  | 'water'
  | 'sport'
  | 'settings';

export const MEAL_LABELS: Record<MealCategory, string> = {
  breakfast: 'Завтрак',
  lunch: 'Обед',
  dinner: 'Ужин',
};

export const SHOPPING_LABELS: Record<ShoppingCategory, string> = {
  meat: 'Мясо и птица',
  dairy: 'Молочные продукты',
  vegetables: 'Овощи',
  fruits: 'Фрукты',
  grains: 'Крупы и бакалея',
  bread: 'Хлеб',
  eggs: 'Яйца',
  other: 'Прочее',
};

export const WEEKDAY_LABELS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
export const WEEKDAY_FULL = [
  'Воскресенье',
  'Понедельник',
  'Вторник',
  'Среда',
  'Четверг',
  'Пятница',
  'Суббота',
];
