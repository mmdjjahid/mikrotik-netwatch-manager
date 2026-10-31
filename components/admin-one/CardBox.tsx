import React from 'react';

interface CardBoxProps {
  children: React.ReactNode;
  className?: string;
  hasTable?: boolean;
}

export function CardBox({ children, className = '', hasTable = false }: CardBoxProps) {
  return (
    <div
      className={`rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs transition-shadow duration-200 ${
        hasTable ? 'overflow-hidden' : 'p-6'
      } ${className}`}
    >
      {children}
    </div>
  );
}

export function CardBoxHeader({
  title,
  icon: Icon,
  children,
  badge,
}: {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  children?: React.ReactNode;
  badge?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/80 px-6 py-4">
      <div className="flex items-center gap-2.5">
        {Icon && <Icon className="size-5 text-slate-500 dark:text-slate-400" />}
        <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base">{title}</h3>
        {badge}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}

export function CardBoxFooter({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex items-center justify-between border-t border-slate-100 dark:border-slate-800/80 px-6 py-4 bg-slate-50/50 dark:bg-slate-850/30 ${className}`}
    >
      {children}
    </div>
  );
}

