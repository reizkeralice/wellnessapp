import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import { db } from '@/db/database';
import type { DayPlan, MealCategory, Vitamin, VitaminDoseStatus, VitaminLog, VitaminMealSlot } from '@/types';
import { WEEKDAY_LABELS } from '@/types';
import { Button, Card, Confirm, EmptyState, Field, inputClass, Segmented, Sheet } from '@/components/ui/Ui';
import { createId } from '@/lib/ids';
import { todayIso, nowTime, dateInRange, startOfWeekMonday, weekDates } from '@/lib/dates';
import { getNotificationSupport, requestNotificationPermission } from '@/lib/notifications';
import { containsLactoseIngredient } from '@/lib/dishName';

function dueToday(v: Vitamin, date: string): boolean {
  const weekday = new Date(`${date}T12:00:00`).getDay();
  if (v.weekdays.length && !v.weekdays.includes(weekday)) return false;
  return dateInRange(date, v.startDate, v.endDate);
}

interface ScheduledDose {
  vitamin: Vitamin;
  date: string;
  time: string;
  mealSlot: VitaminMealSlot;
  status: VitaminDoseStatus;
}

const MEALS: MealCategory[] = ['breakfast', 'lunch', 'dinner'];
const MEAL_SLOT_LABELS: Record<VitaminMealSlot, string> = {
  breakfast: 'Завтрак',
  lunch: 'Обед',
  dinner: 'Ужин',
  bedtime: 'Перед сном',
  any: 'По расписанию блюда',
};

function scheduledDoses(
  vitamins: Vitamin[],
  date: string,
  plan: DayPlan | undefined,
  logs: VitaminLog[],
): ScheduledDose[] {
  const now = nowTime();
  return vitamins.flatMap((vitamin) => {
    if (!dueToday(vitamin, date)) return [];
    if (vitamin.condition === 'lactose') {
      return MEALS.flatMap((meal, index) => {
        const items = plan?.[meal] ?? [];
        const hasLactose = items.some((item) =>
          containsLactoseIngredient(item.ingredients.map((ingredient) => ingredient.name)),
        );
        if (!hasLactose) return [];
        const time = vitamin.scheduleTimes[index] ?? '—';
        const log = logs.find((entry) => entry.vitaminId === vitamin.id && entry.time === time);
        return [{
          vitamin,
          date,
          time,
          mealSlot: meal,
          status: log?.status ?? (date < todayIso() || (date === todayIso() && time !== '—' && time < now) ? 'missed' : 'planned'),
        }];
      });
    }

    return (vitamin.scheduleTimes.length ? vitamin.scheduleTimes : ['—']).map((time) => {
      const log = logs.find((entry) => entry.vitaminId === vitamin.id && entry.time === time);
      return {
        vitamin,
        date,
        time,
        mealSlot: vitamin.mealSlot ?? 'any',
        status: log?.status ?? (date < todayIso() || (date === todayIso() && time !== '—' && time < now) ? 'missed' : 'planned'),
      };
    });
  });
}

