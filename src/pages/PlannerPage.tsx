import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { db, getOrCreateDayPlan, getSettings, saveDayPlan } from '@/db/database';
import type { DayPlan, Dish, MealCategory, PlannedMealItem } from '@/types';
import { MEAL_LABELS } from '@/types';
import { addDays, formatLongDate, startOfWeekMonday, todayIso, weekDates } from '@/lib/dates';
import { dayFillCount, dayNutrition, mealNutrition, scaleNutrition } from '@/lib/nutrition';
import { Button, Card, Confirm, Sheet } from '@/components/ui/Ui';
import { Macros } from '@/components/nutrition/Macros';
import { DishPicker } from '@/components/dishes/DishPicker';
import { snapshotFromDish } from '@/lib/excel';
import { addMissingToShopping, scaleIngredients } from '@/lib/shopping';
import { createId } from '@/lib/ids';
import { containsLactoseIngredient } from '@/lib/dishName';

export function PlannerPage() {
  const [date, setDate] = useState(todayIso());
  const weekStart = startOfWeekMonday(date);
  const days = weekDates(date);
  const plan = useLiveQuery(() => db.dayPlans.get(date), [date]);
  const weekPlans = useLiveQuery(() => db.dayPlans.bulkGet(days), [weekStart]);
  const dishes = useLiveQuery(() => db.dishes.toArray(), []) ?? [];
  const settings = useLiveQuery(() => getSettings(), []);

  const [picker, setPicker] = useState<{ meal: MealCategory; replaceId?: string } | null>(null);
  const [removeItem, setRemoveItem] = useState<{ meal: MealCategory; id: string } | null>(null);
  const [toast, setToast] = useState('');

  const nutrition = dayNutrition(plan);
  const goal = settings?.calorieGoal ?? 1500;
  const planWithoutReplacement = picker?.replaceId && plan
    ? {
        ...plan,
        [picker.meal]: plan[picker.meal].filter((item) => item.id !== picker.replaceId),
      }
    : plan;
  const pickerCalories = planWithoutReplacement ? dayNutrition(planWithoutReplacement).calories : 0;
  const remainingCalories = Math.max(0, goal - pickerCalories);

  async function mutate(mutator: (p: DayPlan) => DayPlan) {
    const current = plan ?? (await getOrCreateDayPlan(date));
    await saveDayPlan(mutator({ ...current, breakfast: [...current.breakfast], lunch: [...current.lunch], dinner: [...current.dinner] }));
  }

  async function addOrReplace(dish: Dish) {
    if (!picker) return;
    const snapshot = snapshotFromDish(dish, picker.meal);
    await mutate((p) => {
      const list = [...p[picker.meal]];
      if (picker.replaceId) {
        const idx = list.findIndex((x) => x.id === picker.replaceId);
        if (idx >= 0) list[idx] = snapshot;
      } else {
        list.push(snapshot);
      }
      return { ...p, [picker.meal]: list };
    });
    setPicker(null);
  }

  async function addIngredients(item: PlannedMealItem) {
    const ings = scaleIngredients(item.ingredients, item.portionMultiplier);
    if (ings.length === 0) {
      setToast('У блюда нет ингредиентов');
      setTimeout(() => setToast(''), 2000);
      return;
    }
    await db.transaction('rw', db.shopping, async () => {
      const current = await db.shopping.toArray();
      const next = addMissingToShopping(current, ings, new Date().toISOString(), createId);
      await db.shopping.bulkPut(next);
    });
    setToast('Ингредиенты добавлены в покупки');
    setTimeout(() => setToast(''), 2000);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button className="rounded-full p-2" onClick={() => setDate(addDays(date, -1))} aria-label="Предыдущий день">
          <ChevronLeft />
        </button>
        <div className="text-center">
          <div className="font-medium capitalize">{formatLongDate(date)}</div>
          <button className="text-xs text-sage" onClick={() => setDate(todayIso())}>
            Сегодня
          </button>
        </div>
        <button className="rounded-full p-2" onClick={() => setDate(addDays(date, 1))} aria-label="Следующий день">
          <ChevronRight />
        </button>
      </div>

      <div className="flex justify-between gap-1">
        {days.map((d, i) => {
          const filled = dayFillCount(weekPlans?.[i]);
          return (
            <button
              key={d}
              onClick={() => setDate(d)}
              className={`flex h-14 w-10 flex-col items-center justify-center rounded-2xl text-xs ${
                d === date ? 'bg-sage text-white' : 'bg-white'
              }`}
            >
              <span>{['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'][i]}</span>
              <span className="font-semibold">{Number(d.slice(8))}</span>
              <span className="text-[10px]">{filled}/3</span>
            </button>
          );
        })}
      </div>

      {(['breakfast', 'lunch', 'dinner'] as MealCategory[]).map((meal) => {
        const items = plan?.[meal] ?? [];
        return (
          <Card key={meal}>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-semibold">{MEAL_LABELS[meal]}</h2>
              <button className="text-sm text-sage" onClick={() => setPicker({ meal })}>
                Добавить
              </button>
            </div>
            {items.length === 0 && <p className="text-sm text-muted">Пусто. Добавьте блюдо из каталога.</p>}
            <div className="space-y-3">
              {items.map((item) => (
                <MealCard
                  key={item.id}
                  item={item}
                  onReplace={() => setPicker({ meal, replaceId: item.id })}
                  onShop={() => addIngredients(item)}
                  onRemove={() => setRemoveItem({ meal, id: item.id })}
                  onPortion={async (m) => {
                    await mutate((p) => ({
                      ...p,
                      [meal]: p[meal].map((x) => (x.id === item.id ? { ...x, portionMultiplier: m } : x)),
                    }));
                  }}
                />
              ))}
            </div>
            {items.length > 0 && (
              <div className="mt-3">
                <div className="mb-1 text-xs text-muted">Итого за приём</div>
                <Macros n={mealNutrition(items)} compact />
              </div>
            )}
          </Card>
        );
      })}

      <Card>
        <h2 className="mb-2 font-semibold">Итоги дня</h2>
        <Macros n={nutrition} />
        <p className="mt-3 text-sm text-muted">Цель: {goal} ккал</p>
        <p className="text-sm">
          Разница: {Math.round(nutrition.calories - goal)} ккал.{' '}
          {nutrition.calories > goal ? 'План выше цели.' : nutrition.calories < goal ? 'План ниже цели.' : 'План совпадает с целью.'}
        </p>
        <p className="mt-2 text-xs text-muted">Спорт не вычитается из пищевой цели.</p>
      </Card>

      <Sheet
        open={!!picker}
        title={picker?.replaceId ? 'Заменить блюдо' : 'Добавить блюдо'}
        onClose={() => setPicker(null)}
      >
        {dishes.length === 0 ? (
          <p className="text-sm text-muted">Сначала добавьте блюда в каталог или импортируйте Excel.</p>
        ) : (
          <DishPicker
            dishes={dishes}
            defaultCategory={picker?.meal}
            maxCalories={remainingCalories}
            onSelect={addOrReplace}
          />
        )}
      </Sheet>

      <Confirm
        open={!!removeItem}
        title="Убрать блюдо из плана?"
        text="Каталог не изменится, удалится только позиция в этом приёме пищи."
        onCancel={() => setRemoveItem(null)}
        onConfirm={async () => {
          if (!removeItem) return;
          await mutate((p) => ({
            ...p,
            [removeItem.meal]: p[removeItem.meal].filter((x) => x.id !== removeItem.id),
          }));
          setRemoveItem(null);
        }}
      />

      {toast && (
        <div className="fixed bottom-24 left-1/2 z-40 -translate-x-1/2 rounded-2xl bg-ink px-4 py-2 text-sm text-white">
          {toast}
        </div>
      )}
    </div>
  );
}

