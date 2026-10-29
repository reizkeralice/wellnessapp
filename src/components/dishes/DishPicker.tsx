import { useMemo, useState } from 'react';
import type { Dish, MealCategory } from '@/types';
import { MEAL_LABELS } from '@/types';
import { inputClass, Segmented } from '@/components/ui/Ui';
import { Macros } from '@/components/nutrition/Macros';
import { scaleNutrition } from '@/lib/nutrition';

export function DishPicker({
  dishes,
  defaultCategory,
  maxCalories,
  onSelect,
}: {
  dishes: Dish[];
  defaultCategory?: MealCategory;
  maxCalories?: number;
  onSelect: (dish: Dish) => void;
}) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<MealCategory | 'all'>(defaultCategory ?? 'all');
  const [showAll, setShowAll] = useState(false);

  const matching = useMemo(() => {
    const q = query.trim().toLowerCase();
    return dishes.filter((d) => {
      const catOk = category === 'all' || d.category === category;
      const nameOk = !q || d.name.toLowerCase().includes(q);
      return catOk && nameOk;
    });
  }, [dishes, query, category]);
  const filtered = useMemo(
    () =>
      matching.filter(
        (dish) =>
          maxCalories === undefined ||
          (dish.nutrition.calories > 0 && dish.nutrition.calories <= maxCalories),
      ),
    [matching, maxCalories],
  );
  const displayed = maxCalories === undefined || !showAll ? filtered : matching;

  return (
    <div className="space-y-3">
      {maxCalories !== undefined && (
        <div className="rounded-2xl border border-[#eee3ec] bg-gradient-to-r from-[#fcf0f3] to-[#f2eef9] p-3 text-sm">
          <div className="font-medium">Осталось на день: {Math.max(0, Math.floor(maxCalories))} ккал</div>
          <p className="mt-1 text-xs text-muted">Показаны блюда, которые помещаются в дневную цель с учётом уже запланированного питания.</p>
        </div>
      )}
      <input
        className={inputClass}
        placeholder="Поиск блюда"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <Segmented
        value={category}
        onChange={setCategory}
        options={[
          { id: 'all', label: 'Все' },
          { id: 'breakfast', label: 'Завтрак' },
          { id: 'lunch', label: 'Обед' },
          { id: 'dinner', label: 'Ужин' },
        ]}
      />
      {maxCalories !== undefined && (
        <button
          className="min-h-10 rounded-xl px-3 text-sm font-medium text-sage"
          onClick={() => setShowAll((value) => !value)}
        >
          {showAll ? 'Скрыть блюда выше цели' : 'Показать все блюда'}
        </button>
      )}
      {displayed.length === 0 && (
        <p className="rounded-2xl bg-white/70 p-3 text-sm text-muted">
          {matching.length === 0
            ? 'Блюда не найдены.'
            : 'На оставшийся лимит не нашлось блюд с известной калорийностью.'}
        </p>
      )}
      <div className="space-y-2">
        {displayed.map((dish) => {
          const fitsGoal =
            maxCalories === undefined ||
            (dish.nutrition.calories > 0 && dish.nutrition.calories <= maxCalories);
          return (
          <button
            key={dish.id}
            onClick={() => onSelect(dish)}
            disabled={!fitsGoal}
            className="w-full min-w-0 rounded-3xl border border-line/80 bg-white/90 p-3 text-left shadow-sm disabled:opacity-55"
          >
            <div className="flex items-start gap-3">
              {dish.imageDataUrl && (
                <img src={dish.imageDataUrl} alt="" className="h-14 w-14 rounded-2xl object-cover" />
              )}
              <div className="min-w-0 flex-1">
                <div className="break-words font-medium">{dish.name}</div>
                <div className="text-xs text-muted">{MEAL_LABELS[dish.category]}</div>
                {!fitsGoal && maxCalories !== undefined && (
                  <div className="mt-1 text-xs font-medium text-[#a64e64]">
                    {dish.nutrition.calories > 0
                      ? `Не помещается: ${Math.round(dish.nutrition.calories - maxCalories)} ккал сверх лимита`
                      : 'Нет данных о калорийности'}
                  </div>
                )}
                <div className="mt-2">
                  <Macros n={scaleNutrition(dish.nutrition, 1)} compact />
                </div>
              </div>
            </div>
          </button>
          );
        })}
      </div>
    </div>
  );
}
