export type NotificationSupport = {
  available: boolean;
  permission: NotificationPermission | 'unsupported';
  installed: boolean;
  message: string;
};

export function getNotificationSupport(): NotificationSupport {
  const installed =
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));

  if (typeof window === 'undefined' || !('Notification' in window)) {
    return {
      available: false,
      permission: 'unsupported',
      installed,
      message:
        'Уведомления браузера недоступны. На iPhone установите приложение на экран «Домой» и используйте HTTPS.',
    };
  }

  const permission = Notification.permission;
  if (permission === 'denied') {
    return {
      available: false,
      permission,
      installed,
      message: 'Уведомления запрещены в настройках Safari. Разрешите их для этого сайта.',
    };
  }

  if (!installed) {
    return {
      available: permission === 'granted',
      permission,
      installed,
      message:
        'На iPhone фоновые уведомления работают надёжнее после установки на экран «Домой». Пока приложение открыто, напоминания показываются внутри него.',
    };
  }

  return {
    available: permission === 'granted',
    permission,
    installed,
    message:
      permission === 'granted'
        ? 'Уведомления разрешены. На iOS они могут приходить, пока приложение установлено на экран «Домой».'
        : 'Разрешение нужно запросить после вашего действия. Фоновые уведомления на iPhone ограничены.',
  };
}

export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.requestPermission();
}

export function showLocalNotification(title: string, body: string): void {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    new Notification(title, { body, icon: '/icons/icon-192.png' });
  } catch {
    // iOS may require service worker registration for some cases
  }
}

export function minutesBetween(fromHHmm: string, toHHmm: string): number {
  const [fh, fm] = fromHHmm.split(':').map(Number);
  const [th, tm] = toHHmm.split(':').map(Number);
  let start = (fh ?? 0) * 60 + (fm ?? 0);
  let end = (th ?? 0) * 60 + (tm ?? 0);
  if (end <= start) end += 24 * 60;
  return end - start;
}

export function buildDayTimes(wake: string, sleep: string, intervalMin: number): string[] {
  if (intervalMin <= 0) return [];
  const [wh, wm] = wake.split(':').map(Number);
  const start = (wh ?? 7) * 60 + (wm ?? 0);
  const span = minutesBetween(wake, sleep);
  const times: string[] = [];
  for (let t = start + intervalMin; t < start + span; t += intervalMin) {
    const mins = ((t % (24 * 60)) + 24 * 60) % (24 * 60);
    const h = String(Math.floor(mins / 60)).padStart(2, '0');
    const m = String(mins % 60).padStart(2, '0');
    times.push(`${h}:${m}`);
  }
  return times;
}
