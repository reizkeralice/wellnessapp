import Dexie, { type Table, type Transaction } from 'dexie';
import type {
  AppSettings,
  DayPlan,
  Dish,
  MetOverride,
  ShoppingItem,
  Vitamin,
  VitaminLog,
  WaterLog,
  WeightEntry,
  Workout,
} from '@/types';
import { cleanDishName } from '@/lib/dishName';

function createDefaultVitamins(now: string): Vitamin[] {
  return [
    {
      id: 'personal-routine-b-complex',
      name: 'B-комплекс',
      dosage: 1,
      dosageUnit: 'таблетка',
      scheduleTimes: ['07:30'],
      mealSlot: 'breakfast',
      weekdays: [0, 1, 2, 3, 4, 5, 6],
      notes: 'С завтраком',
      remindersEnabled: true,
      createdAt: now,
    },
    {
      id: 'personal-routine-vitamin-d',
      name: 'Витамин D',
      dosage: 1,
      dosageUnit: 'капсула',
      scheduleTimes: ['07:30'],
      mealSlot: 'breakfast',
      weekdays: [0, 1, 2, 3, 4, 5, 6],
      notes: 'С завтраком или обедом. Одно напоминание — на завтрак.',
      remindersEnabled: true,
      createdAt: now,
    },
    {
      id: 'personal-routine-lactazar',
      name: 'Лактазар',
      dosage: 1,
      dosageUnit: 'капсула',
      scheduleTimes: ['07:30', '13:00', '19:00'],
      mealSlot: 'any',
      condition: 'lactose',
      weekdays: [0, 1, 2, 3, 4, 5, 6],
      notes: 'Только если в запланированном блюде есть ингредиент с лактозой.',
      remindersEnabled: true,
      createdAt: now,
    },
    {
      id: 'personal-routine-magnesium',
      name: 'Магний',
      dosage: 2,
      dosageUnit: 'таблетки',
      scheduleTimes: ['23:00'],
      mealSlot: 'bedtime',
      weekdays: [0, 1, 2, 3, 4, 5, 6],
      notes: 'Перед сном',
      remindersEnabled: true,
      createdAt: now,
    },
    {
      id: 'personal-routine-urdoxa',
      name: 'Урдокса',
      dosage: 1,
      dosageUnit: 'капсула',
      scheduleTimes: ['23:00'],
      mealSlot: 'bedtime',
      weekdays: [0, 1, 2, 3, 4, 5, 6],
      notes: 'Перед сном',
      remindersEnabled: true,
      createdAt: now,
    },
  ];
}

async function normalizeImportedDishes(transaction: Transaction): Promise<void> {
  const dishTable = transaction.table('dishes');
  const dishes = (await dishTable.toArray()) as Dish[];
  const importedDishIds = new Set<string>();
  for (const dish of dishes) {
    if (!dish.importKey?.startsWith('excel:')) continue;
    importedDishIds.add(dish.id);
    dish.name = cleanDishName(dish.name);
    dish.ingredients = dish.ingredients.map((ingredient) => ({
      ...ingredient,
      name: cleanDishName(ingredient.name),
    }));
    await dishTable.put(dish);
  }

  const planTable = transaction.table('dayPlans');
  const plans = (await planTable.toArray()) as DayPlan[];
  for (const plan of plans) {
    for (const meal of ['breakfast', 'lunch', 'dinner'] as const) {
      plan[meal] = plan[meal].map((item) => ({
        ...item,
        ...(importedDishIds.has(item.dishId)
          ? {
              name: cleanDishName(item.name),
              ingredients: item.ingredients.map((ingredient) => ({
                ...ingredient,
                name: cleanDishName(ingredient.name),
              })),
            }
          : {}),
      }));
    }
    await planTable.put(plan);
  }
}

export class NutritionDatabase extends Dexie {
  dishes!: Table<Dish, string>;
  dayPlans!: Table<DayPlan, string>;
  shopping!: Table<ShoppingItem, string>;
  weights!: Table<WeightEntry, string>;
  vitamins!: Table<Vitamin, string>;
  vitaminLogs!: Table<VitaminLog, string>;
  waterLogs!: Table<WaterLog, string>;
  workouts!: Table<Workout, string>;
  settings!: Table<AppSettings, string>;
  metOverrides!: Table<MetOverride, string>;

