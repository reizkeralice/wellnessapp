import type { ReactNode } from 'react';
import { CalendarDays, Home, MoreHorizontal, ShoppingBasket, UtensilsCrossed } from 'lucide-react';
import type { AppRoute } from '@/types';
import { navigate } from '@/hooks/useHashRoute';
import { Button, Sheet } from '@/components/ui/Ui';
import { useState } from 'react';
import { Activity, Bell, Droplets, Scale, Settings, Sparkles } from 'lucide-react';

const PRIMARY: { id: AppRoute; label: string; icon: typeof Home }[] = [
  { id: 'home', label: 'Главная', icon: Home },
  { id: 'dishes', label: 'Блюда', icon: UtensilsCrossed },
  { id: 'planner', label: 'Планнер', icon: CalendarDays },
  { id: 'shopping', label: 'Покупки', icon: ShoppingBasket },
];

const MORE: { id: AppRoute; label: string; icon: typeof Home }[] = [
  { id: 'weight', label: 'Вес', icon: Scale },
  { id: 'vitamins', label: 'Витамины', icon: Sparkles },
  { id: 'water', label: 'Вода', icon: Droplets },
  { id: 'sport', label: 'Спорт', icon: Activity },
  { id: 'settings', label: 'Настройки', icon: Settings },
];

const TITLES: Record<AppRoute, string> = {
  home: 'Сегодня',
  dishes: 'Блюда',
  planner: 'Планнер',
  shopping: 'Покупки',
  weight: 'Вес',
  vitamins: 'Витамины',
  water: 'Вода',
  sport: 'Спорт',
  settings: 'Настройки',
};

export function AppShell({ route, children }: { route: AppRoute; children: ReactNode }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = MORE.some((item) => item.id === route);

  return (
    <div className="luxe-shell mx-auto flex min-h-dvh w-full max-w-lg flex-col">
      <header className="luxe-header safe-top sticky top-0 z-20 px-4 pb-3 pt-3 backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <div>
            <div className="brand-eyebrow mb-0.5">ÉQUILIBRE <span className="text-[#c4859b]">·</span> WELLNESS</div>
            <h1 className="page-title text-[1.8rem] leading-tight">{TITLES[route]}</h1>
          </div>
          <button
            className="header-action rounded-full p-2.5 text-sage"
            onClick={() => navigate('settings')}
            aria-label="Настройки"
          >
            <Bell size={20} />
          </button>
        </div>
      </header>
      <main className="flex-1 px-4 pb-[calc(7rem+env(safe-area-inset-bottom))]">{children}</main>
      <nav className="luxe-nav safe-bottom fixed inset-x-0 bottom-0 z-30 mx-auto max-w-lg border-t px-2 pt-2 backdrop-blur-xl">
        <div className="grid grid-cols-5 gap-1">
          {PRIMARY.map((item) => {
            const Icon = item.icon;
            const active = route === item.id;
            return (
              <button
                key={item.id}
                onClick={() => navigate(item.id)}
                className={`flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-2xl text-[11px] ${
                  active ? 'nav-active font-medium' : 'text-muted'
                }`}
              >
                <Icon size={20} />
                {item.label}
              </button>
            );
          })}
          <button
            onClick={() => setMoreOpen(true)}
            className={`flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-2xl text-[11px] ${
              moreActive ? 'nav-active font-medium' : 'text-muted'
            }`}
          >
            <MoreHorizontal size={20} />
            Ещё
          </button>
        </div>
      </nav>
      <Sheet open={moreOpen} title="Разделы" onClose={() => setMoreOpen(false)}>
        <div className="grid gap-2">
          {MORE.map((item) => {
            const Icon = item.icon;
            return (
              <Button
                key={item.id}
                variant="soft"
                className="flex items-center justify-start gap-3"
                onClick={() => {
                  setMoreOpen(false);
                  navigate(item.id);
                }}
              >
                <Icon size={18} />
                {item.label}
              </Button>
            );
          })}
        </div>
      </Sheet>
    </div>
  );
}
