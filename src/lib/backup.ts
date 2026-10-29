import { db } from '@/db/database';

export interface BackupPayload {
  version: 1;
  exportedAt: string;
  dishes: unknown[];
  dayPlans: unknown[];
  shopping: unknown[];
  weights: unknown[];
  vitamins: unknown[];
  vitaminLogs: unknown[];
  waterLogs: unknown[];
  workouts: unknown[];
  settings: unknown[];
  metOverrides: unknown[];
}

export async function createBackup(): Promise<BackupPayload> {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    dishes: await db.dishes.toArray(),
    dayPlans: await db.dayPlans.toArray(),
    shopping: await db.shopping.toArray(),
    weights: await db.weights.toArray(),
    vitamins: await db.vitamins.toArray(),
    vitaminLogs: await db.vitaminLogs.toArray(),
    waterLogs: await db.waterLogs.toArray(),
    workouts: await db.workouts.toArray(),
    settings: await db.settings.toArray(),
    metOverrides: await db.metOverrides.toArray(),
  };
}

export async function restoreBackup(payload: BackupPayload): Promise<void> {
  if (payload.version !== 1) {
    throw new Error('Неподдерживаемая версия резервной копии');
  }
  await db.transaction(
    'rw',
    [
      db.dishes,
      db.dayPlans,
      db.shopping,
      db.weights,
      db.vitamins,
      db.vitaminLogs,
      db.waterLogs,
      db.workouts,
      db.settings,
      db.metOverrides,
    ],
    async () => {
      await db.dishes.clear();
      await db.dayPlans.clear();
      await db.shopping.clear();
      await db.weights.clear();
      await db.vitamins.clear();
      await db.vitaminLogs.clear();
      await db.waterLogs.clear();
      await db.workouts.clear();
      await db.settings.clear();
      await db.metOverrides.clear();
      await db.dishes.bulkPut(payload.dishes as never);
      await db.dayPlans.bulkPut(payload.dayPlans as never);
      await db.shopping.bulkPut(payload.shopping as never);
      await db.weights.bulkPut(payload.weights as never);
      await db.vitamins.bulkPut(payload.vitamins as never);
      await db.vitaminLogs.bulkPut(payload.vitaminLogs as never);
      await db.waterLogs.bulkPut(payload.waterLogs as never);
      await db.workouts.bulkPut(payload.workouts as never);
      await db.settings.bulkPut(payload.settings as never);
      await db.metOverrides.bulkPut(payload.metOverrides as never);
    },
  );
}

export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