  constructor() {
    super('personal-nutrition-planner');
    this.on('populate', (transaction) => {
      transaction.table('vitamins').bulkAdd(createDefaultVitamins(new Date().toISOString()));
    });
    this.version(1).stores({
      dishes: 'id, name, category, favorite, importKey',
      dayPlans: 'date',
      shopping: 'id, mergeKey, purchased, category',
      weights: 'id, date',
      vitamins: 'id, name',
      vitaminLogs: 'id, vitaminId, date, [vitaminId+date+time]',
      waterLogs: 'id, date',
      workouts: 'id, date',
      settings: 'id',
      metOverrides: 'id, activityId, [activityId+intensity]',
    });
    this.version(2)
      .stores({
        dishes: 'id, name, category, favorite, importKey',
        dayPlans: 'date',
        shopping: 'id, mergeKey, purchased, category',
        weights: 'id, date',
        vitamins: 'id, name',
        vitaminLogs: 'id, vitaminId, date, [vitaminId+date+time]',
        waterLogs: 'id, date',
        workouts: 'id, date',
        settings: 'id',
        metOverrides: 'id, activityId, [activityId+intensity]',
      })
      .upgrade(async (transaction) => {
        await normalizeImportedDishes(transaction);

        const now = new Date().toISOString();
        const vitaminTable = transaction.table('vitamins');
        const currentVitamins = (await vitaminTable.toArray()) as Vitamin[];
        const defaults = createDefaultVitamins(now);
        const existingNames = new Set(currentVitamins.map((vitamin) => vitamin.name.trim().toLocaleLowerCase('ru-RU')));
        const missingDefaults = defaults.filter(
          (vitamin) => !existingNames.has(vitamin.name.toLocaleLowerCase('ru-RU')),
        );
        if (missingDefaults.length) await vitaminTable.bulkAdd(missingDefaults);

        const settingsTable = transaction.table('settings');
        const existingSettings = (await settingsTable.get('app')) as AppSettings | undefined;
        if (existingSettings) {
          await settingsTable.put({
            ...existingSettings,
            breakfastTime: '07:30',
            lunchStartTime: '13:00',
            lunchEndTime: '14:00',
            dinnerStartTime: '19:00',
            dinnerEndTime: '20:00',
            waterMealRemindersEnabled: true,
            vitaminRemindersEnabled: true,
            updatedAt: now,
          });
        }
      });
    this.version(3)
      .stores({
        dishes: 'id, name, category, favorite, importKey',
        dayPlans: 'date',
        shopping: 'id, mergeKey, purchased, category',
        weights: 'id, date',
        vitamins: 'id, name',
        vitaminLogs: 'id, vitaminId, date, [vitaminId+date+time]',
        waterLogs: 'id, date',
        workouts: 'id, date',
        settings: 'id',
        metOverrides: 'id, activityId, [activityId+intensity]',
      })
      .upgrade(async (transaction) => {
        const vitaminTable = transaction.table('vitamins');
        const currentVitamins = (await vitaminTable.toArray()) as Vitamin[];
        const existingNames = new Set(currentVitamins.map((vitamin) => vitamin.name.trim().toLocaleLowerCase('ru-RU')));
        const missingDefaults = createDefaultVitamins(new Date().toISOString()).filter(
          (vitamin) => !existingNames.has(vitamin.name.toLocaleLowerCase('ru-RU')),
        );
        if (missingDefaults.length) await vitaminTable.bulkAdd(missingDefaults);
      });
    this.version(4)
      .stores({
        dishes: 'id, name, category, favorite, importKey',
        dayPlans: 'date',
        shopping: 'id, mergeKey, purchased, category',
        weights: 'id, date',
        vitamins: 'id, name',
        vitaminLogs: 'id, vitaminId, date, [vitaminId+date+time]',
        waterLogs: 'id, date',
        workouts: 'id, date',
        settings: 'id',
        metOverrides: 'id, activityId, [activityId+intensity]',
      })
      .upgrade(normalizeImportedDishes);
    this.version(5)
      .stores({
        dishes: 'id, name, category, favorite, importKey',
        dayPlans: 'date',
        shopping: 'id, mergeKey, purchased, category',
        weights: 'id, date',
        vitamins: 'id, name',
        vitaminLogs: 'id, vitaminId, date, [vitaminId+date+time]',
        waterLogs: 'id, date',
        workouts: 'id, date',
        settings: 'id',
        metOverrides: 'id, activityId, [activityId+intensity]',
      })
      .upgrade(normalizeImportedDishes);
  }
}

export const db = new NutritionDatabase();

export const DEFAULT_SETTINGS: AppSettings = {
  id: 'app',
  calorieGoal: 1500,
  waterGoalMl: 2000,
  wakeTime: '07:30',
  sleepTime: '23:00',
  waterRemindersEnabled: false,
  waterReminderIntervalMin: 90,
  vitaminRemindersEnabled: true,
  waterMealRemindersEnabled: true,
  breakfastTime: '07:30',
  lunchStartTime: '13:00',
  lunchEndTime: '14:00',
  dinnerStartTime: '19:00',
  dinnerEndTime: '20:00',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export async function getSettings(): Promise<AppSettings> {
  const current = await db.settings.get('app');
  if (current) return current;
  await db.settings.put(DEFAULT_SETTINGS);
  return DEFAULT_SETTINGS;
}

export async function saveSettings(patch: Partial<AppSettings>): Promise<void> {
  const current = await getSettings();
  await db.settings.put({
    ...current,
    ...patch,
    id: 'app',
    updatedAt: new Date().toISOString(),
  });
}

export async function getOrCreateDayPlan(date: string): Promise<DayPlan> {
  const existing = await db.dayPlans.get(date);
  if (existing) return existing;
  const plan: DayPlan = {
    date,
    breakfast: [],
    lunch: [],
    dinner: [],
    updatedAt: new Date().toISOString(),
  };
  await db.dayPlans.put(plan);
  return plan;
}

export async function saveDayPlan(plan: DayPlan): Promise<void> {
  await db.dayPlans.put({ ...plan, updatedAt: new Date().toISOString() });
}
