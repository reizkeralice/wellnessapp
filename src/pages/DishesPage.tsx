import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import { Heart, Plus, Trash2 } from 'lucide-react';
import { db } from '@/db/database';
import type { Dish, Ingredient, MealCategory } from '@/types';
import { MEAL_LABELS, SHOPPING_LABELS, type ShoppingCategory } from '@/types';
import { Button, Card, Confirm, EmptyState, Field, inputClass, Segmented, Sheet } from '@/components/ui/Ui';
import { Macros } from '@/components/nutrition/Macros';
import { createId } from '@/lib/ids';
import { inferShoppingCategory } from '@/lib/shopping';
import { scaleNutrition } from '@/lib/nutrition';
import { cleanDishName, containsLactoseIngredient } from '@/lib/dishName';

const emptyIngredient = (): Ingredient => ({
  id: createId(),
  name: '',
  amount: 0,
  unit: 'г',
  shoppingCategory: 'other',
});

export function DishesPage() {
  const dishes = useLiveQuery(() => db.dishes.orderBy('name').toArray(), []) ?? [];
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<MealCategory | 'all' | 'fav'>('all');
  const [editing, setEditing] = useState<Dish | null | 'new'>(null);
  const [details, setDetails] = useState<Dish | null>(null);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [portion, setPortion] = useState(1);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return dishes.filter((d) => {
      if (category === 'fav' && !d.favorite) return false;
      if (category !== 'all' && category !== 'fav' && d.category !== category) return false;
      return !q || d.name.toLowerCase().includes(q);
    });
  }, [dishes, query, category]);
  const sections = useMemo(() => {
    if (category === 'all') {
      return (['breakfast', 'lunch', 'dinner'] as MealCategory[]).map((id) => ({
        id,
        label: MEAL_LABELS[id],
        items: filtered.filter((dish) => dish.category === id),
      }));
    }
    return [{
      id: category,
      label: category === 'fav' ? 'Избранное' : MEAL_LABELS[category],
      items: filtered,
    }];
  }, [category, filtered]);

  return (
    <div className="space-y-3">
      <input className={inputClass} placeholder="Поиск по названию" value={query} onChange={(e) => setQuery(e.target.value)} />
      <Segmented
        value={category}
        onChange={setCategory}
        options={[
          { id: 'all', label: 'Все' },
          { id: 'breakfast', label: 'Завтрак' },
          { id: 'lunch', label: 'Обед' },
          { id: 'dinner', label: 'Ужин' },
          { id: 'fav', label: 'Избранное' },
        ]}
      />
      <Button className="w-full" onClick={() => setEditing('new')}>
        <span className="inline-flex items-center gap-2">
          <Plus size={16} /> Добавить блюдо
        </span>
      </Button>

      {filtered.length === 0 && (
        <EmptyState
          title="Каталог пуст"
          text="Добавьте блюдо вручную или импортируйте Excel в настройках. Демо-данных нет."
        />
      )}

      {sections.map((section) => (
        <section key={section.id} className="min-w-0 space-y-3">
          <div className="flex items-center justify-between px-1 pt-2">
            <h2 className="page-title text-xl">{section.label}</h2>
            <span className="text-xs text-muted">{section.items.length}</span>
          </div>
          {section.items.map((dish) => {
            const lactose = containsLactoseIngredient(dish.ingredients.map((ingredient) => ingredient.name));
            const ingredientSummary = dish.ingredients
              .slice(0, 3)
              .map((ingredient) => ingredient.name)
              .join(' · ');
            return (
              <Card key={dish.id}>
                <button className="w-full min-w-0 text-left" onClick={() => { setDetails(dish); setPortion(1); }}>
                  <div className="flex min-w-0 items-start gap-3">
                    {dish.imageDataUrl && (
                      <img src={dish.imageDataUrl} alt="" className="h-16 w-16 shrink-0 rounded-2xl object-cover" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="break-words font-medium">{cleanDishName(dish.name)}</div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted">
                            <span>{MEAL_LABELS[dish.category]}</span>
                            {dish.servingLabel && <span>· {dish.servingLabel}</span>}
                            {lactose && (
                              <span className="rounded-full bg-[#fbf0f4] px-2 py-0.5 font-medium text-[#96647f]">
                                Лактоза
                              </span>
                            )}
                          </div>
                        </div>
                        {dish.favorite && <Heart size={16} className="shrink-0 fill-sage text-sage" />}
                      </div>
                      {ingredientSummary && (
                        <p className="mt-1 break-words text-xs text-muted">
                          {ingredientSummary}{dish.ingredients.length > 3 ? ` · +${dish.ingredients.length - 3}` : ''}
                        </p>
                      )}
                      <div className="mt-2">
                        <Macros n={dish.nutrition} compact />
                      </div>
                    </div>
                  </div>
                </button>
              </Card>
            );
          })}
        </section>
      ))}

      <Sheet open={!!details} title={details ? cleanDishName(details.name) : ''} onClose={() => setDetails(null)}>
        {details && (
          <div className="space-y-3">
            {details.imageDataUrl && (
              <img src={details.imageDataUrl} alt="" className="h-40 w-full rounded-3xl object-cover" />
            )}
            <Macros n={scaleNutrition(details.nutrition, portion)} />
            {containsLactoseIngredient(details.ingredients.map((ingredient) => ingredient.name)) && (
              <p className="inline-flex rounded-full bg-[#fbf0f4] px-3 py-1 text-sm font-medium text-[#96647f]">
                Содержит молочные ингредиенты · Лактоза
              </p>
            )}
            {details.servingLabel && (
              <p className="text-sm text-muted">Пищевая ценность указана на {details.servingLabel.toLowerCase()}.</p>
            )}
            <Field label="Пересчёт порции">
              <input
                className={inputClass}
                type="number"
                min={0.1}
                step={0.1}
                value={portion}
                onChange={(e) => setPortion(Number(e.target.value) || 1)}
              />
            </Field>
            <p className="text-xs text-muted">
              КБЖУ и ингредиенты умножаются на коэффициент. Пустые пищевые значения не выдумываются.
            </p>
            <div>
              <div className="mb-1 text-sm text-muted">Ингредиенты</div>
              {details.ingredients.length === 0 && <p className="text-sm">Список ингредиентов не указан.</p>}
              {details.ingredients.map((i) => (
                <div key={i.id} className="flex justify-between text-sm">
                  <span>{i.name}</span>
                  <span className="text-muted">
                    {Math.round(i.amount * portion * 100) / 100} {i.unit}
                  </span>
                </div>
              ))}
            </div>
            {details.instructions && (
              <p className="whitespace-pre-wrap text-sm">{details.instructions}</p>
            )}
            {details.cookTimeMinutes ? (
              <p className="text-sm text-muted">Время приготовления: {details.cookTimeMinutes} мин</p>
            ) : null}
            <div className="flex gap-2">
              <Button
                className="flex-1"
                variant="soft"
                onClick={async () => {
                  await db.dishes.update(details.id, { favorite: !details.favorite });
                  setDetails({ ...details, favorite: !details.favorite });
                }}
              >
                {details.favorite ? 'Убрать из избранного' : 'В избранное'}
              </Button>
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => { setEditing(details); setDetails(null); }}>
                Изменить
              </Button>
              <Button variant="danger" onClick={() => setRemoveId(details.id)}>
                <Trash2 size={16} />
              </Button>
            </div>
          </div>
        )}
      </Sheet>

      <DishForm
        open={editing !== null}
        dish={editing === 'new' || editing === null ? null : editing}
        onClose={() => setEditing(null)}
      />

      <Confirm
        open={!!removeId}
        title="Удалить блюдо?"
        text="Блюдо исчезнет из каталога. Уже сохранённые дни планнера не изменятся."
        onCancel={() => setRemoveId(null)}
        onConfirm={async () => {
          if (removeId) await db.dishes.delete(removeId);
          setRemoveId(null);
          setDetails(null);
        }}
      />
    </div>
  );
}

