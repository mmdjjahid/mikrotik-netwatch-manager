'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Router as RouterIcon,
  Send,
  Eye,
  FileSpreadsheet,
  ScrollText,
  Users,
  Settings,
  LogOut,
  X,
  Radio,
} from 'lucide-react';

interface CurrentUser {
  id: number;
  username: string;
  role: string;
}

interface AsideMenuProps {
  mobileOpen: boolean;
  onCloseMobile: () => void;
  currentUser: CurrentUser | null;
  onLogout: () => void;
}

interface NavGroup {
  label: string;
  items: Array<{
    href: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string;
  }>;
}

const navGroups: NavGroup[] = [
  {
    label: 'GENERAL',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: 'NETWORK & MONITORING',
    items: [
      { href: '/dashboard/netwatch', label: 'Netwatch', icon: Eye },
      { href: '/dashboard/routers', label: 'Routers', icon: RouterIcon },
      { href: '/dashboard/telegram', label: 'Telegram Alerts', icon: Send },
      { href: '/dashboard/import', label: 'Excel Import', icon: FileSpreadsheet },
    ],
  },
  {
    label: 'COMMERCIAL & SYSTEM',
    items: [
      { href: '/dashboard/logs', label: 'Audit Logs', icon: ScrollText },
      { href: '/dashboard/users', label: 'Users & Roles', icon: Users },
      { href: '/dashboard/settings', label: 'System Settings', icon: Settings },
    ],
  },
];

export function AsideMenu({
  mobileOpen,
  onCloseMobile,
  currentUser,
  onLogout,
}: AsideMenuProps) {
  const pathname = usePathname();

  const menuContent = (
    <div className="flex h-full flex-col justify-between bg-slate-900 text-slate-300">
      {/* Brand Header */}
      <div>
        <div className="flex h-16 items-center justify-between px-5 border-b border-slate-800/80 bg-slate-950/40">
          <Link
            href="/dashboard"
            onClick={onCloseMobile}
            className="flex items-center gap-2.5 font-bold tracking-tight text-white group"
          >
            <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-black text-sm shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
              <Radio className="size-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-base font-extrabold tracking-tight leading-none text-white">
                Netwatch
              </span>
              <span className="text-[10px] font-semibold text-blue-400 uppercase tracking-widest mt-0.5">
                Admin Suite
              </span>
            </div>
          </Link>

          <button
            type="button"
            aria-label="Close navigation sidebar"
            onClick={onCloseMobile}
            className="xl:hidden rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Navigation Sections */}
        <nav aria-label="Sidebar navigation" className="px-3 py-4 space-y-6 overflow-y-auto max-h-[calc(100vh-8rem)]">
          {navGroups.map((group) => (
            <div key={group.label} className="space-y-1">
              <div className="px-3 pb-1 text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                {group.label}
              </div>
              {group.items.map((item) => {
                const isActive =
                  item.href === '/dashboard'
                    ? pathname === '/dashboard'
                    : pathname.startsWith(item.href);
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onCloseMobile}
                    className={`group flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-blue-600 text-white font-semibold shadow-md shadow-blue-600/30'
                        : 'text-slate-400 hover:bg-slate-800/70 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon
                        className={`size-4.5 transition-transform group-hover:scale-110 ${
                          isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'
                        }`}
                      />
                      <span>{item.label}</span>
                    </div>
                    {item.badge && (
                      <span className="rounded-md bg-blue-500/20 px-1.5 py-0.5 text-[10px] font-bold text-blue-300">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </div>

      {/* Pinned Bottom User & Logout Panel */}
      <div className="border-t border-slate-800/80 bg-slate-950/50 p-3.5">
        {currentUser && (
          <div className="flex items-center justify-between rounded-xl bg-slate-800/60 p-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white text-xs font-bold uppercase shadow-xs">
                {currentUser.username.slice(0, 2)}
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-white">
                  {currentUser.username}
                </p>
                <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">
                  {currentUser.role}
                </p>
              </div>
            </div>

            <button
              onClick={onLogout}
              title="Sign Out"
              aria-label="Sign Out"
              className="flex size-8 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 transition"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Fixed Aside Menu */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-slate-800/80 xl:block">
        {menuContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 xl:hidden">
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          <aside className="fixed inset-y-0 left-0 w-64 shadow-2xl transition-transform animate-in slide-in-from-left">
            {menuContent}
          </aside>
        </div>
      )}
    </>
  );
}

