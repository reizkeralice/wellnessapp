import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import * as XLSX from 'xlsx';
import { db, getSettings, saveSettings } from '@/db/database';
import { Button, Card, Confirm, Field, inputClass, Sheet } from '@/components/ui/Ui';
import { createBackup, downloadJson, restoreBackup, type BackupPayload } from '@/lib/backup';
import {
  DISH_FIELD_LABELS,
  guessField,
  parseMappedRows,
  previewSheets,
  readWorkbook,
  sheetRows,
  snapshotFromDish,
  type DishField,
  type ImportMapping,
  type SheetPreview,
} from '@/lib/excel';
import { getOrCreateDayPlan, saveDayPlan } from '@/db/database';
import { getNotificationSupport, requestNotificationPermission } from '@/lib/notifications';
import type { MealCategory } from '@/types';

export function SettingsPage() {
  const settings = useLiveQuery(() => getSettings(), []);
  const [importOpen, setImportOpen] = useState(false);
  const [wipeOpen, setWipeOpen] = useState(false);
  const [message, setMessage] = useState('');

  async function patchNumber(key: 'calorieGoal' | 'proteinGoal' | 'fatGoal' | 'carbsGoal' | 'weightGoalKg' | 'waterGoalMl', value: string) {
    const n = Number(value);
    if (!n && key !== 'proteinGoal' && key !== 'fatGoal' && key !== 'carbsGoal' && key !== 'weightGoalKg') return;
    await saveSettings({ [key]: n || undefined });
  }

  return (
    <div className="space-y-3">
      <Card>
        <h2 className="mb-3 font-semibold">Цели</h2>
        <div className="space-y-2">
          <Field label="Калории, ккал">
            <input className={inputClass} defaultValue={settings?.calorieGoal} onBlur={(e) => patchNumber('calorieGoal', e.target.value)} />
          </Field>
          <Field label="Белки, г (необязательно)">
            <input className={inputClass} defaultValue={settings?.proteinGoal ?? ''} onBlur={(e) => patchNumber('proteinGoal', e.target.value)} />
          </Field>
          <Field label="Жиры, г">
            <input className={inputClass} defaultValue={settings?.fatGoal ?? ''} onBlur={(e) => patchNumber('fatGoal', e.target.value)} />
          </Field>
          <Field label="Углеводы, г">
            <input className={inputClass} defaultValue={settings?.carbsGoal ?? ''} onBlur={(e) => patchNumber('carbsGoal', e.target.value)} />
          </Field>
          <Field label="Целевой вес, кг">
            <input className={inputClass} defaultValue={settings?.weightGoalKg ?? ''} onBlur={(e) => patchNumber('weightGoalKg', e.target.value)} />
          </Field>
          <Field label="Вода, мл">
            <input className={inputClass} defaultValue={settings?.waterGoalMl} onBlur={(e) => patchNumber('waterGoalMl', e.target.value)} />
          </Field>
        </div>
        <p className="mt-2 text-xs text-muted">Цели не меняют исходные рецепты.</p>
      </Card>

      <Card>
        <h2 className="mb-2 font-semibold">Уведомления</h2>
        <p className="text-sm text-muted">{getNotificationSupport().message}</p>
        <Button
          className="mt-2 w-full"
          variant="soft"
          onClick={async () => {
            const perm = await requestNotificationPermission();
            setMessage(perm === 'granted' ? 'Разрешение получено' : 'Разрешение не выдано');
          }}
        >
          Запросить разрешение
        </Button>
      </Card>

      <Card>
        <h2 className="mb-2 font-semibold">Данные</h2>
        <div className="grid gap-2">
          <Button onClick={() => setImportOpen(true)}>Импортировать Excel</Button>
          <Button
            variant="soft"
            onClick={async () => {
              downloadJson(`nutrition-backup-${new Date().toISOString().slice(0, 10)}.json`, await createBackup());
            }}
          >
            Резервная копия
          </Button>
          <Button
            variant="soft"
            onClick={async () => {
              downloadJson(`nutrition-export-${new Date().toISOString().slice(0, 10)}.json`, await createBackup());
            }}
          >
            Экспорт данных
          </Button>
          <label className="block">
            <span className="mb-1 block text-sm text-muted">Восстановить из JSON</span>
            <input
              type="file"
              accept="application/json"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  const payload = JSON.parse(await file.text()) as BackupPayload;
                  await restoreBackup(payload);
                  setMessage('Данные восстановлены');
                } catch (err) {
                  setMessage(err instanceof Error ? err.message : 'Не удалось восстановить файл');
                }
              }}
            />
          </label>
          <Button variant="danger" onClick={() => setWipeOpen(true)}>
            Очистить все данные
          </Button>
        </div>
      </Card>

      {message && <p className="text-sm text-sage">{message}</p>}

      <ExcelImport open={importOpen} onClose={() => setImportOpen(false)} onDone={setMessage} />
      <Confirm
        open={wipeOpen}
        title="Удалить все данные?"
        text="Каталог, план, покупки, вес, витамины, вода и спорт будут стёрты с этого устройства."
        onCancel={() => setWipeOpen(false)}
        onConfirm={async () => {
          await db.delete();
          location.reload();
        }}
      />
    </div>
  );
}