function DishForm({ open, dish, onClose }: { open: boolean; dish: Dish | null; onClose: () => void }) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<MealCategory>('breakfast');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [fat, setFat] = useState('');
  const [carbs, setCarbs] = useState('');
  const [instructions, setInstructions] = useState('');
  const [cook, setCook] = useState('');
  const [ingredients, setIngredients] = useState<Ingredient[]>([emptyIngredient()]);
  const [image, setImage] = useState<string | undefined>();
  const [error, setError] = useState('');

  const reset = (d: Dish | null) => {
    setName(d?.name ?? '');
    setCategory(d?.category ?? 'breakfast');
    setCalories(d ? String(d.nutrition.calories) : '');
    setProtein(d ? String(d.nutrition.protein) : '');
    setFat(d ? String(d.nutrition.fat) : '');
    setCarbs(d ? String(d.nutrition.carbs) : '');
    setInstructions(d?.instructions ?? '');
    setCook(d?.cookTimeMinutes ? String(d.cookTimeMinutes) : '');
    setIngredients(d?.ingredients.length ? d.ingredients.map((i) => ({ ...i })) : [emptyIngredient()]);
    setImage(d?.imageDataUrl);
    setError('');
  };

  useEffect(() => {
    if (open) reset(dish);
  }, [open, dish]);

  return (
    <Sheet
      open={open}
      title={dish ? 'Редактирование' : 'Новое блюдо'}
      onClose={() => {
        reset(null);
        onClose();
      }}
    >
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!name.trim()) {
            setError('Укажите название');
            return;
          }
          const now = new Date().toISOString();
          const payload: Dish = {
            id: dish?.id ?? createId(),
            name: cleanDishName(name),
            category,
            ingredients: ingredients
              .filter((i) => i.name.trim())
              .map((ingredient) => ({ ...ingredient, name: cleanDishName(ingredient.name) })),
            nutrition: {
              calories: Number(calories) || 0,
              protein: Number(protein) || 0,
              fat: Number(fat) || 0,
              carbs: Number(carbs) || 0,
            },
            instructions: instructions.trim() || undefined,
            cookTimeMinutes: cook ? Number(cook) : undefined,
            imageDataUrl: image,
            favorite: dish?.favorite ?? false,
            importKey: dish?.importKey ?? name.trim().toLowerCase(),
            createdAt: dish?.createdAt ?? now,
            updatedAt: now,
          };
          await db.dishes.put(payload);
          reset(null);
          onClose();
        }}
      >
        <Field label="Название">
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Категория">
          <select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value as MealCategory)}>
            <option value="breakfast">Завтрак</option>
            <option value="lunch">Обед</option>
            <option value="dinner">Ужин</option>
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Ккал">
            <input className={inputClass} inputMode="decimal" value={calories} onChange={(e) => setCalories(e.target.value)} />
          </Field>
          <Field label="Белки, г">
            <input className={inputClass} inputMode="decimal" value={protein} onChange={(e) => setProtein(e.target.value)} />
          </Field>
          <Field label="Жиры, г">
            <input className={inputClass} inputMode="decimal" value={fat} onChange={(e) => setFat(e.target.value)} />
          </Field>
          <Field label="Углеводы, г">
            <input className={inputClass} inputMode="decimal" value={carbs} onChange={(e) => setCarbs(e.target.value)} />
          </Field>
        </div>
        <Field label="Время приготовления, мин">
          <input className={inputClass} inputMode="numeric" value={cook} onChange={(e) => setCook(e.target.value)} />
        </Field>
        <Field label="Инструкция">
          <textarea className={`${inputClass} min-h-24`} value={instructions} onChange={(e) => setInstructions(e.target.value)} />
        </Field>
        <Field label="Фото">
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = () => setImage(String(reader.result));
              reader.readAsDataURL(file);
            }}
          />
        </Field>
        <div className="space-y-2">
          <div className="text-sm text-muted">Ингредиенты</div>
          {ingredients.map((ing, idx) => (
            <div key={ing.id} className="grid grid-cols-12 gap-1">
              <input
                className={`${inputClass} col-span-5`}
                placeholder="Продукт"
                value={ing.name}
                onChange={(e) => {
                  const next = [...ingredients];
                  next[idx] = {
                    ...ing,
                    name: e.target.value,
                    shoppingCategory: inferShoppingCategory(e.target.value),
                  };
                  setIngredients(next);
                }}
              />
              <input
                className={`${inputClass} col-span-3`}
                placeholder="Кол-во"
                inputMode="decimal"
                value={ing.amount || ''}
                onChange={(e) => {
                  const next = [...ingredients];
                  next[idx] = { ...ing, amount: Number(e.target.value) || 0 };
                  setIngredients(next);
                }}
              />
              <input
                className={`${inputClass} col-span-2`}
                placeholder="ед."
                value={ing.unit}
                onChange={(e) => {
                  const next = [...ingredients];
                  next[idx] = { ...ing, unit: e.target.value };
                  setIngredients(next);
                }}
              />
              <select
                className={`${inputClass} col-span-12`}
                value={ing.shoppingCategory}
                onChange={(e) => {
                  const next = [...ingredients];
                  next[idx] = { ...ing, shoppingCategory: e.target.value as ShoppingCategory };
                  setIngredients(next);
                }}
              >
                {Object.entries(SHOPPING_LABELS).map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          ))}
          <Button variant="soft" className="w-full" onClick={() => setIngredients([...ingredients, emptyIngredient()])}>
            Ещё ингредиент
          </Button>
        </div>
        {error && <p className="text-sm text-red-700">{error}</p>}
        <Button type="submit" className="w-full">
          Сохранить
        </Button>
      </form>
    </Sheet>
  );
}
