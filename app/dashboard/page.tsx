'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  LayoutDashboard,
  Router as RouterIcon,
  Send,
  Eye,
  FileSpreadsheet,
  Plus,
  ArrowRight,
  Loader2,
  Radio,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { SectionTitleLineWithButton } from '@/components/admin-one/SectionTitleLineWithButton';
import { CardBoxWidget } from '@/components/admin-one/CardBoxWidget';
import { CardBox, CardBoxHeader } from '@/components/admin-one/CardBox';
import { PillTag } from '@/components/admin-one/PillTag';

interface Stats {
  routersCount: number;
  tokensCount: number;
  chatsCount: number;
  netwatchCount: number;
  recentLogs: Array<{
    id: number;
    user: string;
    action: string;
    detail: string;
    created_at: string;
  }>;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        const [routersRes, tokensRes, logsRes] = await Promise.all([
          fetch('/api/routers'),
          fetch('/api/tokens'),
          fetch('/api/logs?pageSize=6'),
        ]);

        const routersData = await routersRes.json();
        const tokensData = await tokensRes.json();
        const logsData = await logsRes.json();

        // Calculate total chats and netwatch entries across routers
        let chatsTotal = 0;
        let netwatchTotal = 0;

        if (Array.isArray(tokensData.data)) {
          chatsTotal = tokensData.data.reduce(
            (acc: number, t: { chats_count?: number }) => acc + (t.chats_count || 0),
            0
          );
        }

        const routersList = routersData.data || [];
        for (const r of routersList.slice(0, 5)) {
          try {
            const nwRes = await fetch(`/api/netwatch/${r.id}`);
            const nwData = await nwRes.json();
            if (Array.isArray(nwData.data)) {
              netwatchTotal += nwData.data.length;
            }
          } catch {
            // ignore router netwatch count failure
          }
        }

        setStats({
          routersCount: routersList.length,
          tokensCount: Array.isArray(tokensData.data) ? tokensData.data.length : 0,
          chatsCount: chatsTotal,
          netwatchCount: netwatchTotal,
          recentLogs: logsData.data || [],
        });
      } catch (err) {
        console.error('Failed to load dashboard stats:', err);
      } finally {
        setLoading(false);
      }
    }

    loadStats();
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="size-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Admin One Header */}
      <SectionTitleLineWithButton
        icon={LayoutDashboard}
        title="System Dashboard"
        subtitle="Live overview of your MikroTik network infrastructure & Telegram alert pipeline"
      >
        <Link
          href="/dashboard/routers"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-2xs transition"
        >
          <RouterIcon className="size-4 text-slate-500" />
          <span>Routers</span>
        </Link>
        <Link
          href="/dashboard/netwatch"
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-2.5 text-xs font-semibold text-white shadow-sm shadow-blue-500/20 transition"
        >
          <Plus className="size-4" />
          <span>Add Netwatch Host</span>
        </Link>
      </SectionTitleLineWithButton>

      {/* Admin One 4-Column KPI Widget Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <CardBoxWidget
          title="Connected Routers"
          value={stats?.routersCount || 0}
          subtitle="RouterOS API endpoints"
          icon={RouterIcon}
          color="blue"
          trend={{ text: 'Active', type: 'up' }}
        />
        <CardBoxWidget
          title="Monitored Netwatch"
          value={stats?.netwatchCount || 0}
          subtitle="Target IP addresses"
          icon={Eye}
          color="emerald"
          trend={{ text: 'Realtime', type: 'up' }}
        />
        <CardBoxWidget
          title="Telegram Bots"
          value={stats?.tokensCount || 0}
          subtitle="Configured bot tokens"
          icon={Send}
          color="indigo"
          trend={{ text: 'Ready', type: 'neutral' }}
        />
        <CardBoxWidget
          title="Alert Channels"
          value={stats?.chatsCount || 0}
          subtitle="Telegram chat destinations"
          icon={Radio}
          color="amber"
          trend={{ text: 'Instant Push', type: 'up' }}
        />
      </div>

      {/* Admin One 2-Column Split: Quick Launchpad & Recent Audit Activity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Quick Launchpad Card */}
        <CardBox className="p-0 overflow-hidden lg:col-span-1">
          <CardBoxHeader title="Quick Actions" icon={Plus} />
          <div className="p-5 space-y-3">
            <Link
              href="/dashboard/netwatch"
              className="flex items-center justify-between rounded-xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-800/40 p-3.5 hover:bg-blue-50/60 dark:hover:bg-slate-800 hover:border-blue-200 dark:hover:border-blue-900/50 transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 group-hover:scale-105 transition-transform">
                  <Eye className="size-4.5" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    Netwatch Manager
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Push host monitors & alerts
                  </div>
                </div>
              </div>
              <ArrowRight className="size-4 text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all" />
            </Link>

            <Link
              href="/dashboard/routers"
              className="flex items-center justify-between rounded-xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-800/40 p-3.5 hover:bg-blue-50/60 dark:hover:bg-slate-800 hover:border-blue-200 dark:hover:border-blue-900/50 transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 group-hover:scale-105 transition-transform">
                  <RouterIcon className="size-4.5" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    Router Connections
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Manage RouterOS API credentials
                  </div>
                </div>
              </div>
              <ArrowRight className="size-4 text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all" />
            </Link>

            <Link
              href="/dashboard/telegram"
              className="flex items-center justify-between rounded-xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-800/40 p-3.5 hover:bg-blue-50/60 dark:hover:bg-slate-800 hover:border-blue-200 dark:hover:border-blue-900/50 transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 group-hover:scale-105 transition-transform">
                  <Send className="size-4.5" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    Telegram Bot Settings
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Bot tokens & chat dispatchers
                  </div>
                </div>
              </div>
              <ArrowRight className="size-4 text-slate-400 group-hover:text-amber-600 dark:group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all" />
            </Link>

            <Link
              href="/dashboard/import"
              className="flex items-center justify-between rounded-xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-800/40 p-3.5 hover:bg-blue-50/60 dark:hover:bg-slate-800 hover:border-blue-200 dark:hover:border-blue-900/50 transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:scale-105 transition-transform">
                  <FileSpreadsheet className="size-4.5" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    Excel Batch Import
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Bulk push targets via spreadsheet
                  </div>
                </div>
              </div>
              <ArrowRight className="size-4 text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all" />
            </Link>
          </div>
        </CardBox>

        {/* Recent Audit Activity Feed */}
        <CardBox className="p-0 overflow-hidden lg:col-span-2">
          <CardBoxHeader
            title="Recent Activity"
            icon={Clock}
            badge={<PillTag label="Live Log" type="info" dot />}
          >
            <Link
              href="/dashboard/logs"
              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline"
            >
              <span>Full Audit Trail</span>
              <ExternalLink className="size-3" />
            </Link>
          </CardBoxHeader>

          {!stats?.recentLogs || stats.recentLogs.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              No audit entries recorded yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {stats.recentLogs.map((log) => (
                <div
                  key={log.id}
                  className="px-6 py-3.5 flex items-start justify-between gap-4 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
                        {log.action}
                      </span>
                      <span className="rounded-md bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:text-slate-400">
                        {log.user}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{log.detail}</p>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400 shrink-0 mt-0.5">
                    {new Date(log.created_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardBox>
      </div>
    </div>
  );
}
