import * as XLSX from 'xlsx';
import type { Dish, Ingredient, MealCategory, Nutrition, PlannedMealItem } from '@/types';
import { createId } from '@/lib/ids';
import { inferShoppingCategory } from '@/lib/shopping';
import { parseIsoDate, toIsoDate } from '@/lib/dates';
import { cleanDishName } from '@/lib/dishName';

export interface SheetPreview {
  name: string;
  headers: string[];
  rows: Record<string, unknown>[];
  totalRows: number;
}

export type DishField =
  | 'skip'
  | 'name'
  | 'category'
  | 'calories'
  | 'protein'
  | 'fat'
  | 'carbs'
  | 'instructions'
  | 'cookTimeMinutes'
  | 'ingredientName'
  | 'ingredientAmount'
  | 'ingredientUnit'
  | 'date'
  | 'meal';

export const DISH_FIELD_LABELS: Record<DishField, string> = {
  skip: 'Не импортировать',
  name: 'Название блюда',
  category: 'Категория (завтрак/обед/ужин)',
  calories: 'Калории',
  protein: 'Белки',
  fat: 'Жиры',
  carbs: 'Углеводы',
  instructions: 'Инструкция',
  cookTimeMinutes: 'Время приготовления',
  ingredientName: 'Ингредиент',
  ingredientAmount: 'Количество ингредиента',
  ingredientUnit: 'Единица ингредиента',
  date: 'Дата плана',
  meal: 'Приём пищи',
};

export function readWorkbook(file: ArrayBuffer): XLSX.WorkBook {
  return XLSX.read(file, { type: 'array', cellDates: true });
}

export function previewSheets(wb: XLSX.WorkBook, limit = 12): SheetPreview[] {
  return wb.SheetNames.map((name) => {
    const sheet = wb.Sheets[name];
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet ?? {}, {
      defval: '',
      raw: false,
    });
    const headers = json[0] ? Object.keys(json[0]) : [];
    return {
      name,
      headers,
      rows: json.slice(0, limit),
      totalRows: json.length,
    };
  });
}

export function guessField(header: string): DishField {
  const h = header.toLowerCase().trim();
  if (/назван|name|блюдо|dish|рецепт/.test(h)) return 'name';
  if (/категор|при[её]м|meal|тип/.test(h)) return 'category';
  if (/калор|ккал|kcal|calories/.test(h)) return 'calories';
  if (/белк|protein/.test(h)) return 'protein';
  if (/жир|fat/.test(h)) return 'fat';
  if (/углевод|carb/.test(h)) return 'carbs';
  if (/инструкц|способ|рецепт приготов|steps/.test(h)) return 'instructions';
  if (/время|мин|cook/.test(h)) return 'cookTimeMinutes';
  if (/ингредиент|продукт|ingredient/.test(h)) return 'ingredientName';
  if (/количест|грамм|amount/.test(h)) return 'ingredientAmount';
  if (/единиц|unit/.test(h)) return 'ingredientUnit';
  if (/дата|date/.test(h)) return 'date';
  return 'skip';
}

function num(value: unknown): number | undefined {
  if (value === '' || value == null) return undefined;
  const n = Number(String(value).replace(',', '.').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : undefined;
}

function str(value: unknown): string {
  return String(value ?? '').trim();
}

function parseCategory(value: unknown): MealCategory | undefined {
  const v = str(value).toLowerCase();
  if (/завтрак|breakfast/.test(v)) return 'breakfast';
  if (/обед|lunch/.test(v)) return 'lunch';
  if (/ужин|dinner/.test(v)) return 'dinner';
  return undefined;
}

function parseDate(value: unknown): string | undefined {
  if (!value) return undefined;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return toIsoDate(value);
  const s = str(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const ru = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2,4})$/);
  if (ru) {
    const d = Number(ru[1]);
    const m = Number(ru[2]);
    const y = Number(ru[3].length === 2 ? `20${ru[3]}` : ru[3]);
    return toIsoDate(new Date(y, m - 1, d));
  }
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) return toIsoDate(parsed);
  try {
    return toIsoDate(parseIsoDate(s));
  } catch {
    return undefined;
  }
}

export interface ImportMapping {
  [header: string]: DishField;
}

export interface ImportResult {
  dishes: Dish[];
  plans: { date: string; meal: MealCategory; dishImportKey: string; name: string }[];
  skippedEmpty: number;
  skippedUnsupportedCategory: number;
  errors: string[];
}

function parseInlineIngredients(value: string): Ingredient[] {
  const parts = value.split(/[,;\n]+/).map((part) => part.trim()).filter(Boolean);
  const ingredients: Ingredient[] = [];

  for (const part of parts) {
    const match = part.match(/^(.+?)\s*[—–-]\s*(\d+(?:[.,]\d+)?)\s*([a-zа-яё.]+)?$/i);
    if (!match) return [];
    const sourceName = match[1]?.trim() ?? '';
    const name = cleanDishName(sourceName);
    const amount = num(match[2]);
    if (!sourceName || !name || amount === undefined) return [];
    const unit = match[3]?.trim() || 'г';
    ingredients.push({
      id: createId(),
      name: sourceName,
      amount,
      unit,
      shoppingCategory: inferShoppingCategory(name),
    });
  }

  return ingredients;
}