function ExcelImport({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const [previews, setPreviews] = useState<SheetPreview[]>([]);
  const [wb, setWb] = useState<XLSX.WorkBook | null>(null);
  const [sheet, setSheet] = useState('');
  const [mapping, setMapping] = useState<ImportMapping>({});
  const [report, setReport] = useState('');
  const [error, setError] = useState('');

  function reset() {
    setPreviews([]);
    setWb(null);
    setSheet('');
    setMapping({});
    setReport('');
    setError('');
  }

  return (
    <Sheet
      open={open}
      title="Импорт Excel"
      onClose={() => {
        reset();
        onClose();
      }}
    >
      <div className="space-y-3">
        <p className="text-sm text-muted">
          Файл можно выбрать с iPhone. Колонки сопоставляются вручную — формат не предполагается заранее.
        </p>
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            try {
              const buf = await file.arrayBuffer();
              const book = readWorkbook(buf);
              const prev = previewSheets(book);
              setWb(book);
              setPreviews(prev);
              const first = prev[0];
              setSheet(first?.name ?? '');
              const map: ImportMapping = {};
              first?.headers.forEach((h) => {
                map[h] = guessField(h);
              });
              setMapping(map);
              setError('');
              setReport('');
            } catch {
              setError('Не удалось прочитать файл. Проверьте, что это XLSX.');
            }
          }}
        />
        {error && <p className="text-sm text-red-700">{error}</p>}
        {previews.length > 0 && (
          <>
            <Field label="Лист">
              <select
                className={inputClass}
                value={sheet}
                onChange={(e) => {
                  const name = e.target.value;
                  setSheet(name);
                  const prev = previews.find((p) => p.name === name);
                  const map: ImportMapping = {};
                  prev?.headers.forEach((h) => {
                    map[h] = guessField(h);
                  });
                  setMapping(map);
                }}
              >
                {previews.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name} ({p.totalRows})
                  </option>
                ))}
              </select>
            </Field>
            <div className="text-sm text-muted">Сопоставление колонок</div>
            {Object.keys(mapping).map((header) => (
              <Field key={header} label={header}>
                <select
                  className={inputClass}
                  value={mapping[header]}
                  onChange={(e) => setMapping({ ...mapping, [header]: e.target.value as DishField })}
                >
                  {(Object.keys(DISH_FIELD_LABELS) as DishField[]).map((f) => (
                    <option key={f} value={f}>
                      {DISH_FIELD_LABELS[f]}
                    </option>
                  ))}
                </select>
              </Field>
            ))}
            <div className="overflow-x-auto rounded-2xl bg-white p-2 text-xs">
              <div className="mb-1 text-muted">Предпросмотр</div>
              {previews
                .find((p) => p.name === sheet)
                ?.rows.slice(0, 5)
                .map((row, i) => (
                  <div key={i} className="border-b border-line py-1">
                    {Object.values(row).slice(0, 4).join(' · ')}
                  </div>
                ))}
            </div>
            <Button
              className="w-full"
              onClick={async () => {
                if (!wb) return;
                if (!Object.values(mapping).includes('name')) {
                  setError('Сопоставьте колонку с названием блюда');
                  return;
                }
                const rows = sheetRows(wb, sheet);
                const parsed = parseMappedRows(rows, mapping);
                const existing = await db.dishes.toArray();
                const byKey = new Map(existing.map((d) => [d.importKey ?? d.name.toLowerCase(), d]));
                let added = 0;
                let updated = 0;
                for (const dish of parsed.dishes) {
                  const found = byKey.get(dish.importKey ?? dish.name.toLowerCase());
                  if (found) {
                    await db.dishes.put({
                      ...found,
                      ingredients: dish.ingredients.length ? dish.ingredients : found.ingredients,
                      nutrition:
                        dish.nutrition.calories || dish.nutrition.protein
                          ? dish.nutrition
                          : found.nutrition,
                      instructions: dish.instructions ?? found.instructions,
                      cookTimeMinutes: dish.cookTimeMinutes ?? found.cookTimeMinutes,
                      updatedAt: new Date().toISOString(),
                    });
                    updated += 1;
                    byKey.set(found.importKey ?? found.name.toLowerCase(), found);
                  } else {
                    await db.dishes.put(dish);
                    byKey.set(dish.importKey ?? dish.name.toLowerCase(), dish);
                    added += 1;
                  }
                }
                let planItems = 0;
                for (const p of parsed.plans) {
                  const dish = byKey.get(p.dishImportKey);
                  if (!dish) continue;
                  const day = await getOrCreateDayPlan(p.date);
                  const meal = p.meal as MealCategory;
                  const already = day[meal].some((x) => x.dishId === dish.id && x.name === dish.name);
                  if (already) continue;
                  day[meal] = [...day[meal], snapshotFromDish(dish, meal)];
                  await saveDayPlan(day);
                  planItems += 1;
                }
                setReport(
                  `Готово: новых блюд ${added}, обновлено ${updated}, пустых строк пропущено ${parsed.skippedEmpty}, строки с неподдерживаемой категорией пропущено ${parsed.skippedUnsupportedCategory}, добавлено в план ${planItems}. ${parsed.errors.slice(0, 5).join('; ')}`,
                );
                onDone('Импорт завершён');
              }}
            >
              Подтвердить импорт этого листа
            </Button>
            <Button
              variant="soft"
              className="w-full"
              onClick={() => {
                reset();
                onClose();
              }}
            >
              Отменить
            </Button>
            {report && <p className="text-sm">{report}</p>}
          </>
        )}
      </div>
    </Sheet>
  );
}
