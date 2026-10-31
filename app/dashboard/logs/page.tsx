'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  ScrollText,
  Search,
  Download,
  Trash2,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { SectionTitleLineWithButton } from '@/components/admin-one/SectionTitleLineWithButton';
import { CardBox, CardBoxFooter } from '@/components/admin-one/CardBox';

interface LogItem {
  id: number;
  user: string;
  action: string;
  detail: string;
  ip_address: string;
  created_at: string;
}

export default function LogsPage() {
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/logs?page=${page}&pageSize=20&search=${encodeURIComponent(search)}`);
      const data = await res.json();
      setLogs(data.data || []);
      if (data.pagination) {
        setTotalPages(data.pagination.totalPages || 1);
        setTotal(data.pagination.total || 0);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleClearLogs = async () => {
    if (!confirm('Are you sure you want to clear all audit logs? This action cannot be undone.')) return;
    try {
      const res = await fetch('/api/logs/clear', { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to clear logs');
      setPage(1);
      fetchLogs();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Admin One Header */}
      <SectionTitleLineWithButton
        icon={ScrollText}
        title="System Audit Logs"
        subtitle="Complete immutable trail of all router actions, alerts, logins, and API commands"
      >
        <a
          href="/api/logs/export"
          download
          className="inline-flex size-10 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition shadow-2xs"
          title="Download CSV"
        >
          <Download className="size-4.5" />
        </a>
        <button
          onClick={handleClearLogs}
          className="inline-flex items-center gap-2 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/40 px-3.5 py-2.5 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/60 transition shadow-2xs"
        >
          <Trash2 className="size-4" />
          <span>Clear Logs</span>
        </button>
      </SectionTitleLineWithButton>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Filter by action, username, IP, or details..."
          className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 pl-10 pr-4 py-2.5 text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
        />
      </div>

      {/* Audit Log Table */}
      {loading ? (
        <CardBox className="flex h-48 items-center justify-center">
          <Loader2 className="size-8 animate-spin text-blue-600" />
        </CardBox>
      ) : logs.length === 0 ? (
        <CardBox className="text-center py-16 text-xs text-slate-400">
          No audit records found matching your query.
        </CardBox>
      ) : (
        <CardBox hasTable>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/70 dark:bg-slate-850/50 border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Timestamp
                  </th>
                  <th className="px-6 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Action
                  </th>
                  <th className="px-6 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    User
                  </th>
                  <th className="px-6 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Details
                  </th>
                  <th className="px-6 py-3.5 text-right text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Client IP
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors text-xs">
                    <td className="px-6 py-3.5 font-mono text-slate-500 dark:text-slate-400 shrink-0 whitespace-nowrap">
                      {log.created_at}
                    </td>
                    <td className="px-6 py-3.5">
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[11px]">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 font-semibold text-slate-700 dark:text-slate-300">
                      {log.user}
                    </td>
                    <td className="px-6 py-3.5 text-slate-600 dark:text-slate-300 max-w-md truncate">
                      {log.detail}
                    </td>
                    <td className="px-6 py-3.5 font-mono text-slate-400 text-right text-[11px]">
                      {log.ip_address}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Admin One Pagination Controls */}
          <CardBoxFooter>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Showing <span className="font-bold text-slate-800 dark:text-slate-100">{logs.length}</span> of{' '}
              <span className="font-bold text-slate-800 dark:text-slate-100">{total}</span> entries (Page{' '}
              <span className="font-bold text-slate-800 dark:text-slate-100">{page}</span> of {totalPages})
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="size-8 inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-40 transition"
              >
                <ChevronLeft className="size-4" />
              </button>
              <span className="px-2.5 py-1 text-xs font-bold text-slate-800 dark:text-slate-200 rounded-lg bg-slate-100 dark:bg-slate-800">
                {page}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="size-8 inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-40 transition"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          </CardBoxFooter>
        </CardBox>
      )}
    </div>
  );
}