function mergeInlineIngredients(ingredients: Ingredient[]): Ingredient[] {
  const merged = new Map<string, Ingredient>();
  for (const ingredient of ingredients) {
    const name = cleanDishName(ingredient.name);
    const key = `${name.toLocaleLowerCase('ru-RU')}|${ingredient.unit.toLocaleLowerCase('ru-RU')}`;
    const existing = merged.get(key);
    if (existing) existing.amount += ingredient.amount;
    else merged.set(key, { ...ingredient, name });
  }
  return [...merged.values()];
}

export function parseMappedRows(
  rows: Record<string, unknown>[],
  mapping: ImportMapping,
): ImportResult {
  const dishesByKey = new Map<string, Dish>();
  const plans: ImportResult['plans'] = [];
  const errors: string[] = [];
  let skippedEmpty = 0;
  let skippedUnsupportedCategory = 0;

  rows.forEach((row, index) => {
    const get = (field: DishField): unknown => {
      const header = Object.keys(mapping).find((h) => mapping[h] === field);
      return header ? row[header] : undefined;
    };

    const sourceName = str(get('name'));
    const name = cleanDishName(sourceName);
    const ingredientName = str(get('ingredientName'));
    if (!name && !ingredientName) {
      skippedEmpty += 1;
      return;
    }
    if (!name) {
      errors.push(`Строка ${index + 2}: нет названия блюда`);
      return;
    }

    const categoryValue = str(get('category'));
    const category = parseCategory(categoryValue);
    if (categoryValue && !category) {
      skippedUnsupportedCategory += 1;
      return;
    }

    const nutrition: Nutrition = {
      calories: num(get('calories')) ?? 0,
      protein: num(get('protein')) ?? 0,
      fat: num(get('fat')) ?? 0,
      carbs: num(get('carbs')) ?? 0,
    };
    const sourceIngredients =
      ingredientName && !str(get('ingredientAmount'))
        ? parseInlineIngredients(ingredientName)
        : [];
    const inlineIngredients = mergeInlineIngredients(sourceIngredients);
    const dishCategory = category ?? 'lunch';
    const recipeSignature = [
      sourceName.toLocaleLowerCase('ru-RU').replace(/\s+/g, ' '),
      dishCategory,
      nutrition.calories,
      nutrition.protein,
      nutrition.fat,
      nutrition.carbs,
      ...sourceIngredients.map(
        (ingredient) =>
          `${ingredient.name.toLocaleLowerCase('ru-RU').replace(/\s+/g, ' ')}:${ingredient.amount}:${ingredient.unit.toLocaleLowerCase('ru-RU')}`,
      ),
    ].join('|');
    const importKey = `excel:${recipeSignature}`;
    let dish = dishesByKey.get(importKey);
    if (!dish) {
      const hasAnyNutrition = Object.values(nutrition).some((v) => v > 0);
      dish = {
        id: createId(),
        name,
        category: dishCategory,
        ingredients: inlineIngredients,
        nutrition: hasAnyNutrition ? nutrition : { calories: 0, protein: 0, fat: 0, carbs: 0 },
        instructions: str(get('instructions')) || undefined,
        cookTimeMinutes: num(get('cookTimeMinutes')),
        favorite: false,
        importKey,
        servingLabel: inlineIngredients.length ? '1 порция по граммовкам из файла' : undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      dishesByKey.set(importKey, dish);
    } else {
      const c = num(get('calories'));
      const p = num(get('protein'));
      const f = num(get('fat'));
      const cb = num(get('carbs'));
      if (c != null && dish.nutrition.calories === 0) dish.nutrition.calories = c;
      if (p != null && dish.nutrition.protein === 0) dish.nutrition.protein = p;
      if (f != null && dish.nutrition.fat === 0) dish.nutrition.fat = f;
      if (cb != null && dish.nutrition.carbs === 0) dish.nutrition.carbs = cb;
      const instr = str(get('instructions'));
      if (instr && !dish.instructions) dish.instructions = instr;
    }

    if (ingredientName && !inlineIngredients.length) {
      const amount = num(get('ingredientAmount')) ?? 0;
      const unit = str(get('ingredientUnit')) || 'г';
      const already = dish.ingredients.some(
        (i) => i.name.toLowerCase() === ingredientName.toLowerCase() && i.unit === unit,
      );
      if (!already) {
        const ingredient: Ingredient = {
          id: createId(),
          name: cleanDishName(ingredientName),
          amount,
          unit,
          shoppingCategory: inferShoppingCategory(ingredientName),
        };
        dish.ingredients.push(ingredient);
      }
    }

    const date = parseDate(get('date'));
    const meal = parseCategory(get('meal')) ?? parseCategory(get('category'));
    if (date && meal) {
      plans.push({ date, meal, dishImportKey: importKey, name });
    }
  });

  return {
    dishes: [...dishesByKey.values()],
    plans,
    skippedEmpty,
    skippedUnsupportedCategory,
    errors,
  };
}

export function snapshotFromDish(dish: Dish, meal: MealCategory): PlannedMealItem {
  return {
    id: createId(),
    dishId: dish.id,
    name: dish.name,
    category: meal,
    nutrition: { ...dish.nutrition },
    ingredients: dish.ingredients.map((i) => ({ ...i })),
    imageDataUrl: dish.imageDataUrl,
    portionMultiplier: 1,
    cookTimeMinutes: dish.cookTimeMinutes,
    instructions: dish.instructions,
  };
}

export function sheetRows(wb: XLSX.WorkBook, sheetName: string): Record<string, unknown>[] {
  const sheet = wb.Sheets[sheetName];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '', raw: false });
}
