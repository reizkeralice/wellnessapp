import { useLiveQuery } from 'dexie-react-hooks';
import { Activity, ArrowRight, CalendarDays, Droplets, Flame, Plus, Scale, Sparkles, UtensilsCrossed } from 'lucide-react';
import { db, getSettings } from '@/db/database';
import { todayIso, formatLongDate } from '@/lib/dates';
import { dayNutrition, formatKcal } from '@/lib/nutrition';
import { Card, Button } from '@/components/ui/Ui';
import { Macros } from '@/components/nutrition/Macros';
import { MEAL_LABELS, type MealCategory } from '@/types';
import { navigate } from '@/hooks/useHashRoute';

export function HomePage() {
  const date = todayIso();
  const plan = useLiveQuery(() => db.dayPlans.get(date), [date]);
  const settings = useLiveQuery(() => getSettings(), []);
  const water = useLiveQuery(() => db.waterLogs.where('date').equals(date).toArray(), [date]);
  const vitamins = useLiveQuery(() => db.vitamins.toArray(), []);
  const vitaminLogs = useLiveQuery(() => db.vitaminLogs.where('date').equals(date).toArray(), [date]);
  const lastWeight = useLiveQuery(async () => {
    const all = await db.weights.orderBy('date').reverse().limit(1).toArray();
    return all[0];
  }, []);
  const workouts = useLiveQuery(() => db.workouts.where('date').equals(date).toArray(), [date]);

  const nutrition = dayNutrition(plan);
  const calorieGoal = settings?.calorieGoal ?? 1500;
  const caloriePct = calorieGoal > 0 ? Math.min(100, Math.round((nutrition.calories / calorieGoal) * 100)) : 0;
  const caloriesLeft = Math.max(0, Math.round(calorieGoal - nutrition.calories));
  const waterMl = water?.reduce((sum, entry) => sum + entry.ml, 0) ?? 0;
  const waterGoal = settings?.waterGoalMl ?? 2000;
  const waterPct = waterGoal > 0 ? Math.min(100, Math.round((waterMl / waterGoal) * 100)) : 0;
  const weekday = new Date().getDay();
  const dueVitamins = (vitamins ?? []).filter((vitamin) => {
    if (vitamin.weekdays.length && !vitamin.weekdays.includes(weekday)) return false;
    if (vitamin.startDate && date < vitamin.startDate) return false;
    if (vitamin.endDate && date > vitamin.endDate) return false;
    return true;
  });
  const takenCount = dueVitamins.filter((vitamin) =>
    (vitaminLogs ?? []).some((log) => log.vitaminId === vitamin.id && log.status === 'taken'),
  ).length;
  const meals: MealCategory[] = ['breakfast', 'lunch', 'dinner'];
  const mealCount = meals.filter((meal) => (plan?.[meal].length ?? 0) > 0).length;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Доброе утро' : hour < 18 ? 'Хорошего дня' : 'Добрый вечер';

  return (
    <div className="space-y-4 pb-2">
      <section
        className="relative overflow-hidden rounded-[2rem] p-5 text-white shadow-[0_18px_40px_rgba(132,94,139,0.2)]"
        style={{ background: 'linear-gradient(135deg, #bd879e 0%, #a482ae 52%, #8883b3 100%)' }}
      >
        <div className="pointer-events-none absolute -right-10 -top-14 h-44 w-44 rounded-full border border-white/15" />
        <div className="pointer-events-none absolute -right-1 -top-5 h-28 w-28 rounded-full border border-white/15" />
        <div className="relative">
          <div className="text-sm font-medium text-white/80">{greeting}</div>
          <h2 className="page-title mt-1 text-[1.7rem] leading-tight">Твой день в балансе</h2>
          <p className="mt-1 text-sm capitalize text-white/80">{formatLongDate(date)}</p>

          <div className="mt-5 flex items-center gap-4">
            <div
              className="grid h-[6.25rem] w-[6.25rem] shrink-0 place-items-center rounded-full p-[5px]"
              style={{ background: `conic-gradient(#fff ${caloriePct}%, rgba(255,255,255,.24) ${caloriePct}% 100%)` }}
              role="progressbar"
              aria-label="Калории за сегодня"
              aria-valuenow={Math.round(nutrition.calories)}
              aria-valuemin={0}
              aria-valuemax={calorieGoal}
            >
              <div className="grid h-full w-full place-items-center rounded-full bg-[#9c80aa] text-center">
                <div>
                  <div className="text-xl font-semibold leading-none">{Math.round(nutrition.calories)}</div>
                  <div className="mt-1 text-[10px] text-white/75">из {calorieGoal}</div>
                </div>
              </div>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-sm text-white/80">
                <Flame size={15} />
                <span>Калории сегодня</span>
              </div>
              <div className="mt-1 text-2xl font-semibold leading-tight">
                {caloriesLeft > 0 ? `${caloriesLeft} ккал` : 'Цель достигнута'}
              </div>
              <p className="mt-1 text-xs text-white/75">
                {caloriesLeft > 0 ? 'Можно добавить в план' : `${caloriePct}% дневной цели`}
              </p>
            </div>
          </div>

          <button
            className="mt-5 inline-flex min-h-11 w-full items-center justify-between rounded-2xl bg-white/15 px-4 text-left text-sm font-medium backdrop-blur transition hover:bg-white/20"
            onClick={() => navigate('planner')}
          >
            <span className="inline-flex items-center gap-2"><CalendarDays size={17} /> Открыть планнер</span>
            <ArrowRight size={17} />
          </button>
        </div>
      </section>

      <Card>
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <h2 className="page-title text-xl">Мой рацион</h2>
            <p className="mt-0.5 text-xs text-muted">{mealCount} из 3 приёмов запланировано</p>
          </div>
          <button
            className="inline-flex min-h-10 shrink-0 items-center gap-1 rounded-full bg-[#f7eff5] px-3 text-xs font-medium text-[#805f83]"
            onClick={() => navigate('planner')}
          >
            <Plus size={14} /> Добавить
          </button>
        </div>
        <div className="space-y-2">
          {meals.map((meal) => {
            const items = plan?.[meal] ?? [];
            return (
              <button
                key={meal}
                className="flex min-h-14 w-full items-center gap-3 rounded-2xl border border-[#f0e8ef] bg-white/70 px-3 py-2 text-left"
                onClick={() => navigate('planner')}
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#fbf0f3] to-[#f1edf8] text-[#987693]">
                  <UtensilsCrossed size={16} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-medium text-muted">{MEAL_LABELS[meal]}</span>
                  <span className="block truncate text-sm font-medium">
                    {items.length ? items.map((item) => item.name).join(', ') : 'Пока не запланировано'}
                  </span>
                </span>
                {items.length > 0 && (
                  <span className="shrink-0 text-xs text-muted">
                    {formatKcal(items.reduce((sum, item) => sum + item.nutrition.calories * item.portionMultiplier, 0))}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </Card>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="page-title text-xl">Баланс дня</h2>
            <p className="mt-0.5 text-xs text-muted">КБЖУ по запланированным блюдам</p>
          </div>
          <span className="rounded-full bg-[#f4eff8] px-2.5 py-1 text-xs font-medium text-[#806b91]">{caloriePct}%</span>
        </div>
        <div className="mb-3 h-2 overflow-hidden rounded-full bg-[#f1eaf1]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#c4859b] to-[#9485b5] transition-all"
            style={{ width: `${caloriePct}%` }}
          />
        </div>
        <Macros n={nutrition} />
        <p className="mt-3 text-xs text-muted">
          {caloriesLeft > 0 ? `Осталось ${caloriesLeft} ккал до дневной цели` : 'Дневная цель достигнута'}
        </p>
      </Card>

      <section>
        <div className="mb-2 flex items-end justify-between px-1">
          <div>
            <h2 className="page-title text-xl">Забота о себе</h2>
            <p className="text-xs text-muted">Небольшие шаги каждый день</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button className="text-left" onClick={() => navigate('water')}>
            <Card className="h-full p-3.5">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#edf6f3] text-[#6d9d8c]"><Droplets size={18} /></span>
              <div className="mt-2 text-xs text-muted">Вода</div>
              <div className="mt-0.5 text-sm font-semibold">{waterMl} <span className="font-normal text-muted">/ {waterGoal} мл</span></div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#e8f0ed]">
                <div className="h-full rounded-full bg-[#82b2a1]" style={{ width: `${waterPct}%` }} />
              </div>
            </Card>
          </button>
          <button className="text-left" onClick={() => navigate('vitamins')}>
            <Card className="h-full p-3.5">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#f4eff8] text-[#9477a1]"><Sparkles size={18} /></span>
              <div className="mt-2 text-xs text-muted">Витамины</div>
              <div className="mt-0.5 text-sm font-semibold">{dueVitamins.length ? `${takenCount} из ${dueVitamins.length}` : 'Выходной'}</div>
              <div className="mt-1 text-[11px] text-muted">приёмов отмечено</div>
            </Card>
          </button>
          <button className="text-left" onClick={() => navigate('weight')}>
            <Card className="h-full p-3.5">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#fcf0f2] text-[#bf8198]"><Scale size={18} /></span>
              <div className="mt-2 text-xs text-muted">Последний вес</div>
              <div className="mt-0.5 text-sm font-semibold">{lastWeight ? `${lastWeight.kg} кг` : 'Добавить'}</div>
              <div className="mt-1 text-[11px] text-muted">бережно к себе</div>
            </Card>
          </button>
          <button className="text-left" onClick={() => navigate('sport')}>
            <Card className="h-full p-3.5">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#f0f1f8] text-[#7d86ae]"><Activity size={18} /></span>
              <div className="mt-2 text-xs text-muted">Движение</div>
              <div className="mt-0.5 text-sm font-semibold">
                {workouts?.length ? `${workouts.reduce((sum, workout) => sum + workout.durationMin, 0)} мин` : 'Добавить'}
              </div>
              <div className="mt-1 text-[11px] text-muted">любая активность</div>
            </Card>
          </button>
        </div>
      </section>

      <Button variant="soft" className="w-full" onClick={() => navigate('dishes')}>
        Подобрать блюдо <ArrowRight size={16} />
      </Button>
    </div>
  );
}
