import React from 'react';
import { LucideIcon } from 'lucide-react';

interface CardBoxWidgetProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  color?: 'blue' | 'emerald' | 'amber' | 'rose' | 'indigo' | 'purple' | 'cyan';
  trend?: {
    text: string;
    type?: 'up' | 'down' | 'neutral';
  };
}

const colorMap = {
  blue: {
    badge: 'bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400',
    border: 'border-blue-100 dark:border-blue-900/40',
  },
  emerald: {
    badge: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400',
    border: 'border-emerald-100 dark:border-emerald-900/40',
  },
  amber: {
    badge: 'bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400',
    border: 'border-amber-100 dark:border-amber-900/40',
  },
  rose: {
    badge: 'bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400',
    border: 'border-rose-100 dark:border-rose-900/40',
  },
  indigo: {
    badge: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400',
    border: 'border-indigo-100 dark:border-indigo-900/40',
  },
  purple: {
    badge: 'bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400',
    border: 'border-purple-100 dark:border-purple-900/40',
  },
  cyan: {
    badge: 'bg-cyan-50 text-cyan-600 dark:bg-cyan-950/50 dark:text-cyan-400',
    border: 'border-cyan-100 dark:border-cyan-900/40',
  },
};

export function CardBoxWidget({
  title,
  value,
  subtitle,
  icon: Icon,
  color = 'blue',
  trend,
}: CardBoxWidgetProps) {
  const styles = colorMap[color] || colorMap.blue;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs hover:shadow-md transition-all duration-200">
      <div className="flex items-start justify-between">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            {title}
          </span>
          <div className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            {value}
          </div>
        </div>
        <div
          className={`flex size-12 items-center justify-center rounded-2xl p-3 shadow-xs ${styles.badge}`}
        >
          <Icon className="size-6" />
        </div>
      </div>

      {(subtitle || trend) && (
        <div className="mt-4 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          {trend && (
            <span
              className={`inline-flex items-center px-1.5 py-0.5 rounded font-semibold text-[11px] ${
                trend.type === 'up'
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
                  : trend.type === 'down'
                  ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
              }`}
            >
              {trend.text}
            </span>
          )}
          {subtitle && <span>{subtitle}</span>}
        </div>
      )}
    </div>
  );
}

