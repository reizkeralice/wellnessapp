import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import { db, getSettings } from '@/db/database';
import { ACTIVITY_PRESETS, INTENSITY_LABELS, estimateCalories } from '@/lib/sport';
import { Button, Card, Confirm, EmptyState, Field, inputClass, Sheet } from '@/components/ui/Ui';
import { createId } from '@/lib/ids';
import { todayIso, addDays } from '@/lib/dates';
import type { Intensity, Workout } from '@/types';

export function SportPage() {
  const workouts = useLiveQuery(() => db.workouts.orderBy('date').reverse().toArray(), []) ?? [];
  const weights = useLiveQuery(() => db.weights.orderBy('date').reverse().limit(1).toArray(), []);
  const overrides = useLiveQuery(() => db.metOverrides.toArray(), []) ?? [];
  const settings = useLiveQuery(() => getSettings(), []);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Workout | null>(null);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [metEdit, setMetEdit] = useState(false);

  const today = todayIso();
  const weekStart = addDays(today, -6);
  const todayList = workouts.filter((w) => w.date === today);
  const weekList = workouts.filter((w) => w.date >= weekStart);
  const lastWeight = weights?.[0]?.kg;

  return (
    <div className="space-y-3">
      <Card>
        <div className="grid grid-cols-2 gap-3 text-center">
          <div>
            <div className="text-xs text-muted">Сегодня</div>
            <div className="font-semibold">{todayList.reduce((s, w) => s + w.durationMin, 0)} мин</div>
            <div className="text-xs text-muted">{todayList.reduce((s, w) => s + w.calories, 0)} ккал ≈</div>
          </div>
          <div>
            <div className="text-xs text-muted">7 дней</div>
            <div className="font-semibold">{weekList.reduce((s, w) => s + w.durationMin, 0)} мин</div>
            <div className="text-xs text-muted">{weekList.reduce((s, w) => s + w.calories, 0)} ккал ≈</div>
          </div>
        </div>
        <p className="mt-2 text-xs text-muted">
          Расход приблизительный и не вычитается из пищевой цели. Последний вес:{' '}
          {lastWeight ? `${lastWeight} кг` : 'не указан'}
          {settings?.weightGoalKg ? ` · цель ${settings.weightGoalKg} кг` : ''}.
        </p>
      </Card>
      <Button className="w-full" onClick={() => { setEditing(null); setOpen(true); }}>
        Добавить активность
      </Button>
      <Button variant="soft" className="w-full" onClick={() => setMetEdit(true)}>
        Изменить значения MET
      </Button>

      {workouts.length === 0 && (
        <EmptyState title="Нет тренировок" text="Записи создаются только вручную." />
      )}
      {workouts.map((w) => (
        <Card key={w.id}>
          <div className="font-semibold">{w.activityName}</div>
          <div className="text-sm text-muted">
            {w.date} · {w.durationMin} мин · {INTENSITY_LABELS[w.intensity]}
          </div>
          <div className="text-sm">
            {w.calories} ккал {w.caloriesManual ? '(вручную)' : '(приблизительно, MET)'}
          </div>
          {w.comment && <p className="text-sm">{w.comment}</p>}
          <div className="mt-2 flex gap-2">
            <Button variant="soft" onClick={() => { setEditing(w); setOpen(true); }}>
              Изменить
            </Button>
            <Button variant="danger" onClick={() => setRemoveId(w.id)}>
              Удалить
            </Button>
          </div>
        </Card>
      ))}

      <WorkoutForm
        open={open}
        workout={editing}
        lastWeight={lastWeight}
        overrides={overrides}
        onClose={() => setOpen(false)}
      />

      <Sheet open={metEdit} title="MET по активностям" onClose={() => setMetEdit(false)}>
        <p className="mb-3 text-sm text-muted">Эти значения используются только для приблизительного расчёта.</p>
        <div className="space-y-3">
          {ACTIVITY_PRESETS.map((a) => (
            <div key={a.id} className="rounded-2xl bg-white p-3">
              <div className="font-medium">{a.name}</div>
              {(['low', 'medium', 'high'] as Intensity[]).map((intensity) => {
                const ov = overrides.find((o) => o.activityId === a.id && o.intensity === intensity);
                return (
                  <label key={intensity} className="mt-1 flex items-center justify-between text-sm">
                    {INTENSITY_LABELS[intensity]}
                    <input
                      className="h-9 w-20 rounded-xl border border-line px-2"
                      defaultValue={ov?.met ?? a.met[intensity]}
                      onBlur={async (e) => {
                        const met = Number(e.target.value);
                        if (!met) return;
                        await db.metOverrides.put({
                          id: `${a.id}-${intensity}`,
                          activityId: a.id,
                          intensity,
                          met,
                        });
                      }}
                    />
                  </label>
                );
              })}
            </div>
          ))}
        </div>
      </Sheet>

      <Confirm
        open={!!removeId}
        title="Удалить тренировку?"
        text="Запись исчезнет из журнала."
        onCancel={() => setRemoveId(null)}
        onConfirm={async () => {
          if (removeId) await db.workouts.delete(removeId);
          setRemoveId(null);
        }}
      />
    </div>
  );
}

