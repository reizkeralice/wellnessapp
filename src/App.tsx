import { AppShell } from '@/components/layout/AppShell';
import { Toast } from '@/components/ui/Ui';
import { useHashRoute } from '@/hooks/useHashRoute';
import { useReminders } from '@/hooks/useReminders';
import { DishesPage } from '@/pages/DishesPage';
import { HomePage } from '@/pages/HomePage';
import { PlannerPage } from '@/pages/PlannerPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { ShoppingPage } from '@/pages/ShoppingPage';
import { SportPage } from '@/pages/SportPage';
import { VitaminsPage } from '@/pages/VitaminsPage';
import { WaterPage } from '@/pages/WaterPage';
import { WeightPage } from '@/pages/WeightPage';
import { useEffect, useState } from 'react';

export default function App() {
  const route = useHashRoute();
  const [error, setError] = useState<string | null>(null);
  useReminders();

  useEffect(() => {
    const onErr = (event: ErrorEvent) => setError(event.message);
    window.addEventListener('error', onErr);
    return () => window.removeEventListener('error', onErr);
  }, []);

  const page = {
    home: <HomePage />,
    dishes: <DishesPage />,
    planner: <PlannerPage />,
    shopping: <ShoppingPage />,
    weight: <WeightPage />,
    vitamins: <VitaminsPage />,
    water: <WaterPage />,
    sport: <SportPage />,
    settings: <SettingsPage />,
  }[route];

  return (
    <AppShell route={route}>
      {page}
      <Toast message={error} />
    </AppShell>
  );
}
