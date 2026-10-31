import React from 'react';

type PillType = 'success' | 'danger' | 'warning' | 'info' | 'neutral' | 'disabled';

interface PillTagProps {
  label: string;
  type?: PillType;
  icon?: React.ComponentType<{ className?: string }>;
  dot?: boolean;
  className?: string;
}

const pillStyles: Record<PillType, { container: string; dot: string }> = {
  success: {
    container:
      'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/50',
    dot: 'bg-emerald-500 animate-pulse',
  },
  danger: {
    container:
      'bg-rose-50 text-rose-700 border-rose-200/80 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/50',
    dot: 'bg-rose-500 animate-ping',
  },
  warning: {
    container:
      'bg-amber-50 text-amber-700 border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/50',
    dot: 'bg-amber-500',
  },
  info: {
    container:
      'bg-blue-50 text-blue-700 border-blue-200/80 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800/50',
    dot: 'bg-blue-500',
  },
  neutral: {
    container:
      'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    dot: 'bg-slate-400',
  },
  disabled: {
    container:
      'bg-slate-100/80 text-slate-500 border-slate-200/60 dark:bg-slate-800/60 dark:text-slate-400 dark:border-slate-750',
    dot: 'bg-slate-400',
  },
};

export function PillTag({
  label,
  type = 'neutral',
  icon: Icon,
  dot = true,
  className = '',
}: PillTagProps) {
  const style = pillStyles[type] || pillStyles.neutral;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${style.container} ${className}`}
    >
      {dot && <span className={`size-1.5 rounded-full shrink-0 ${style.dot}`} />}
      {Icon && <Icon className="size-3.5" />}
      <span>{label}</span>
    </span>
  );
}

