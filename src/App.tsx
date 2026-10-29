import { Component, lazy, Suspense, useEffect, useState, type ComponentType, type ErrorInfo, type ReactNode } from 'react';
import type { AppRoute } from '@/types';
import { AppShell } from '@/components/layout/AppShell';
import { Button, Card, Toast } from '@/components/ui/Ui';
import { useHashRoute } from '@/hooks/useHashRoute';
import { useReminders } from '@/hooks/useReminders';

const HomePage = lazy(() => import('@/pages/HomePage').then((module) => ({ default: module.HomePage })));
const DishesPage = lazy(() => import('@/pages/DishesPage').then((module) => ({ default: module.DishesPage })));
const PlannerPage = lazy(() => import('@/pages/PlannerPage').then((module) => ({ default: module.PlannerPage })));
const ShoppingPage = lazy(() => import('@/pages/ShoppingPage').then((module) => ({ default: module.ShoppingPage })));
const WeightPage = lazy(() => import('@/pages/WeightPage').then((module) => ({ default: module.WeightPage })));
const VitaminsPage = lazy(() => import('@/pages/VitaminsPage').then((module) => ({ default: module.VitaminsPage })));
const WaterPage = lazy(() => import('@/pages/WaterPage').then((module) => ({ default: module.WaterPage })));
const SportPage = lazy(() => import('@/pages/SportPage').then((module) => ({ default: module.SportPage })));
const SettingsPage = lazy(() => import('@/pages/SettingsPage').then((module) => ({ default: module.SettingsPage })));

const PAGE_COMPONENTS: Record<AppRoute, ComponentType> = {
  home: HomePage,
  dishes: DishesPage,
  planner: PlannerPage,
  shopping: ShoppingPage,
  weight: WeightPage,
  vitamins: VitaminsPage,
  water: WaterPage,
  sport: SportPage,
  settings: SettingsPage,
};

class PageLoadBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(error: Error, _info: ErrorInfo) {
    console.error('Не удалось загрузить раздел приложения.', error);
  }

  render() {
    if (this.state.failed) {
      return (
        <Card className="my-4 text-center">
          <p className="font-medium">Не удалось загрузить раздел</p>
          <p className="mt-1 text-sm text-muted">Проверьте интернет и попробуйте ещё раз.</p>
          <Button className="mt-3 w-full" onClick={() => window.location.reload()}>
            Повторить загрузку
          </Button>
        </Card>
      );
    }

    return this.props.children;
  }
}

function PageLoading() {
  return (
    <div className="flex min-h-40 items-center justify-center" role="status" aria-live="polite">
      <span className="text-sm text-muted">Загружаем раздел…</span>
    </div>
  );
}

export default function App() {
  const route = useHashRoute();
  const [error, setError] = useState<string | null>(null);
  useReminders();

  useEffect(() => {
    const onErr = (event: ErrorEvent) => setError(event.message);
    window.addEventListener('error', onErr);
    return () => window.removeEventListener('error', onErr);
  }, []);

  const Page = PAGE_COMPONENTS[route];

  return (
    <AppShell route={route}>
      <PageLoadBoundary key={route}>
        <Suspense fallback={<PageLoading />}>
          <Page />
        </Suspense>
      </PageLoadBoundary>
      <Toast message={error} />
    </AppShell>
  );
}