function WorkoutForm({
  open,
  workout,
  lastWeight,
  overrides,
  onClose,
}: {
  open: boolean;
  workout: Workout | null;
  lastWeight?: number;
  overrides: { activityId: string; intensity: Intensity; met: number }[];
  onClose: () => void;
}) {
  const [activityId, setActivityId] = useState(workout?.activityId ?? 'walking');
  const [date, setDate] = useState(workout?.date ?? todayIso());
  const [duration, setDuration] = useState(workout ? String(workout.durationMin) : '30');
  const [intensity, setIntensity] = useState<Intensity>(workout?.intensity ?? 'medium');
  const [manualKcal, setManualKcal] = useState(workout?.caloriesManual ? String(workout.calories) : '');
  const [comment, setComment] = useState(workout?.comment ?? '');
  const [weight, setWeight] = useState(lastWeight ? String(lastWeight) : '');

  useEffect(() => {
    if (!open) return;
    setActivityId(workout?.activityId ?? 'walking');
    setDate(workout?.date ?? todayIso());
    setDuration(workout ? String(workout.durationMin) : '30');
    setIntensity(workout?.intensity ?? 'medium');
    setManualKcal(workout?.caloriesManual ? String(workout.calories) : '');
    setComment(workout?.comment ?? '');
    setWeight(lastWeight ? String(lastWeight) : '');
  }, [open, workout, lastWeight]);

  const preset = ACTIVITY_PRESETS.find((a) => a.id === activityId) ?? ACTIVITY_PRESETS[0];
  const met = useMemo(() => {
    const ov = overrides.find((o) => o.activityId === activityId && o.intensity === intensity);
    return ov?.met ?? preset.met[intensity];
  }, [overrides, activityId, intensity, preset]);
  const estimated = estimateCalories(met, Number(weight) || 0, Number(duration) || 0);

  return (
    <Sheet open={open} title={workout ? 'Изменить активность' : 'Новая активность'} onClose={onClose}>
      <div className="space-y-3">
        <Field label="Вид">
          <select className={inputClass} value={activityId} onChange={(e) => setActivityId(e.target.value)}>
            {ACTIVITY_PRESETS.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Дата">
          <input className={inputClass} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Длительность, мин">
          <input className={inputClass} inputMode="numeric" value={duration} onChange={(e) => setDuration(e.target.value)} />
        </Field>
        <Field label="Интенсивность">
          <select className={inputClass} value={intensity} onChange={(e) => setIntensity(e.target.value as Intensity)}>
            {Object.entries(INTENSITY_LABELS).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Вес для расчёта, кг">
          <input className={inputClass} inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} />
        </Field>
        <p className="text-sm">
          MET {met} · оценка {estimated || '—'} ккал (приблизительно)
        </p>
        <Field label="Свой расход, ккал (необязательно)">
          <input className={inputClass} inputMode="numeric" value={manualKcal} onChange={(e) => setManualKcal(e.target.value)} />
        </Field>
        <Field label="Комментарий">
          <input className={inputClass} value={comment} onChange={(e) => setComment(e.target.value)} />
        </Field>
        {!Number(weight) && !manualKcal && (
          <p className="text-sm text-red-700">Укажите вес или введите расход вручную.</p>
        )}
        <Button
          className="w-full"
          onClick={async () => {
            const manual = Number(manualKcal);
            const calories = manual > 0 ? manual : estimated;
            if (!calories) return;
            const now = new Date().toISOString();
            const item: Workout = {
              id: workout?.id ?? createId(),
              date,
              activityId,
              activityName: preset.name,
              durationMin: Number(duration) || 0,
              intensity,
              met,
              calories,
              caloriesManual: manual > 0,
              comment: comment.trim() || undefined,
              createdAt: workout?.createdAt ?? now,
            };
            await db.workouts.put(item);
            onClose();
          }}
        >
          Сохранить
        </Button>
      </div>
    </Sheet>
  );
}
