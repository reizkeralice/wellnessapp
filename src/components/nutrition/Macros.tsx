import type { Nutrition } from '@/types';
import { formatKcal, formatMacro } from '@/lib/nutrition';

export function Macros({ n, compact = false }: { n: Nutrition; compact?: boolean }) {
  const items = [
    { label: 'ккал', value: formatKcal(n.calories).replace(' ккал', '') },
    { label: 'Б', value: formatMacro(n.protein).replace(' г', '') },
    { label: 'Ж', value: formatMacro(n.fat).replace(' г', '') },
    { label: 'У', value: formatMacro(n.carbs).replace(' г', '') },
  ];
  return (
    <div className={`grid grid-cols-4 gap-2 ${compact ? 'text-xs' : 'text-sm'}`}>
      {items.map((item) => (
        <div key={item.label} className="macro-tile rounded-2xl px-2 py-2 text-center">
          <div className="font-semibold">{item.value}</div>
          <div className="text-muted">{item.label}</div>
        </div>
      ))}
    </div>
  );
}
