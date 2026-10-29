import { useEffect, useState } from 'react';
import type { AppRoute } from '@/types';

const ROUTES: AppRoute[] = [
  'home',
  'dishes',
  'planner',
  'shopping',
  'weight',
  'vitamins',
  'water',
  'sport',
  'settings',
];

function parse(): AppRoute {
  const hash = window.location.hash.replace('#/', '').replace('#', '');
  return ROUTES.includes(hash as AppRoute) ? (hash as AppRoute) : 'home';
}

export function navigate(route: AppRoute): void {
  window.location.hash = `/${route}`;
}

export function useHashRoute(): AppRoute {
  const [route, setRoute] = useState<AppRoute>(parse);
  useEffect(() => {
    const onChange = () => setRoute(parse());
    window.addEventListener('hashchange', onChange);
    if (!window.location.hash) window.location.hash = '/home';
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}
