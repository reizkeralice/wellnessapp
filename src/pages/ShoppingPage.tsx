import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { db } from '@/db/database';
import type { DayPlan, Ingredient, ShoppingCategory, ShoppingItem } from '@/types';
import { SHOPPING_LABELS } from '@/types';
import { Button, Card, Confirm, EmptyState, Field, inputClass, Segmented, Sheet } from '@/components/ui/Ui';
import {
  addMissingToShopping,
  applyAddToShopping,
  inferShoppingCategory,
  mergeKey,
  mergeIngredients,
  scaleIngredients,
} from '@/lib/shopping';
import { createId } from '@/lib/ids';
import { addDays, todayIso, weekDates } from '@/lib/dates';
import { DishPicker } from '@/components/dishes/DishPicker';

type Filter = 'all' | 'need' | 'bought';
type Source = 'dish' | 'day' | 'week' | 'range';

export function ShoppingPage() {
  const items = useLiveQuery(() => db.shopping.toArray(), []) ?? [];
  const dishes = useLiveQuery(() => db.dishes.toArray(), []) ?? [];
  const [filter, setFilter] = useState<Filter>('all');
  const [manualOpen, setManualOpen] = useState(false);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [source, setSource] = useState<Source>('day');
  const [from, setFrom] = useState(todayIso());
  const [to, setTo] = useState(todayIso());
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [unit, setUnit] = useState('г');
  const [category, setCategory] = useState<ShoppingCategory>('other');
  const [toast, setToast] = useState('');

  const filtered = items.filter((i) => {
    if (filter === 'need') return !i.purchased;
    if (filter === 'bought') return i.purchased;
    return true;
  });

  const grouped = useMemo(() => {
    const map = new Map<ShoppingCategory, ShoppingItem[]>();
    for (const item of filtered) {
      const list = map.get(item.category) ?? [];
      list.push(item);
      map.set(item.category, list);
    }
    return map;
  }, [filtered]);

  async function addFromIngredients(ings: Ingredient[], increaseExisting = false) {
    if (ings.length === 0) {
      setToast('Нет ингредиентов для добавления');
      setTimeout(() => setToast(''), 2000);
      return;
    }
    await db.transaction('rw', db.shopping, async () => {
      const current = await db.shopping.toArray();
      const add = increaseExisting ? applyAddToShopping : addMissingToShopping;
      const next = add(current, ings, new Date().toISOString(), createId);
      await db.shopping.clear();
      if (next.length) await db.shopping.bulkAdd(next);
    });
    setToast('Список обновлён');
    setTimeout(() => setToast(''), 2000);
  }

  async function ingredientsFromPlans(dates: string[]): Promise<Ingredient[]> {
    const plans = (await db.dayPlans.bulkGet(dates)).filter(Boolean) as DayPlan[];
    const all: Ingredient[] = [];
    for (const plan of plans) {
      for (const meal of [...plan.breakfast, ...plan.lunch, ...plan.dinner]) {
        all.push(...scaleIngredients(meal.ingredients, meal.portionMultiplier));
      }
    }
    return mergeIngredients(all);
  }

  return (
    <div className="space-y-3">
      <Segmented
        value={filter}
        onChange={setFilter}
        options={[
          { id: 'all', label: 'Все' },
          { id: 'need', label: 'Нужно купить' },
          { id: 'bought', label: 'Куплено' },
        ]}
      />
      <div className="grid grid-cols-2 gap-2">
        <Button onClick={() => setSourceOpen(true)}>Из планнера</Button>
        <Button variant="soft" onClick={() => setManualOpen(true)}>
          Вручную
        </Button>
      </div>

      {filtered.length === 0 && (
        <EmptyState
          title="Список покупок пуст"
          text="Добавьте продукты вручную или соберите их из блюд планнера. Отметки купленного сохраняются отдельно от плана."
        />
      )}

      {[...grouped.entries()].map(([cat, list]) => (
        <Card key={cat}>
          <h2 className="mb-2 font-semibold">{SHOPPING_LABELS[cat]}</h2>
          <div className="space-y-2">
            {list.map((item) => (
              <div key={item.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={item.purchased}
                  onChange={async () => {
                    await db.shopping.update(item.id, { purchased: !item.purchased });
                  }}
                  className="h-5 w-5 accent-sage"
                />
                <div className={`min-w-0 flex-1 ${item.purchased ? 'text-muted line-through' : ''}`}>
                  <div>{item.name}</div>
                </div>
                <input
                  className="h-9 w-16 rounded-xl border border-line px-2 text-sm"
                  inputMode="decimal"
                  value={item.amount}
                  onChange={async (e) => {
                    await db.shopping.update(item.id, { amount: Number(e.target.value) || 0 });
                  }}
                />
                <input
                  className="h-9 w-12 rounded-xl border border-line px-1 text-sm"
                  value={item.unit}
                  onChange={async (e) => {
                    const unit = e.target.value;
                    await db.shopping.update(item.id, {
                      unit,
                      mergeKey: mergeKey(item.name, unit),
                    });
                  }}
                />
                <button className="text-xs text-red-700" onClick={() => setRemoveId(item.id)}>
                  ×
                </button>
              </div>
            ))}
          </div>
        </Card>
      ))}

      <Sheet open={manualOpen} title="Добавить продукт" onClose={() => setManualOpen(false)}>
        <div className="space-y-3">
          <Field label="Название">
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Количество">
              <input className={inputClass} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Field>
            <Field label="Единица">
              <input className={inputClass} value={unit} onChange={(e) => setUnit(e.target.value)} />
            </Field>
          </div>
          <Field label="Категория">
            <select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value as ShoppingCategory)}>
              {Object.entries(SHOPPING_LABELS).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Button
            className="w-full"
            onClick={async () => {
              if (!name.trim()) return;
              await addFromIngredients([
                {
                  id: createId(),
                  name: name.trim(),
                  amount: Number(amount) || 0,
                  unit: unit.trim() || 'г',
                  shoppingCategory: category || inferShoppingCategory(name),
                },
              ], true);
              setName('');
              setAmount('');
              setManualOpen(false);
            }}
          >
            Добавить
          </Button>
        </div>
      </Sheet>

      <Sheet open={sourceOpen} title="Источник списка" onClose={() => setSourceOpen(false)}>
        <div className="space-y-3">
          <Segmented
            value={source}
            onChange={setSource}
            options={[
              { id: 'dish', label: 'Блюдо' },
              { id: 'day', label: 'День' },
              { id: 'week', label: 'Неделя' },
              { id: 'range', label: 'Период' },
            ]}
          />
          {source === 'dish' && (
            <DishPicker
              dishes={dishes}
              onSelect={async (dish) => {
                await addFromIngredients(dish.ingredients);
                setSourceOpen(false);
              }}
            />
          )}
          {source === 'day' && (
            <>
              <Field label="Дата">
                <input className={inputClass} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </Field>
              <Button
                className="w-full"
                onClick={async () => {
                  await addFromIngredients(await ingredientsFromPlans([from]));
                  setSourceOpen(false);
                }}
              >
                Добавить день
              </Button>
            </>
          )}
          {source === 'week' && (
            <Button
              className="w-full"
              onClick={async () => {
                await addFromIngredients(await ingredientsFromPlans(weekDates(todayIso())));
                setSourceOpen(false);
              }}
            >
              Добавить текущую неделю
            </Button>
          )}
          {source === 'range' && (
            <>
              <Field label="С">
                <input className={inputClass} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </Field>
              <Field label="По">
                <input className={inputClass} type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </Field>
              <Button
                className="w-full"
                onClick={async () => {
                  const dates: string[] = [];
                  let cur = from;
                  while (cur <= to) {
                    dates.push(cur);
                    cur = addDays(cur, 1);
                    if (dates.length > 120) break;
                  }
                  await addFromIngredients(await ingredientsFromPlans(dates));
                  setSourceOpen(false);
                }}
              >
                Добавить период
              </Button>
            </>
          )}
        </div>
      </Sheet>

      <Confirm
        open={!!removeId}
        title="Удалить продукт?"
        text="Позиция будет удалена из списка покупок."
        onCancel={() => setRemoveId(null)}
        onConfirm={async () => {
          if (removeId) await db.shopping.delete(removeId);
          setRemoveId(null);
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