function MealCard({
  item,
  onReplace,
  onShop,
  onRemove,
  onPortion,
}: {
  item: PlannedMealItem;
  onReplace: () => void;
  onShop: () => void;
  onRemove: () => void;
  onPortion: (m: number) => void;
}) {
  const n = useMemo(() => scaleNutrition(item.nutrition, item.portionMultiplier), [item]);
  return (
    <div className="rounded-2xl bg-sand p-3">
      <div className="flex gap-3">
        {item.imageDataUrl && (
          <img src={item.imageDataUrl} alt="" className="h-14 w-14 rounded-2xl object-cover" />
        )}
        <div className="min-w-0 flex-1">
          <div className="font-medium">{item.name}</div>
          {containsLactoseIngredient(item.ingredients.map((ingredient) => ingredient.name)) && (
            <span className="mt-1 inline-flex rounded-full bg-[#fbf0f4] px-2 py-0.5 text-[10px] font-medium text-[#96647f]">
              Лактоза
            </span>
          )}
          <Macros n={n} compact />
        </div>
      </div>
      <label className="mt-2 flex items-center gap-2 text-xs text-muted">
        Порция
        <input
          className="min-h-9 w-20 rounded-xl border border-line bg-white px-2"
          type="number"
          min={0.1}
          step={0.1}
          value={item.portionMultiplier}
          onChange={(e) => onPortion(Number(e.target.value) || 1)}
        />
      </label>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button variant="soft" className="min-h-10 px-3 text-xs" onClick={onReplace}>
          Заменить
        </Button>
        <Button variant="soft" className="min-h-10 px-3 text-xs" onClick={onShop}>
          В покупки
        </Button>
        <Button variant="ghost" className="min-h-10 px-3 text-xs" onClick={onRemove}>
          Удалить
        </Button>
      </div>
    </div>
  );
}
