import type { ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: number | string;
  icon?: ReactNode;
  hint?: string;
  tone?: 'primary' | 'blue' | 'emerald' | 'amber' | 'violet';
}

const TONES = {
  primary: 'bg-primary-50 text-primary-600',
  blue: 'bg-blue-50 text-blue-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  amber: 'bg-amber-50 text-amber-600',
  violet: 'bg-violet-50 text-violet-600',
};

export function StatCard({
  label,
  value,
  icon,
  hint,
  tone = 'primary',
}: StatCardProps) {
  return (
    <div className="card flex items-center gap-4 p-5">
      {icon && (
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${TONES[tone]}`}
        >
          {icon}
        </div>
      )}
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <p className="mt-0.5 text-2xl font-bold tracking-tight text-slate-900">
          {value}
        </p>
        {hint && <p className="mt-0.5 text-xs text-slate-400">{hint}</p>}
      </div>
    </div>
  );
}
