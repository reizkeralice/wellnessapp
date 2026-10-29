import { type ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`luxe-card rounded-3xl p-4 ${className}`}>
      {children}
    </div>
  );
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  type = 'button',
  disabled,
  className = '',
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'ghost' | 'danger' | 'soft';
  type?: 'button' | 'submit';
  disabled?: boolean;
  className?: string;
}) {
  const styles = {
    primary: 'button-primary text-white',
    ghost: 'bg-transparent text-ink hover:bg-sand/80',
    danger: 'button-danger',
    soft: 'button-soft',
  }[variant];
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`min-h-11 rounded-2xl px-4 py-2.5 text-sm font-medium disabled:opacity-50 ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm text-muted">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  'luxe-input w-full min-h-11 rounded-2xl border px-3 py-2 outline-none';

export function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <Card className="text-center">
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted">{text}</p>
    </Card>
  );
}

export function Sheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);
  if (!open) return null;
  return (
    <div className="luxe-sheet-backdrop fixed inset-0 z-50 flex items-end justify-center">
      <button className="absolute inset-0" aria-label="Закрыть" onClick={onClose} />
      <div className="luxe-sheet relative max-h-[88vh] w-full max-w-lg overflow-auto rounded-t-3xl p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded-full p-2" aria-label="Закрыть">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Confirm({
  open,
  title,
  text,
  confirmLabel = 'Удалить',
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  text: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;
  return (
    <div className="luxe-sheet-backdrop fixed inset-0 z-50 flex items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mt-2 text-sm text-muted">{text}</p>
        <div className="mt-4 flex gap-2">
          <Button variant="soft" className="flex-1" onClick={onCancel}>
            Отмена
          </Button>
          <Button variant="danger" className="flex-1" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </Card>
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-1 overflow-x-auto rounded-2xl border border-line/70 bg-white/70 p-1 shadow-sm">
      {options.map((opt) => (
        <button
          key={opt.id}
          onClick={() => onChange(opt.id)}
          className={`min-h-9 shrink-0 rounded-xl px-3 text-sm ${
            value === opt.id
              ? 'button-primary text-white shadow-sm'
              : 'text-muted hover:bg-sand/70 hover:text-ink'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[calc(0.75rem+env(safe-area-inset-top))] z-50 flex justify-center px-4">
      <div className="rounded-2xl bg-ink px-4 py-2 text-sm text-white shadow-lg">{message}</div>
    </div>
  );
}
