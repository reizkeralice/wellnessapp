import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { db, getSettings, saveSettings } from '@/db/database';
import { Button, Card, Confirm, EmptyState, Field, inputClass } from '@/components/ui/Ui';
import { createId } from '@/lib/ids';
import { todayIso } from '@/lib/dates';
import { buildDayTimes, getNotificationSupport } from '@/lib/notifications';
import { getWaterRestrictionReminders } from '@/lib/mealReminders';
import type { WaterLog } from '@/types';

export function WaterPage() {
  const date = todayIso();
  const logs = useLiveQuery(() => db.waterLogs.where('date').equals(date).toArray(), [date]) ?? [];
  const history = useLiveQuery(() => db.waterLogs.orderBy('date').reverse().limit(80).toArray(), []) ?? [];
  const settings = useLiveQuery(() => getSettings(), []);
  const [custom, setCustom] = useState('');
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const total = logs.reduce((s, l) => s + l.ml, 0);
  const goal = settings?.waterGoalMl ?? 2000;
  const pct = Math.min(100, Math.round((total / goal) * 100));
  const times = settings
    ? buildDayTimes(settings.wakeTime, settings.sleepTime, settings.waterReminderIntervalMin)
    : [];
  const restrictionTimes = settings ? getWaterRestrictionReminders(settings) : [];

  async function add(ml: number) {
    if (busy || ml <= 0) return;
    setBusy(true);
    const log: WaterLog = { id: createId(), date, ml, createdAt: new Date().toISOString() };
    await db.waterLogs.add(log);
    setBusy(false);
  }

  const byDay = history.reduce<Record<string, number>>((acc, l) => {
    acc[l.date] = (acc[l.date] ?? 0) + l.ml;
    return acc;
  }, {});

  return (
    <div className="space-y-3">
      <Card className="text-center">
        <div className="text-sm text-muted">Сегодня</div>
        <div className="text-3xl font-semibold">{total} мл</div>
        <div className="text-sm text-muted">{pct}% от {goal} мл</div>
        <div className="mx-auto mt-4 h-3 w-full overflow-hidden rounded-full bg-white">
          <div className="h-full bg-sage" style={{ width: `${pct}%` }} />
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-2">
        {[150, 250, 500].map((ml) => (
          <Button key={ml} variant="soft" disabled={busy} onClick={() => add(ml)}>
            +{ml} мл
          </Button>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          className={inputClass}
          inputMode="numeric"
          placeholder="Свой объём"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
        />
        <Button
          disabled={busy}
          onClick={() => {
            const n = Number(custom);
            if (!n) return;
            add(n);
            setCustom('');
          }}
        >
          Добавить
        </Button>
      </div>
      <p className="text-xs text-muted">Вода не добавляется сама. Повторное нажатие создаёт новую запись только после завершения предыдущей.</p>

      {logs.length === 0 && <EmptyState title="Сегодня ещё нет записей" text="Нажмите быстрый объём или введите свой." />}
      {logs
        .slice()
        .reverse()
        .map((l) => (
          <Card key={l.id}>
            <div className="flex items-center justify-between">
              <div>
                {l.ml} мл
                <div className="text-xs text-muted">{new Date(l.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</div>
              </div>
              <Button variant="ghost" onClick={() => setRemoveId(l.id)}>
                Удалить
              </Button>
            </div>
          </Card>
        ))}

      <Card>
        <h2 className="mb-2 font-semibold">Цель и напоминания</h2>
        <Field label="Дневная цель, мл">
          <input
            className={inputClass}
            inputMode="numeric"
            defaultValue={goal}
            onBlur={async (e) => {
              const n = Number(e.target.value);
              if (n > 0) await saveSettings({ waterGoalMl: n });
            }}
          />
        </Field>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Field label="Пробуждение">
            <input
              className={inputClass}
              type="time"
              defaultValue={settings?.wakeTime ?? '07:00'}
              onBlur={(e) => saveSettings({ wakeTime: e.target.value })}
            />
          </Field>
          <Field label="Сон">
            <input
              className={inputClass}
              type="time"
              defaultValue={settings?.sleepTime ?? '23:00'}
              onBlur={(e) => saveSettings({ sleepTime: e.target.value })}
            />
          </Field>
        </div>
        <Field label="Интервал напоминаний, мин">
          <input
            className={inputClass}
            inputMode="numeric"
            defaultValue={settings?.waterReminderIntervalMin ?? 90}
            onBlur={(e) => saveSettings({ waterReminderIntervalMin: Number(e.target.value) || 90 })}
          />
        </Field>
        <label className="mt-2 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={settings?.waterRemindersEnabled ?? false}
            onChange={(e) => saveSettings({ waterRemindersEnabled: e.target.checked })}
          />
          Напоминания о воде
        </label>
        <div className="mt-4 border-t border-line pt-3">
          <label className="flex items-start gap-2 text-sm">
            <input
              className="mt-1 accent-sage"
              type="checkbox"
              checked={settings?.waterMealRemindersEnabled ?? false}
              onChange={(e) => saveSettings({ waterMealRemindersEnabled: e.target.checked })}
            />
            <span>Напоминать о моём интервале без воды вокруг еды</span>
          </label>
          <p className="mt-1 text-xs text-muted">
            Напоминания срабатывают за 30 минут до начала указанного времени еды и через час после его окончания.
            Обычные напоминания о воде в этот период приостанавливаются.
          </p>
          <div className="mt-3 space-y-3">
            <Field label="Завтрак">
              <input
                className={inputClass}
                type="time"
                value={settings?.breakfastTime ?? '07:30'}
                onChange={(e) => saveSettings({ breakfastTime: e.target.value })}
              />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Обед — с">
                <input
                  className={inputClass}
                  type="time"
                  value={settings?.lunchStartTime ?? '13:00'}
                  onChange={(e) => saveSettings({ lunchStartTime: e.target.value })}
                />
              </Field>
              <Field label="Обед — по">
                <input
                  className={inputClass}
                  type="time"
                  value={settings?.lunchEndTime ?? '14:00'}
                  onChange={(e) => saveSettings({ lunchEndTime: e.target.value })}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Ужин — с">
                <input
                  className={inputClass}
                  type="time"
                  value={settings?.dinnerStartTime ?? '19:00'}
                  onChange={(e) => saveSettings({ dinnerStartTime: e.target.value })}
                />
              </Field>
              <Field label="Ужин — по">
                <input
                  className={inputClass}
                  type="time"
                  value={settings?.dinnerEndTime ?? '20:00'}
                  onChange={(e) => saveSettings({ dinnerEndTime: e.target.value })}
                />
              </Field>
            </div>
          </div>
          <div className="mt-3 rounded-2xl bg-sand p-3 text-xs text-muted">
            {restrictionTimes.map((reminder) => (
              <div key={`${reminder.meal}-${reminder.type}`} className="flex justify-between gap-2 py-0.5">
                <span>
                  {reminder.type === 'before' ? `За 30 минут до ${reminder.meal}` : `Через час после ${reminder.meal}`}
                </span>
                <span className="shrink-0 font-medium text-ink">{reminder.time}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="mt-2 text-xs text-muted">{getNotificationSupport().message}</p>
        <div className="mt-2 text-xs text-muted">Расписание на сегодня: {times.join(', ') || 'нет'}</div>
      </Card>

      <Card>
        <h2 className="mb-2 font-semibold">История по дням</h2>
        {Object.keys(byDay).length === 0 && <p className="text-sm text-muted">Пока пусто.</p>}
        {Object.entries(byDay)
          .sort((a, b) => b[0].localeCompare(a[0]))
          .map(([d, ml]) => (
            <div key={d} className="flex justify-between py-1 text-sm">
              <span>{d}</span>
              <span>{ml} мл</span>
            </div>
          ))}
      </Card>

      <Confirm
        open={!!removeId}
        title="Удалить запись?"
        text="Объём будет вычтен из сегодняшнего прогресса."
        onCancel={() => setRemoveId(null)}
        onConfirm={async () => {
          if (removeId) await db.waterLogs.delete(removeId);
          setRemoveId(null);
        }}
      />
    </div>
  );
}
