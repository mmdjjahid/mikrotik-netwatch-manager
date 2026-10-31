'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Eye,
  Plus,
  RefreshCw,
  Power,
  Trash2,
  Edit,
  Code2,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Loader2,
  Router as RouterIcon,
  X,
  Copy,
  Check,
  Search,
  Terminal,
  Wifi,
  WifiOff,
  Sparkles,
} from 'lucide-react';
import { SectionTitleLineWithButton } from '@/components/admin-one/SectionTitleLineWithButton';
import { CardBox, CardBoxHeader } from '@/components/admin-one/CardBox';
import { PillTag } from '@/components/admin-one/PillTag';

interface RouterItem {
  id: number;
  name: string;
  host: string;
}

interface TokenItem {
  id: number;
  label: string;
  bot_username: string;
}

interface ChatItem {
  id: number;
  token_id: number;
  label: string;
  chat_id: string;
}

interface NetwatchRecord {
  id: number;
  router_id: number;
  item_id: string;
  host: string;
  name: string;
  token_id: number | null;
  chat_ids: string;
  enabled: number;
  interval: string;
  token_label?: string;
  bot_username?: string;
  status?: 'up' | 'down' | 'unknown' | 'offline';
  since?: string;
  done_tests?: number;
  failed_tests?: number;
  type?: string;
  comment?: string;
  up_script?: string;
  down_script?: string;
  router_online?: boolean;
}

