'use client';

import React from 'react';
import Link from 'next/link';
import { Menu, LogOut, ShieldCheck, ChevronRight } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';

interface CurrentUser {
  id: number;
  username: string;
  role: string;
}

interface NavBarProps {
  onOpenMobile: () => void;
  currentUser: CurrentUser | null;
  onLogout: () => void;
}

export function NavBar({
  onOpenMobile,
  currentUser,
  onLogout,
}: NavBarProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 px-4 sm:px-6 backdrop-blur-md">
      {/* Left: Mobile Menu button + Quick Indicator */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Open sidebar"
          onClick={onOpenMobile}
          className="inline-flex size-10 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 xl:hidden hover:bg-slate-50 dark:hover:bg-slate-800 transition"
        >
          <Menu className="size-5" />
        </button>

        <div className="hidden sm:flex items-center gap-2 text-xs font-medium text-slate-400">
          <Link
            href="/dashboard"
            className="hover:text-slate-900 dark:hover:text-white transition"
          >
            Netwatch
          </Link>
          <ChevronRight className="size-3.5" />
          <span className="text-slate-700 dark:text-slate-200 font-semibold">
            MikroTik Alert Center
          </span>
        </div>
      </div>

      {/* Right side items */}
      <div className="flex items-center gap-3">
        {/* Theme Toggle */}
        <ThemeToggle />

        {/* User Pill */}
        {currentUser && (
          <div className="flex items-center gap-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/60 px-3 py-1.5 shadow-2xs">
            <div className="flex size-7 items-center justify-center rounded-lg bg-blue-600 text-[11px] font-extrabold uppercase text-white shadow-2xs">
              {currentUser.username.slice(0, 2)}
            </div>
            <div className="hidden md:flex flex-col text-left">
              <span className="text-xs font-bold leading-none text-slate-800 dark:text-slate-100">
                {currentUser.username}
              </span>
              <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider mt-0.5">
                {currentUser.role}
              </span>
            </div>
          </div>
        )}

        {/* Logout */}
        <button
          onClick={onLogout}
          title="Sign Out"
          aria-label="Sign Out"
          className="inline-flex size-10 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-500 hover:bg-rose-50 hover:text-rose-600 dark:text-slate-400 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 transition"
        >
          <LogOut className="size-4.5" />
        </button>
      </div>
    </header>
  );
}

