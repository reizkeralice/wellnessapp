import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { db, getSettings, saveSettings } from '@/db/database';
import { Button, Card, Confirm, EmptyState, Field, inputClass, Segmented, Sheet } from '@/components/ui/Ui';
import { createId } from '@/lib/ids';
import { todayIso, addDays, formatDate } from '@/lib/dates';
import { parseLocalizedDecimal } from '@/lib/numbers';
import type { WeightEntry } from '@/types';

type Range = '30' | '90' | '180' | '365' | 'all';

export function WeightPage() {
  const entries = useLiveQuery(() => db.weights.orderBy('date').toArray(), []) ?? [];
  const settings = useLiveQuery(() => getSettings(), []);
  const [range, setRange] = useState<Range>('90');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<WeightEntry | null>(null);
  const [kg, setKg] = useState('');
  const [date, setDate] = useState(todayIso());
  const [note, setNote] = useState('');
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [goal, setGoal] = useState('');
  const [goalError, setGoalError] = useState('');
  const [weightError, setWeightError] = useState('');

  const filtered = useMemo(() => {
    if (range === 'all') return entries;
    const from = addDays(todayIso(), -Number(range));
    return entries.filter((e) => e.date >= from);
  }, [entries, range]);

  const first = filtered[0];
  const last = filtered[filtered.length - 1];
  const delta = first && last && filtered.length >= 2 ? Math.round((last.kg - first.kg) * 10) / 10 : null;

  return (
    <div className="space-y-3">
      <Card>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-xs text-muted">Начальный</div>
            <div className="font-semibold">{first ? `${first.kg}` : '—'}</div>
          </div>
          <div>
            <div className="text-xs text-muted">Последний</div>
            <div className="font-semibold">{last ? `${last.kg}` : '—'}</div>
          </div>
          <div>
            <div className="text-xs text-muted">Разница</div>
            <div className="font-semibold">{delta === null ? 'мало данных' : `${delta > 0 ? '+' : ''}${delta}`}</div>
          </div>
        </div>
        {settings?.weightGoalKg ? (
          <p className="mt-3 text-sm text-muted">Цель: {settings.weightGoalKg} кг</p>
        ) : (
          <p className="mt-3 text-sm text-muted">Целевой вес не задан.</p>
        )}
      </Card>

      <Segmented
        value={range}
        onChange={setRange}
        options={[
          { id: '30', label: 'Месяц' },
          { id: '90', label: '3 мес' },
          { id: '180', label: '6 мес' },
          { id: '365', label: 'Год' },
          { id: 'all', label: 'Всё' },
        ]}
      />

      <Card>
        {filtered.length < 2 ? (
          <p className="text-sm text-muted">
            График появится после двух и более взвешиваний. Пропущенные дни не интерполируются.
          </p>
        ) : (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={filtered}>
                <XAxis dataKey="date" hide />
                <YAxis domain={['auto', 'auto']} width={36} />
                <Tooltip labelFormatter={(label) => formatDate(String(label))} />
                <Line type="monotone" dataKey="kg" stroke="#A77DAB" strokeWidth={2} dot={{ r: 3, fill: '#C4859B' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-2 gap-2 sm:flex">
        <input
          className={inputClass}
          placeholder="Цель, кг"
          inputMode="decimal"
          value={goal || (settings?.weightGoalKg ? String(settings.weightGoalKg) : '')}
          onChange={(e) => {
            setGoal(e.target.value);
            setGoalError('');
          }}
        />
        <Button
          onClick={async () => {
            const n = parseLocalizedDecimal(goal || String(settings?.weightGoalKg ?? ''));
            if (n === undefined || n <= 0) {
              setGoalError('Введите положительное число, например 62,5.');
              return;
            }
            await saveSettings({ weightGoalKg: n });
            setGoal(String(n));
            setGoalError('');
          }}
        >
          Цель
        </Button>
      </div>
      {goalError && <p className="text-sm text-red-700">{goalError}</p>}

      <Button className="w-full" onClick={() => {
        setEditing(null);
        setKg('');
        setDate(todayIso());
        setNote('');
        setWeightError('');
        setOpen(true);
      }}>
        Добавить вес
      </Button>

      {entries.length === 0 && (
        <EmptyState title="Нет измерений" text="Добавьте реальный вес. Фиктивные точки не создаются." />
      )}

      {entries
        .slice()
        .reverse()
        .map((e) => (
          <Card key={e.id}>
            <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="font-semibold">{e.kg} кг</div>
                <div className="text-sm text-muted">{formatDate(e.date)}</div>
                {e.note && <div className="text-sm">{e.note}</div>}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="soft"
                  onClick={() => {
                    setEditing(e);
                    setKg(String(e.kg));
                    setDate(e.date);
                    setNote(e.note ?? '');
                    setWeightError('');
                    setOpen(true);
                  }}
                >
                  Изменить
                </Button>
                <Button variant="danger" onClick={() => setRemoveId(e.id)}>
                  Удалить
                </Button>
              </div>
            </div>
          </Card>
        ))}

      <Sheet open={open} title={editing ? 'Изменить запись' : 'Новый вес'} onClose={() => setOpen(false)}>
        <div className="space-y-3">
          <Field label="Вес, кг">
            <input
              className={inputClass}
              inputMode="decimal"
              value={kg}
              onChange={(e) => {
                setKg(e.target.value);
                setWeightError('');
              }}
            />
          </Field>
          {weightError && <p className="text-sm text-red-700">{weightError}</p>}
          <Field label="Дата">
            <input className={inputClass} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Заметка">
            <input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <Button
            className="w-full"
            onClick={async () => {
              const value = parseLocalizedDecimal(kg);
              if (value === undefined || value <= 0) {
                setWeightError('Введите положительный вес, например 72,5.');
                return;
              }
              if (!date) {
                setWeightError('Укажите дату взвешивания.');
                return;
              }
              const now = new Date().toISOString();
              const entry: WeightEntry = {
                id: editing?.id ?? createId(),
                date,
                kg: value,
                note: note.trim() || undefined,
                createdAt: editing?.createdAt ?? now,
              };
              await db.weights.put(entry);
              setOpen(false);
              setWeightError('');
            }}
          >
            Сохранить
          </Button>
        </div>
      </Sheet>

      <Confirm
        open={!!removeId}
        title="Удалить измерение?"
        text="Запись будет удалена из истории. График пересчитается по оставшимся точкам."
        onCancel={() => setRemoveId(null)}
        onConfirm={async () => {
          if (removeId) await db.weights.delete(removeId);
          setRemoveId(null);
        }}
      />
    </div>
  );
}