export function VitaminsPage() {
  const vitamins = useLiveQuery(() => db.vitamins.toArray(), []) ?? [];
  const today = todayIso();
  const weekStart = startOfWeekMonday(today);
  const dates = weekDates(today);
  const plans = useLiveQuery(() => db.dayPlans.bulkGet(dates), [weekStart]) ?? [];
  const logs = useLiveQuery(() => db.vitaminLogs.where('date').equals(today).toArray(), [today]) ?? [];
  const weekLogs =
    useLiveQuery(
      () => db.vitaminLogs.where('date').between(weekStart, dates[6] ?? weekStart, true, true).toArray(),
      [weekStart],
    ) ?? [];
  const history = useLiveQuery(() => db.vitaminLogs.orderBy('date').reverse().limit(40).toArray(), []) ?? [];
  const [tab, setTab] = useState<'today' | 'week' | 'list' | 'history'>('today');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Vitamin | null>(null);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [notice, setNotice] = useState(getNotificationSupport().message);

  const planned = scheduledDoses(vitamins, today, plans[dates.indexOf(today)], logs);

  async function setStatus(v: Vitamin, date: string, time: string, status: VitaminDoseStatus) {
    const id = `${v.id}-${date}-${time}`;
    const log: VitaminLog = {
      id,
      vitaminId: v.id,
      date,
      time,
      status,
      takenAt: status === 'taken' ? new Date().toISOString() : undefined,
    };
    await db.vitaminLogs.put(log);
  }

  return (
    <div className="space-y-3">
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { id: 'today', label: 'Сегодня' },
          { id: 'week', label: 'Неделя' },
          { id: 'list', label: 'Список' },
          { id: 'history', label: 'История' },
        ]}
      />
      <Button className="w-full" onClick={() => { setEditing(null); setOpen(true); }}>
        Добавить препарат
      </Button>
      <p className="text-xs text-muted">{notice}</p>
      <Button
        variant="soft"
        className="w-full"
        onClick={async () => {
          const perm = await requestNotificationPermission();
          setNotice(
            perm === 'granted'
              ? 'Разрешение получено. Напоминание не отмечает приём автоматически.'
              : getNotificationSupport().message,
          );
        }}
      >
        Разрешить уведомления
      </Button>

      {tab === 'today' && (
        <>
          {planned.length === 0 ? (
            <EmptyState title="На сегодня ничего не запланировано" text="Добавьте блюда в планнере: Лактазар появится только для блюд с молочными ингредиентами." />
          ) : (
            (['breakfast', 'lunch', 'dinner', 'bedtime', 'any'] as VitaminMealSlot[]).map((slot) => {
              const doses = planned.filter((dose) => dose.mealSlot === slot);
              if (!doses.length) return null;
              return (
                <section key={slot} className="space-y-2">
                  <h2 className="page-title px-1 text-xl">{MEAL_SLOT_LABELS[slot]}</h2>
                  {doses.map((dose) => (
                    <DoseCard key={`${dose.vitamin.id}-${dose.time}`} dose={dose} onStatus={setStatus} />
                  ))}
                </section>
              );
            })
          )}
        </>
      )}

      {tab === 'week' && (
        <div className="space-y-3">
          {dates.map((date, index) => {
            const dayDoses = scheduledDoses(vitamins, date, plans[index], weekLogs.filter((log) => log.date === date));
            const dayLabel = new Date(`${date}T12:00:00`).toLocaleDateString('ru-RU', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            });
            return (
              <Card key={date}>
                <h2 className="mb-3 font-semibold capitalize">{dayLabel}{date === today ? ' · сегодня' : ''}</h2>
                {dayDoses.length === 0 ? (
                  <p className="text-sm text-muted">Приёмов по расписанию нет. Лактазар добавляется только к блюдам с молочными ингредиентами.</p>
                ) : (
                  <div className="space-y-2">
                    {dayDoses.map((dose) => (
                      <DoseCard key={`${dose.vitamin.id}-${dose.time}`} dose={dose} onStatus={setStatus} compact />
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {tab === 'list' && (
        <>
          {vitamins.length === 0 && (
            <EmptyState title="Список пуст" text="Назначения вводятся только вами. Готовых дозировок нет." />
          )}
          {vitamins.map((v) => (
            <Card key={v.id}>
              <div className="font-semibold">{v.name}</div>
              <div className="text-sm text-muted">
                {v.dosage} {v.dosageUnit} · {v.scheduleTimes.join(', ') || 'время не указано'}
              </div>
              <div className="mt-1 text-xs text-muted">
                {v.mealSlot ? MEAL_SLOT_LABELS[v.mealSlot] : 'Время приёма'}
                {v.condition === 'lactose' ? ' · только при наличии молочных ингредиентов в блюде' : ''}
              </div>
              <div className="mt-1 text-xs text-muted">
                {v.weekdays.length ? v.weekdays.map((d) => WEEKDAY_LABELS[d]).join(' ') : 'каждый день'}
              </div>
              {v.notes && <p className="mt-1 text-sm">{v.notes}</p>}
              <div className="mt-2 flex gap-2">
                <Button variant="soft" onClick={() => { setEditing(v); setOpen(true); }}>
                  Изменить
                </Button>
                <Button variant="danger" onClick={() => setRemoveId(v.id)}>
                  Удалить
                </Button>
              </div>
            </Card>
          ))}
        </>
      )}

      {tab === 'history' && (
        <>
          {history.length === 0 && <EmptyState title="История пуста" text="Отметьте приём, чтобы появилась запись." />}
          {history.map((l) => {
            const v = vitamins.find((x) => x.id === l.vitaminId);
            return (
              <Card key={l.id}>
                <div className="font-medium">{v?.name ?? 'Удалённый препарат'}</div>
                <div className="text-sm text-muted">
                  {l.date} {l.time} · {l.status === 'taken' ? 'принято' : l.status === 'missed' ? 'пропущено' : 'запланировано'}
                </div>
              </Card>
            );
          })}
        </>
      )}

      <VitaminForm open={open} vitamin={editing} onClose={() => setOpen(false)} />
      <Confirm
        open={!!removeId}
        title="Удалить препарат?"
        text="Позиция будет удалена из списка. История приёмов сохранится."
        onCancel={() => setRemoveId(null)}
        onConfirm={async () => {
          if (removeId) await db.vitamins.delete(removeId);
          setRemoveId(null);
        }}
      />
    </div>
  );
}

function DoseCard({
  dose,
  onStatus,
  compact = false,
}: {
  dose: ScheduledDose;
  onStatus: (vitamin: Vitamin, date: string, time: string, status: VitaminDoseStatus) => Promise<void>;
  compact?: boolean;
}) {
  const { vitamin, date, time, status } = dose;
  return (
    <Card className={compact ? 'p-3' : ''}>
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="break-words font-semibold">{vitamin.name}</div>
          <div className="break-words text-sm text-muted">
            {vitamin.dosage} {vitamin.dosageUnit} · {MEAL_SLOT_LABELS[dose.mealSlot]} · {time}
          </div>
          <div className={`mt-1 text-xs ${status === 'taken' ? 'text-sage' : status === 'missed' ? 'text-[#a64e64]' : 'text-muted'}`}>
            {status === 'taken' ? 'Принято' : status === 'missed' ? 'Пропущено' : 'Запланировано'}
          </div>
        </div>
        {status !== 'taken' && (
          <div className="flex shrink-0 gap-1">
            <Button variant="soft" className="px-2 text-xs" onClick={() => onStatus(vitamin, date, time, 'taken')}>
              Принято
            </Button>
            {status !== 'missed' && (
              <Button variant="ghost" className="px-2 text-xs" onClick={() => onStatus(vitamin, date, time, 'missed')}>
                Пропуск
              </Button>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

function VitaminForm({ open, vitamin, onClose }: { open: boolean; vitamin: Vitamin | null; onClose: () => void }) {
  const [name, setName] = useState(vitamin?.name ?? '');
  const [dosage, setDosage] = useState(vitamin ? String(vitamin.dosage) : '');
  const [unit, setUnit] = useState(vitamin?.dosageUnit ?? 'мг');
  const [times, setTimes] = useState(vitamin?.scheduleTimes.join(', ') ?? '09:00');
  const [days, setDays] = useState<number[]>(vitamin?.weekdays ?? [1, 2, 3, 4, 5, 6, 0]);
  const [start, setStart] = useState(vitamin?.startDate ?? '');
  const [end, setEnd] = useState(vitamin?.endDate ?? '');
  const [notes, setNotes] = useState(vitamin?.notes ?? '');
  const [remind, setRemind] = useState(vitamin?.remindersEnabled ?? false);
  const [mealSlot, setMealSlot] = useState<VitaminMealSlot>(vitamin?.mealSlot ?? 'any');
  const [lactoseOnly, setLactoseOnly] = useState(vitamin?.condition === 'lactose');

  useEffect(() => {
    if (!open) return;
    setName(vitamin?.name ?? '');
    setDosage(vitamin ? String(vitamin.dosage) : '');
    setUnit(vitamin?.dosageUnit ?? 'мг');
    setTimes(vitamin?.scheduleTimes.join(', ') ?? '09:00');
    setDays(vitamin?.weekdays ?? [1, 2, 3, 4, 5, 6, 0]);
    setStart(vitamin?.startDate ?? '');
    setEnd(vitamin?.endDate ?? '');
    setNotes(vitamin?.notes ?? '');
    setRemind(vitamin?.remindersEnabled ?? false);
    setMealSlot(vitamin?.mealSlot ?? 'any');
    setLactoseOnly(vitamin?.condition === 'lactose');
  }, [open, vitamin]);

  const title = useMemo(() => (vitamin ? 'Изменить' : 'Новая позиция'), [vitamin]);

  return (
    <Sheet open={open} title={title} onClose={onClose}>
      <div className="space-y-3">
        <Field label="Название">
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Дозировка">
            <input className={inputClass} inputMode="decimal" value={dosage} onChange={(e) => setDosage(e.target.value)} />
          </Field>
          <Field label="Единица">
            <input className={inputClass} value={unit} onChange={(e) => setUnit(e.target.value)} />
          </Field>
        </div>
        <Field label="Время приёма через запятую">
          <input className={inputClass} value={times} onChange={(e) => setTimes(e.target.value)} />
        </Field>
        <Field label="Приём пищи">
          <select className={inputClass} value={mealSlot} onChange={(e) => setMealSlot(e.target.value as VitaminMealSlot)}>
            <option value="any">По расписанию</option>
            <option value="breakfast">Завтрак</option>
            <option value="lunch">Обед</option>
            <option value="dinner">Ужин</option>
            <option value="bedtime">Перед сном</option>
          </select>
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={lactoseOnly} onChange={(e) => setLactoseOnly(e.target.checked)} />
          Показывать только при наличии молочных ингредиентов в блюде
        </label>
        <div className="flex flex-wrap gap-1">
          {WEEKDAY_LABELS.map((label, idx) => (
            <button
              key={label}
              className={`rounded-xl px-2 py-1 text-sm ${days.includes(idx) ? 'bg-sage text-white' : 'bg-white'}`}
              onClick={() =>
                setDays(days.includes(idx) ? days.filter((d) => d !== idx) : [...days, idx])
              }
            >
              {label}
            </button>
          ))}
        </div>
        <Field label="Начало">
          <input className={inputClass} type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </Field>
        <Field label="Окончание">
          <input className={inputClass} type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
        </Field>
        <Field label="Заметки">
          <textarea className={`${inputClass} min-h-20`} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={remind} onChange={(e) => setRemind(e.target.checked)} />
          Напоминания (не отмечают приём автоматически)
        </label>
        <Button
          className="w-full"
          onClick={async () => {
            if (!name.trim()) return;
            const now = new Date().toISOString();
            const item: Vitamin = {
              id: vitamin?.id ?? createId(),
              name: name.trim(),
              dosage: Number(dosage) || 0,
              dosageUnit: unit,
              scheduleTimes: times
                .split(',')
                .map((t) => t.trim())
                .filter(Boolean),
              mealSlot,
              condition: lactoseOnly ? 'lactose' : undefined,
              weekdays: days,
              startDate: start || undefined,
              endDate: end || undefined,
              notes: notes.trim() || undefined,
              remindersEnabled: remind,
              createdAt: vitamin?.createdAt ?? now,
            };
            await db.vitamins.put(item);
            onClose();
          }}
        >
          Сохранить
        </Button>
      </div>
    </Sheet>
  );
}
