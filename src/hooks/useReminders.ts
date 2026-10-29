import { useEffect } from 'react';
import { db, getSettings } from '@/db/database';
import { nowTime, todayIso } from '@/lib/dates';
import { buildDayTimes, showLocalNotification } from '@/lib/notifications';
import { getWaterRestrictionReminders, isWaterRestrictedAt } from '@/lib/mealReminders';
import { containsLactoseIngredient } from '@/lib/dishName';

export function useReminders(): void {
  useEffect(() => {
    let lastKey = '';
    const tick = async () => {
      const settings = await getSettings();
      const now = nowTime();
      const key = `${todayIso()}-${now}`;
      if (key === lastKey) return;
      lastKey = key;
      if (settings.waterMealRemindersEnabled) {
        for (const reminder of getWaterRestrictionReminders(settings)) {
          if (reminder.time !== now) continue;
          showLocalNotification(
            'Напоминание о воде',
            reminder.type === 'before'
              ? `До приёма ${reminder.meal} осталось 30 минут — соблюдайте ваш интервал без воды.`
              : `После приёма ${reminder.meal} прошёл 1 час — ваш интервал без воды завершён.`,
          );
        }
      }
      if (settings.waterRemindersEnabled) {
        const times = buildDayTimes(settings.wakeTime, settings.sleepTime, settings.waterReminderIntervalMin);
        if (times.includes(now) && !isWaterRestrictedAt(now, settings)) {
          showLocalNotification('Вода', 'Пора выпить воду. Запись не добавляется автоматически.');
        }
      }
      if (settings.vitaminRemindersEnabled) {
        const vitamins = await db.vitamins.toArray();
        const date = todayIso();
        const weekday = new Date().getDay();
        const plan = await db.dayPlans.get(date);
        for (const v of vitamins) {
          if (!v.remindersEnabled) continue;
          if (v.weekdays.length && !v.weekdays.includes(weekday)) continue;
          if (v.scheduleTimes.includes(now)) {
            if (v.condition === 'lactose') {
              const mealIndex = v.scheduleTimes.indexOf(now);
              const meal = (['breakfast', 'lunch', 'dinner'] as const)[mealIndex];
              const mealItems = meal && plan?.[meal];
              if (!mealItems?.some((item) =>
                containsLactoseIngredient(item.ingredients.map((ingredient) => ingredient.name)),
              )) continue;
            }
            const existing = await db.vitaminLogs.where('[vitaminId+date+time]').equals([v.id, date, now]).first();
            if (existing?.status === 'taken') continue;
            showLocalNotification(v.name, 'Напоминание о приёме. Отметьте вручную, если приняли.');
          }
        }
      }
    };
    const id = window.setInterval(tick, 30000);
    void tick();
    return () => window.clearInterval(id);
  }, []);
}