export default function NetwatchPage() {
  const [routers, setRouters] = useState<RouterItem[]>([]);
  const [selectedRouterId, setSelectedRouterId] = useState<number | null>(null);

  const [tokens, setTokens] = useState<TokenItem[]>([]);
  const [availableChats, setAvailableChats] = useState<ChatItem[]>([]);

  const [entries, setEntries] = useState<NetwatchRecord[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [routerOnline, setRouterOnline] = useState<boolean>(true);
  const [routerError, setRouterError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [fixingScripts, setFixingScripts] = useState(false);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'up' | 'down' | 'disabled'>('all');

  // Form Modal (Add / Edit)
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<NetwatchRecord | null>(null);
  const [formHost, setFormHost] = useState('');
  const [formName, setFormName] = useState('');
  const [formTokenId, setFormTokenId] = useState<number | null>(null);
  const [selectedChats, setSelectedChats] = useState<string[]>([]);
  const [formInterval, setFormInterval] = useState('00:00:10');
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Script Preview Modal (from form)
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewScripts, setPreviewScripts] = useState<{ upScript?: string; downScript?: string; comment?: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Live Script Viewer Modal (from router row)
  const [viewingScriptEntry, setViewingScriptEntry] = useState<NetwatchRecord | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Load Routers and Tokens
  useEffect(() => {
    async function init() {
      try {
        const [rRes, tRes] = await Promise.all([fetch('/api/routers'), fetch('/api/tokens')]);
        const rData = await rRes.json();
        const tData = await tRes.json();

        const rList = rData.data || [];
        setRouters(rList);
        if (rList.length > 0) setSelectedRouterId(rList[0].id);

        const tList = tData.data || [];
        setTokens(tList);
      } catch (err) {
        console.error('Failed to initialize routers or tokens:', err);
      }
    }
    init();
  }, []);

  // Load chats whenever the selected token in the form changes
  useEffect(() => {
    if (!formTokenId) {
      setAvailableChats([]);
      return;
    }
    fetch(`/api/tokens/${formTokenId}/chats`)
      .then((res) => res.json())
      .then((data) => {
        setAvailableChats(data.data || []);
      })
      .catch(() => setAvailableChats([]));
  }, [formTokenId]);

  // Load Netwatch entries for selected router
  const fetchEntries = useCallback(async (rId: number) => {
    setLoadingEntries(true);
    setSyncMessage(null);
    try {
      const res = await fetch(`/api/netwatch/${rId}`);
      const data = await res.json();
      setEntries(data.data || []);
      setRouterOnline(data.router_online !== false);
      setRouterError(data.router_error || null);
    } catch (err) {
      console.error(err);
      setRouterOnline(false);
      setRouterError((err as Error).message);
    } finally {
      setLoadingEntries(false);
    }
  }, []);

  useEffect(() => {
    if (selectedRouterId) {
      fetchEntries(selectedRouterId);
    } else {
      setEntries([]);
    }
  }, [selectedRouterId, fetchEntries]);

  // Sync with Router
  const handleSync = async () => {
    if (!selectedRouterId) return;
    setSyncing(true);
    setSyncMessage(null);
    try {
      const res = await fetch(`/api/netwatch/${selectedRouterId}/sync`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sync failed');
      setSyncMessage(data.message);
      setRouterOnline(true);
      setRouterError(null);
      if (Array.isArray(data.data)) {
        setEntries(data.data);
      } else {
        fetchEntries(selectedRouterId);
      }
    } catch (err) {
      alert((err as Error).message);
      setRouterOnline(false);
      setRouterError((err as Error).message);
    } finally {
      setSyncing(false);
    }
  };

  // Re-push alert scripts with clean emoji encoding
  const handleFixScripts = async () => {
    if (!selectedRouterId) return;
    if (!confirm('Re-push alert scripts for all Netwatch items on this router with verified Telegram Bot and clean emoji encoding?')) return;
    setFixingScripts(true);
    setSyncMessage(null);
    try {
      const res = await fetch(`/api/netwatch/${selectedRouterId}/fix-scripts`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update scripts');
      setSyncMessage(data.message);
      fetchEntries(selectedRouterId);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setFixingScripts(false);
    }
  };

  // Toggle Netwatch Enable/Disable
  const handleToggle = async (entry: NetwatchRecord) => {
    if (!selectedRouterId) return;
    try {
      const res = await fetch(`/api/netwatch/${selectedRouterId}/${entry.item_id || entry.id}/toggle`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Toggle failed');
      fetchEntries(selectedRouterId);
    } catch (err) {
      alert((err as Error).message);
    }
  };

  // Delete Netwatch entry
  const handleDelete = async (entry: NetwatchRecord) => {
    if (!selectedRouterId) return;
    if (!confirm(`Remove Netwatch entry for ${entry.name} (${entry.host}) from router?`)) return;

    try {
      const res = await fetch(`/api/netwatch/${selectedRouterId}/${entry.item_id || entry.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Delete failed');
      fetchEntries(selectedRouterId);
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const openAddModal = () => {
    setEditingEntry(null);
    setFormHost('');
    setFormName('');
    setFormTokenId(tokens.length > 0 ? tokens[0].id : null);
    setSelectedChats([]);
    setFormInterval('00:00:10');
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (entry: NetwatchRecord) => {
    setEditingEntry(entry);
    setFormHost(entry.host);
    setFormName(entry.name);
    setFormTokenId(entry.token_id || (tokens.length > 0 ? tokens[0].id : null));
    setSelectedChats(entry.chat_ids ? entry.chat_ids.split(',').filter(Boolean) : []);
    setFormInterval(entry.interval || '00:00:10');
    setFormError(null);
    setModalOpen(true);
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handlePreview = async () => {
    if (!selectedRouterId || !formHost || !formName) {
      alert('Please fill in Host IP and Name first.');
      return;
    }
    setPreviewLoading(true);
    try {
      const res = await fetch(`/api/netwatch/${selectedRouterId}/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: formHost,
          name: formName,
          token_id: formTokenId,
          chat_ids: selectedChats,
          interval: formInterval,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Preview failed');
      setPreviewScripts(data);
      setPreviewOpen(true);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleSaveEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRouterId) return;

    setFormLoading(true);
    setFormError(null);

    try {
      const url = editingEntry
        ? `/api/netwatch/${selectedRouterId}/${editingEntry.item_id || editingEntry.id}`
        : `/api/netwatch/${selectedRouterId}`;
      const method = editingEntry ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: formHost,
          name: formName,
          token_id: formTokenId || null,
          chat_ids: selectedChats,
          interval: formInterval,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to push Netwatch to router');

      setModalOpen(false);
      fetchEntries(selectedRouterId);
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setFormLoading(false);
    }
  };

  // Filter entries
  const filteredEntries = entries.filter((entry) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      entry.host.toLowerCase().includes(q) ||
      entry.name.toLowerCase().includes(q) ||
      (entry.bot_username && entry.bot_username.toLowerCase().includes(q)) ||
      (entry.comment && entry.comment.toLowerCase().includes(q));

    if (!matchesSearch) return false;

    if (statusFilter === 'up') return entry.enabled === 1 && entry.status === 'up';
    if (statusFilter === 'down') return entry.enabled === 1 && entry.status === 'down';
    if (statusFilter === 'disabled') return entry.enabled === 0;

    return true;
  });

  return (
    <div className="space-y-6">
      {/* Admin One Section Title Header */}
      <SectionTitleLineWithButton
        icon={Eye}
        title="Netwatch Manager"
        subtitle="Monitor network targets and automatically push Telegram alert scripts directly to MikroTik RouterOS"
      >
        <button
          onClick={handleFixScripts}
          disabled={fixingScripts || !selectedRouterId}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition disabled:opacity-50 shadow-2xs"
          title="Re-push all Netwatch alert scripts on this router with clean emojis"
        >
          <Sparkles className={`size-3.5 ${fixingScripts ? 'animate-spin text-blue-600' : 'text-amber-500'}`} />
          <span className="hidden sm:inline">{fixingScripts ? 'Updating...' : 'Update Alert Scripts'}</span>
        </button>

        <button
          onClick={handleSync}
          disabled={syncing || !selectedRouterId}
          className="inline-flex size-10 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition disabled:opacity-50 shadow-2xs"
          title="Sync with RouterOS"
        >
          <RefreshCw className={`size-4 ${syncing ? 'animate-spin text-blue-600' : ''}`} />
        </button>

        <button
          onClick={openAddModal}
          disabled={!selectedRouterId}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-2.5 text-xs font-semibold text-white shadow-sm shadow-blue-500/20 transition disabled:opacity-50"
        >
          <Plus className="size-4" />
          <span>Add to Router</span>
        </button>
      </SectionTitleLineWithButton>

      {/* Admin One Active Router Selector Bar */}
      <CardBox className="p-4 sm:p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              <RouterIcon className="size-4 text-blue-600 dark:text-blue-400" />
              <span>Target Router:</span>
            </div>
            <select
              value={selectedRouterId || ''}
              onChange={(e) => setSelectedRouterId(Number(e.target.value))}
              className="w-full sm:w-80 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
            >
              {routers.length === 0 && <option value="">No routers configured</option>}
              {routers.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.host})
                </option>
              ))}
            </select>
          </div>

          {/* Router Live Status Tag */}
          <div className="flex items-center gap-3">
            {routerOnline ? (
              <PillTag
                label={`MikroTik Online (${entries.length} hosts)`}
                type="success"
                icon={Wifi}
                dot
              />
            ) : (
              <PillTag
                label="Router Offline (Cached)"
                type="warning"
                icon={WifiOff}
                dot
              />
            )}

            {syncMessage && (
              <span className="hidden sm:inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                <CheckCircle2 className="size-3.5" />
                <span>{syncMessage}</span>
              </span>
            )}
          </div>
        </div>
      </CardBox>

      {/* Router Offline Alert */}
      {routerError && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-900 dark:text-amber-200">
          <AlertTriangle className="size-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
          <div className="space-y-1">
            <p className="font-bold">Router Communication Warning</p>
            <p className="opacity-90">{routerError}</p>
          </div>
        </div>
      )}

      {/* Search and Filters Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search Host IP, Name, or Bot..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 pl-10 pr-4 py-2.5 text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
          />
        </div>

        {/* Status Filter Pills */}
        <div className="flex items-center gap-1.5 self-start sm:self-auto overflow-x-auto pb-1 sm:pb-0">
          {(
            [
              { key: 'all', label: `All (${entries.length})` },
              { key: 'up', label: `UP (${entries.filter((e) => e.enabled === 1 && e.status === 'up').length})` },
              { key: 'down', label: `DOWN (${entries.filter((e) => e.enabled === 1 && e.status === 'down').length})` },
              { key: 'disabled', label: `Disabled (${entries.filter((e) => e.enabled === 0).length})` },
            ] as const
          ).map((filter) => (
            <button
              key={filter.key}
              type="button"
              onClick={() => setStatusFilter(filter.key)}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition ${
                statusFilter === filter.key
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Admin One CardBox Netwatch Table */}
      {loadingEntries ? (
        <CardBox className="flex h-56 items-center justify-center">
          <div className="flex flex-col items-center gap-2 text-slate-400">
            <Loader2 className="size-8 animate-spin text-blue-600" />
            <span className="text-xs font-semibold uppercase tracking-wider">Syncing with MikroTik...</span>
          </div>
        </CardBox>
      ) : filteredEntries.length === 0 ? (
        <CardBox className="text-center py-16 space-y-3">
          <Eye className="mx-auto size-12 text-slate-300 dark:text-slate-700" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
            {searchQuery || statusFilter !== 'all' ? 'No matching Netwatch hosts' : 'No Netwatch entries found'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            {searchQuery || statusFilter !== 'all'
              ? 'Try modifying your search keywords or filter status.'
              : 'Add target hosts to monitor with automated Telegram alerts.'}
          </p>
          <button
            onClick={openAddModal}
            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-2 text-xs font-semibold text-white shadow-sm transition"
          >
            <Plus className="size-4" />
            <span>Add First Host</span>
          </button>
        </CardBox>
      ) : (
        <CardBox hasTable>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/70 dark:bg-slate-850/50 border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Status & Power
                  </th>
                  <th className="px-6 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Host IP
                  </th>
                  <th className="px-6 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Host Name / Comment
                  </th>
                  <th className="px-6 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Interval & Tests
                  </th>
                  <th className="px-6 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Telegram Bot
                  </th>
                  <th className="px-6 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Alert Chats
                  </th>
                  <th className="px-6 py-3.5 text-right text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {filteredEntries.map((entry) => {
                  const isUp = entry.status === 'up';
                  const isDown = entry.status === 'down';
                  const isDisabled = entry.enabled === 0;

                  return (
                    <tr
                      key={entry.id || entry.item_id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Status & Power Switch */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => handleToggle(entry)}
                            title={entry.enabled ? 'Click to Disable on MikroTik' : 'Click to Enable on MikroTik'}
                            className={`size-8 rounded-lg border flex items-center justify-center transition ${
                              entry.enabled
                                ? 'border-emerald-500/30 bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 hover:bg-emerald-100/50'
                                : 'border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-600'
                            }`}
                          >
                            <Power className="size-4" />
                          </button>

                          <div>
                            {isDisabled ? (
                              <PillTag label="DISABLED" type="disabled" dot={false} />
                            ) : isUp ? (
                              <PillTag label="UP" type="success" dot />
                            ) : isDown ? (
                              <PillTag label="DOWN" type="danger" dot />
                            ) : (
                              <PillTag label={entry.status ? entry.status.toUpperCase() : 'UNKNOWN'} type="warning" dot />
                            )}

                            {entry.since && (
                              <div className="mt-1 text-[11px] font-mono text-slate-400">
                                Since: {entry.since}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Host IP & Type */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-900 dark:text-white">
                            {entry.host}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopy(entry.host, `host-${entry.id}`)}
                            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition p-0.5"
                            title="Copy Host IP"
                          >
                            {copiedKey === `host-${entry.id}` ? (
                              <Check className="size-3.5 text-emerald-500" />
                            ) : (
                              <Copy className="size-3.5" />
                            )}
                          </button>
                        </div>
                        <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider mt-0.5">
                          {entry.type || 'simple'}
                        </div>
                      </td>

                      {/* Host Name / Comment */}
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-800 dark:text-slate-100">
                          {entry.name}
                        </div>
                        {entry.comment && entry.comment !== `TG|${entry.name}` && entry.comment !== entry.name && (
                          <div className="text-xs text-slate-400 font-mono mt-0.5">
                            {entry.comment}
                          </div>
                        )}
                      </td>

                      {/* Interval & Tests */}
                      <td className="px-6 py-4">
                        <div className="font-mono text-xs text-slate-700 dark:text-slate-300 font-semibold">
                          {entry.interval || '00:00:10'}
                        </div>
                        {entry.done_tests !== undefined && (
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            <span className="text-emerald-600 dark:text-emerald-400 font-mono font-semibold">
                              {entry.done_tests} ok
                            </span>{' '}
                            / <span className="text-rose-600 dark:text-rose-400 font-mono font-semibold">{entry.failed_tests || 0} fail</span>
                          </div>
                        )}
                      </td>

                      {/* Telegram Bot */}
                      <td className="px-6 py-4 text-xs">
                        {entry.token_label || entry.bot_username ? (
                          <div>
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                              {entry.token_label || 'Bot Active'}
                            </span>
                            {entry.bot_username && (
                              <span className="block text-[11px] text-blue-600 dark:text-blue-400 font-mono mt-0.5">
                                @{entry.bot_username}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center rounded-lg bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                            No Bot Assigned
                          </span>
                        )}
                      </td>

                      {/* Alert Chats */}
                      <td className="px-6 py-4 text-xs font-mono">
                        {entry.chat_ids ? (
                          <span className="inline-flex items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                            {entry.chat_ids.split(',').length} chat(s)
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">Unassigned</span>
                        )}
                      </td>

                      {/* Admin One Action Buttons */}
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* View Router Scripts */}
                          <button
                            type="button"
                            onClick={() => setViewingScriptEntry(entry)}
                            title="View RouterOS Scripts"
                            aria-label={`View scripts for ${entry.name}`}
                            className="size-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-blue-600 hover:border-blue-200 dark:hover:text-blue-400 transition"
                          >
                            <Code2 className="size-4" />
                          </button>

                          {/* Edit Netwatch */}
                          <button
                            type="button"
                            onClick={() => openEditModal(entry)}
                            title="Edit Netwatch Entry"
                            aria-label={`Edit ${entry.name}`}
                            className="size-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-amber-600 hover:border-amber-200 dark:hover:text-amber-400 transition"
                          >
                            <Edit className="size-4" />
                          </button>

                          {/* Delete Netwatch */}
                          <button
                            type="button"
                            onClick={() => handleDelete(entry)}
                            title="Delete Netwatch from MikroTik"
                            aria-label={`Delete ${entry.name}`}
                            className="size-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-rose-600 hover:border-rose-200 dark:hover:text-rose-400 transition"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardBox>
      )}

      {/* Live Router Script Viewer Modal */}
      {viewingScriptEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Terminal className="size-5 text-blue-600 dark:text-blue-400" />
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  MikroTik Scripts — {viewingScriptEntry.name} ({viewingScriptEntry.host})
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setViewingScriptEntry(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs font-mono">
              {/* UP SCRIPT */}
              <div>
                <div className="flex items-center justify-between pb-1 font-bold text-emerald-600 dark:text-emerald-400">
                  <span>UP SCRIPT (Triggered on Host UP)</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(viewingScriptEntry.up_script || '', 'up-script')}
                    className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    {copiedKey === 'up-script' ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                    <span>{copiedKey === 'up-script' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <pre className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3.5 overflow-x-auto whitespace-pre-wrap max-h-48 text-[11px]">
                  {viewingScriptEntry.up_script || '# No up-script configured'}
                </pre>
              </div>

              {/* DOWN SCRIPT */}
              <div>
                <div className="flex items-center justify-between pb-1 font-bold text-rose-600 dark:text-rose-400">
                  <span>DOWN SCRIPT (Triggered on Host DOWN)</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(viewingScriptEntry.down_script || '', 'down-script')}
                    className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    {copiedKey === 'down-script' ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                    <span>{copiedKey === 'down-script' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <pre className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3.5 overflow-x-auto whitespace-pre-wrap max-h-48 text-[11px]">
                  {viewingScriptEntry.down_script || '# No down-script configured'}
                </pre>
              </div>

              {viewingScriptEntry.comment && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-2.5 font-sans text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-semibold text-slate-700 dark:text-slate-200">Router Comment:</span>{' '}
                  <code className="font-mono text-slate-900 dark:text-slate-100">{viewingScriptEntry.comment}</code>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setViewingScriptEntry(null)}
                className="rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-2 text-xs font-semibold text-white shadow-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Netwatch Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {editingEntry ? 'Edit Netwatch Target' : 'Add Netwatch to Router'}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="size-5" />
              </button>
            </div>

            {formError && (
              <div className="mt-4 flex items-start gap-2 rounded-xl bg-rose-500/10 p-3.5 text-xs text-rose-600 dark:text-rose-400">
                <AlertCircle className="size-4 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Error: </span>
                  <span>{formError}</span>
                </div>
              </div>
            )}

            <form onSubmit={handleSaveEntry} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Host IP Address *</label>
                  <input
                    type="text"
                    required
                    value={formHost}
                    onChange={(e) => setFormHost(e.target.value)}
                    placeholder="192.168.1.1"
                    className="mt-1 block w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Name / Label *</label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Core Gateway Server"
                    className="mt-1 block w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Telegram Bot Token</label>
                  <select
                    value={formTokenId || ''}
                    onChange={(e) => setFormTokenId(e.target.value ? Number(e.target.value) : null)}
                    className="mt-1 block w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">(No Telegram Alerts)</option>
                    {tokens.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label} (@{t.bot_username || 'bot'})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Check Interval</label>
                  <input
                    type="text"
                    value={formInterval}
                    onChange={(e) => setFormInterval(e.target.value)}
                    placeholder="00:00:10"
                    className="mt-1 block w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {/* Presets */}
                  <div className="mt-1.5 flex items-center gap-1 text-[11px]">
                    <span className="text-slate-400">Presets:</span>
                    {['5s', '10s', '30s', '1m'].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setFormInterval(preset)}
                        className="rounded-md bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-slate-600 dark:text-slate-400 hover:bg-blue-600 hover:text-white font-mono transition"
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Destination Chats Selector */}
              {formTokenId ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Send Alerts to Chats / Channels:
                  </label>
                  {availableChats.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 p-4 text-center text-xs text-slate-400">
                      No chats found under this bot. Please add a chat in the Telegram tab first.
                    </p>
                  ) : (
                    <div className="max-h-36 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 p-3 space-y-2 bg-slate-50 dark:bg-slate-800/50">
                      {availableChats.map((c) => {
                        const checked = selectedChats.includes(c.chat_id);
                        return (
                          <label key={c.id} className="flex items-center gap-2.5 cursor-pointer text-xs">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedChats([...selectedChats, c.chat_id]);
                                } else {
                                  setSelectedChats(selectedChats.filter((id) => id !== c.chat_id));
                                }
                              }}
                              className="size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="font-semibold text-slate-800 dark:text-slate-200">{c.label}</span>
                            <span className="font-mono text-slate-400">({c.chat_id})</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : null}

              {/* Bottom Buttons */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
                <button
                  type="button"
                  disabled={previewLoading || !formHost || !formName || !formTokenId}
                  onClick={handlePreview}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-750 transition disabled:opacity-50"
                >
                  {previewLoading ? <Loader2 className="size-3.5 animate-spin" /> : <Code2 className="size-3.5 text-blue-600 dark:text-blue-400" />}
                  <span>Preview Script</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={formLoading}
                    className="flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-2 text-xs font-semibold text-white shadow-xs disabled:opacity-60 transition"
                  >
                    {formLoading && <Loader2 className="size-3.5 animate-spin" />}
                    <span>{editingEntry ? 'Push Update' : 'Add to Router'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Script Preview Modal */}
      {previewOpen && previewScripts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Code2 className="size-5 text-blue-600 dark:text-blue-400" />
                <h2 className="text-base font-bold text-slate-900 dark:text-white">Generated RouterOS Scripts</h2>
              </div>
              <button
                type="button"
                onClick={() => setPreviewOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs font-mono">
              <div>
                <div className="flex items-center justify-between pb-1 text-emerald-600 dark:text-emerald-400 font-bold">
                  <span>UP Script</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(previewScripts.upScript || '', 'preview-up')}
                    className="text-[11px] flex items-center gap-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    {copiedKey === 'preview-up' ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                    <span>{copiedKey === 'preview-up' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <pre className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3 overflow-x-auto whitespace-pre-wrap">
                  {previewScripts.upScript}
                </pre>
              </div>

              <div>
                <div className="flex items-center justify-between pb-1 text-rose-600 dark:text-rose-400 font-bold">
                  <span>DOWN Script</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(previewScripts.downScript || '', 'preview-down')}
                    className="text-[11px] flex items-center gap-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    {copiedKey === 'preview-down' ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                    <span>{copiedKey === 'preview-down' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <pre className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3 overflow-x-auto whitespace-pre-wrap">
                  {previewScripts.downScript}
                </pre>
              </div>

              <div className="text-slate-500 dark:text-slate-400 font-sans text-xs">
                Comment: <code className="font-mono text-slate-900 dark:text-slate-100">{previewScripts.comment}</code>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setPreviewOpen(false)}
                className="rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-2 text-xs font-semibold text-white"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
