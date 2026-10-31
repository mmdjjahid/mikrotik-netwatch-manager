'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Router as RouterIcon,
  Plus,
  Search,
  Download,
  Trash2,
  Edit,
  Activity,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Server,
  X,
  Wifi,
} from 'lucide-react';
import { SectionTitleLineWithButton } from '@/components/admin-one/SectionTitleLineWithButton';
import { CardBox } from '@/components/admin-one/CardBox';
import { PillTag } from '@/components/admin-one/PillTag';

interface RouterItem {
  id: number;
  name: string;
  host: string;
  api_user: string;
  api_port: number;
  use_ssl: number;
  note: string;
  has_password?: boolean;
  created_at: string;
}

interface TestResult {
  name: string;
  version: string;
  uptime: string;
  board: string;
  cpuLoad?: string;
  freeMemory?: string;
}

export default function RoutersPage() {
  const [routers, setRouters] = useState<RouterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [testingId, setTestingId] = useState<number | null>(null);
  const [testResult, setTestResult] = useState<{ id: number; data?: TestResult; error?: string } | null>(null);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRouter, setEditingRouter] = useState<RouterItem | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    host: '',
    api_user: 'admin',
    api_pass: '',
    api_port: 8728,
    use_ssl: 0,
    note: '',
  });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [adHocTesting, setAdHocTesting] = useState(false);
  const [adHocResult, setAdHocResult] = useState<{ data?: TestResult; error?: string } | null>(null);

  // Delete modal
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchRouters = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/routers?search=${encodeURIComponent(search)}`);
      const data = await res.json();
      setRouters(data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchRouters();
  }, [fetchRouters]);

  const openAddModal = () => {
    setEditingRouter(null);
    setFormData({
      name: '',
      host: '',
      api_user: 'admin',
      api_pass: '',
      api_port: 8728,
      use_ssl: 0,
      note: '',
    });
    setFormError(null);
    setAdHocResult(null);
    setModalOpen(true);
  };

  const openEditModal = (r: RouterItem) => {
    setEditingRouter(r);
    setFormData({
      name: r.name,
      host: r.host,
      api_user: r.api_user,
      api_pass: '',
      api_port: r.api_port,
      use_ssl: r.use_ssl,
      note: r.note || '',
    });
    setFormError(null);
    setAdHocResult(null);
    setModalOpen(true);
  };

  const handleTestAdHoc = async () => {
    setAdHocTesting(true);
    setAdHocResult(null);
    try {
      const res = await fetch('/api/routers/test-adhoc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: formData.host,
          user: formData.api_user,
          pass: formData.api_pass,
          port: Number(formData.api_port),
          ssl: Boolean(formData.use_ssl),
          routerId: editingRouter?.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Connection failed');
      setAdHocResult({ data });
    } catch (err) {
      setAdHocResult({ error: (err as Error).message });
    } finally {
      setAdHocTesting(false);
    }
  };

  const handleSaveRouter = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError(null);

    try {
      const url = editingRouter ? `/api/routers/${editingRouter.id}` : '/api/routers';
      const method = editingRouter ? 'PUT' : 'POST';

      const payload: Record<string, unknown> = {
        name: formData.name,
        host: formData.host,
        api_user: formData.api_user,
        api_port: Number(formData.api_port),
        use_ssl: Number(formData.use_ssl),
        note: formData.note,
      };

      if (!editingRouter || formData.api_pass.trim() !== '') {
        payload.api_pass = formData.api_pass;
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save router');

      setModalOpen(false);
      fetchRouters();
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleTestRow = async (id: number) => {
    setTestingId(id);
    setTestResult(null);
    try {
      const res = await fetch(`/api/routers/${id}/test`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Test failed');
      setTestResult({ id, data });
    } catch (err) {
      setTestResult({ id, error: (err as Error).message });
    } finally {
      setTestingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/routers/${deleteId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete');
      }
      setDeleteId(null);
      fetchRouters();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Admin One Header */}
      <SectionTitleLineWithButton
        icon={RouterIcon}
        title="MikroTik Routers"
        subtitle="Manage your fleet of MikroTik routers and verify RouterOS API connectivity in real time"
      >
        <a
          href="/api/routers/export"
          download
          className="inline-flex size-10 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition shadow-2xs"
          title="Export CSV"
        >
          <Download className="size-4.5" />
        </a>
        <button
          onClick={openAddModal}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-2.5 text-xs font-semibold text-white shadow-sm shadow-blue-500/20 transition"
        >
          <Plus className="size-4" />
          <span>Add Router</span>
        </button>
      </SectionTitleLineWithButton>

      {/* Search Input Bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by router name, host IP or note..."
          className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 pl-10 pr-4 py-2.5 text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
        />
      </div>

      {/* Routers Table / Content */}
      {loading ? (
        <CardBox className="flex h-48 items-center justify-center">
          <Loader2 className="size-8 animate-spin text-blue-600" />
        </CardBox>
      ) : routers.length === 0 ? (
        <CardBox className="text-center py-16 space-y-3">
          <Server className="mx-auto size-12 text-slate-300 dark:text-slate-700" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">No routers configured</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            Add your first MikroTik router to begin automating Netwatch monitoring and Telegram alerts.
          </p>
          <button
            onClick={openAddModal}
            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-2 text-xs font-semibold text-white shadow-sm transition"
          >
            <Plus className="size-4" />
            <span>Add First Router</span>
          </button>
        </CardBox>
      ) : (
        <CardBox hasTable>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/70 dark:bg-slate-850/50 border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Router Name
                  </th>
                  <th className="px-6 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Host / IP
                  </th>
                  <th className="px-6 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    API Port
                  </th>
                  <th className="px-6 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    API User
                  </th>
                  <th className="px-6 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Encryption
                  </th>
                  <th className="px-6 py-3.5 text-right text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Actions & Diagnostic
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {routers.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-6 py-4 font-semibold text-slate-800 dark:text-slate-100">
                      <div className="flex items-center gap-2.5">
                        <RouterIcon className="size-4 text-blue-600 dark:text-blue-400 shrink-0" />
                        <span>{r.name}</span>
                      </div>
                      {r.note && <p className="text-xs text-slate-400 mt-0.5">{r.note}</p>}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">
                      {r.host}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-slate-500">{r.api_port}</td>
                    <td className="px-6 py-4 font-mono text-xs text-slate-500">{r.api_user}</td>
                    <td className="px-6 py-4">
                      {r.use_ssl ? (
                        <PillTag label="SSL (8729)" type="success" dot={false} />
                      ) : (
                        <PillTag label="Plain (8728)" type="neutral" dot={false} />
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleTestRow(r.id)}
                          disabled={testingId === r.id}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition disabled:opacity-60 shadow-2xs"
                        >
                          {testingId === r.id ? (
                            <Loader2 className="size-3.5 animate-spin text-blue-600" />
                          ) : (
                            <Activity className="size-3.5 text-blue-600 dark:text-blue-400" />
                          )}
                          <span>Test API</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditModal(r)}
                          aria-label={`Edit router ${r.name}`}
                          className="size-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-amber-600 hover:border-amber-200 dark:hover:text-amber-400 transition"
                        >
                          <Edit className="size-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteId(r.id)}
                          aria-label={`Delete router ${r.name}`}
                          className="size-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-rose-600 hover:border-rose-200 dark:hover:text-rose-400 transition"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>

                      {/* Row Test Result Accordion */}
                      {testResult?.id === r.id && (
                        <div className="mt-2 text-left">
                          {testResult.error ? (
                            <div className="flex items-start gap-2 rounded-xl bg-rose-500/10 p-2.5 text-xs text-rose-600 dark:text-rose-400">
                              <AlertCircle className="size-4 shrink-0 mt-0.5" />
                              <div>
                                <span className="font-bold">Connection failed: </span>
                                <span>{testResult.error}</span>
                              </div>
                            </div>
                          ) : (
                            <div className="rounded-xl border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/40 p-2.5 text-xs text-emerald-800 dark:text-emerald-300 space-y-1">
                              <div className="flex items-center gap-1.5 font-bold">
                                <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
                                <span>Online — {testResult.data?.name}</span>
                              </div>
                              <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[11px] font-mono">
                                <div>Version: {testResult.data?.version}</div>
                                <div>Uptime: {testResult.data?.uptime}</div>
                                <div>Board: {testResult.data?.board}</div>
                                <div>CPU: {testResult.data?.cpuLoad}</div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBox>
      )}

      {/* Add / Edit Router Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {editingRouter ? 'Edit MikroTik Router' : 'Add New MikroTik Router'}
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
              <div className="mt-4 flex items-start gap-2 rounded-xl bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-400">
                <AlertCircle className="size-4 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            {adHocResult && (
              <div className="mt-4">
                {adHocResult.error ? (
                  <div className="rounded-xl bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-400 flex items-start gap-2">
                    <AlertCircle className="size-4 shrink-0 mt-0.5" />
                    <span>{adHocResult.error}</span>
                  </div>
                ) : (
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/40 p-3 text-xs text-emerald-800 dark:text-emerald-300 space-y-1">
                    <div className="font-bold flex items-center gap-1.5">
                      <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
                      <span>Connected: {adHocResult.data?.name}</span>
                    </div>
                    <p className="text-[11px] font-mono">
                      RouterOS {adHocResult.data?.version} • Uptime {adHocResult.data?.uptime}
                    </p>
                  </div>
                )}
              </div>
            )}

            <form onSubmit={handleSaveRouter} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Name / Label *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Core Edge Router"
                    className="mt-1 block w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Host / IP Address *</label>
                  <input
                    type="text"
                    required
                    value={formData.host}
                    onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                    placeholder="118.179.157.122"
                    className="mt-1 block w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">API Port *</label>
                  <input
                    type="number"
                    required
                    value={formData.api_port}
                    onChange={(e) => setFormData({ ...formData, api_port: Number(e.target.value) })}
                    className="mt-1 block w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">API User *</label>
                  <input
                    type="text"
                    required
                    value={formData.api_user}
                    onChange={(e) => setFormData({ ...formData, api_user: e.target.value })}
                    className="mt-1 block w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Password {editingRouter && '(Leave blank to keep)'}
                  </label>
                  <input
                    type="password"
                    value={formData.api_pass}
                    onChange={(e) => setFormData({ ...formData, api_pass: e.target.value })}
                    placeholder={editingRouter ? '••••••••' : 'Password'}
                    className="mt-1 block w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={formData.use_ssl === 1}
                    onChange={(e) => setFormData({ ...formData, use_ssl: e.target.checked ? 1 : 0 })}
                    className="size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>Use SSL / TLS connection (API-SSL, default port 8729)</span>
                </label>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Notes / Location</label>
                <textarea
                  rows={2}
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                  placeholder="Data center rack 4, Core switch uplink..."
                  className="mt-1 block w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
                <button
                  type="button"
                  disabled={adHocTesting || !formData.host}
                  onClick={handleTestAdHoc}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-750 transition disabled:opacity-50"
                >
                  {adHocTesting ? <Loader2 className="size-3.5 animate-spin" /> : <Activity className="size-3.5 text-blue-600 dark:text-blue-400" />}
                  <span>Test Connection</span>
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
                    <span>{editingRouter ? 'Save Changes' : 'Connect Router'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Delete Router</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Are you sure you want to remove this router? Associated Netwatch database records will also be deleted.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteId(null)}
                className="rounded-xl border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleteLoading}
                className="rounded-xl bg-rose-600 hover:bg-rose-700 px-3.5 py-2 text-xs font-semibold text-white shadow-xs disabled:opacity-60"
              >
                {deleteLoading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
