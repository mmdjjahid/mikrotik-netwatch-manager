'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Settings,
  Shield,
  Sliders,
  Palette,
  MessageSquareCode,
  Users2,
  Database,
  Save,
  Plus,
  Trash2,
  Edit,
  Download,
  Upload,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
  Code2,
} from 'lucide-react';
import { SectionTitleLineWithButton } from '@/components/admin-one/SectionTitleLineWithButton';
import { CardBox } from '@/components/admin-one/CardBox';
import { PillTag } from '@/components/admin-one/PillTag';
import { ALL_PERMISSIONS } from '@/lib/permissions-constants';

interface SettingRow {
  key: string;
  value: string;
  type: string;
  category: string;
  label: string;
  description: string;
}

interface MessageTemplate {
  id: number;
  name: string;
  type: 'up' | 'down';
  template: string;
  is_default: number;
}

interface RoleRow {
  id: number;
  name: string;
  permissions: string;
  description: string;
  is_system: number;
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'defaults' | 'security' | 'branding' | 'templates' | 'roles' | 'backup'>('defaults');

  // Settings State
  const [settings, setSettings] = useState<SettingRow[]>([]);
  const [settingsValues, setSettingsValues] = useState<Record<string, string>>({});
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Message Templates State
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [tplModalOpen, setTplModalOpen] = useState(false);
  const [editingTpl, setEditingTpl] = useState<MessageTemplate | null>(null);
  const [tplName, setTplName] = useState('');
  const [tplType, setTplType] = useState<'up' | 'down'>('up');
  const [tplBody, setTplBody] = useState('');
  const [tplIsDefault, setTplIsDefault] = useState(false);
  const [tplLoading, setTplLoading] = useState(false);

  // Roles State
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleRow | null>(null);
  const [roleName, setRoleName] = useState('');
  const [roleDesc, setRoleDesc] = useState('');
  const [rolePerms, setRolePerms] = useState<string[]>([]);
  const [roleLoading, setRoleLoading] = useState(false);

  // Backup / Restore State
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [restoreStatus, setRestoreStatus] = useState<string | null>(null);

  // Fetch Settings
  const fetchSettings = useCallback(async () => {
    setLoadingSettings(true);
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      const list: SettingRow[] = data.data || [];
      setSettings(list);
      const valMap: Record<string, string> = {};
      list.forEach((s) => {
        valMap[s.key] = s.value;
      });
      setSettingsValues(valMap);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingSettings(false);
    }
  }, []);

  // Fetch Templates
  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch('/api/templates');
      const data = await res.json();
      setTemplates(data.data || []);
    } catch (err) {
      console.error(err);
    }
  }, []);

  // Fetch Roles
  const fetchRoles = useCallback(async () => {
    try {
      const res = await fetch('/api/roles');
      const data = await res.json();
      setRoles(data.data || []);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
    fetchTemplates();
    fetchRoles();
  }, [fetchSettings, fetchTemplates, fetchRoles]);

  const handleSaveSettings = async (category: string) => {
    setSavingSettings(true);
    setSaveSuccess(false);

    const relevant = settings.filter((s) => s.category === category);
    const updates = relevant.map((s) => ({
      key: s.key,
      value: settingsValues[s.key] !== undefined ? settingsValues[s.key] : s.value,
    }));

    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: updates }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save settings');

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      fetchSettings();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setSavingSettings(false);
    }
  };

  // Templates Handlers
  const openAddTemplate = () => {
    setEditingTpl(null);
    setTplName('');
    setTplType('up');
    setTplBody('<b>✅ HOST ONLINE</b>\nHost: {name}\nIP: {host}\nTime: {time} {date}');
    setTplIsDefault(false);
    setTplModalOpen(true);
  };

  const openEditTemplate = (tpl: MessageTemplate) => {
    setEditingTpl(tpl);
    setTplName(tpl.name);
    setTplType(tpl.type);
    setTplBody(tpl.template);
    setTplIsDefault(tpl.is_default === 1);
    setTplModalOpen(true);
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    setTplLoading(true);
    try {
      const url = editingTpl ? `/api/templates/${editingTpl.id}` : '/api/templates';
      const method = editingTpl ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: tplName,
          type: tplType,
          template: tplBody,
          is_default: tplIsDefault ? 1 : 0,
        }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to save template');
      }

      setTplModalOpen(false);
      fetchTemplates();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setTplLoading(false);
    }
  };

  const handleDeleteTemplate = async (id: number) => {
    if (!confirm('Delete this message template?')) return;
    try {
      await fetch(`/api/templates/${id}`, { method: 'DELETE' });
      fetchTemplates();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  // Roles Handlers
  const openAddRole = () => {
    setEditingRole(null);
    setRoleName('');
    setRoleDesc('');
    setRolePerms([]);
    setRoleModalOpen(true);
  };

  const openEditRole = (r: RoleRow) => {
    setEditingRole(r);
    setRoleName(r.name);
    setRoleDesc(r.description || '');
    try {
      setRolePerms(JSON.parse(r.permissions));
    } catch {
      setRolePerms([]);
    }
    setRoleModalOpen(true);
  };

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    setRoleLoading(true);
    try {
      const url = editingRole ? `/api/roles/${editingRole.id}` : '/api/roles';
      const method = editingRole ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: roleName,
          description: roleDesc,
          permissions: rolePerms,
        }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to save role');
      }

      setRoleModalOpen(false);
      fetchRoles();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setRoleLoading(false);
    }
  };

  const handleDeleteRole = async (id: number) => {
    if (!confirm('Are you sure you want to delete this role?')) return;
    try {
      const res = await fetch(`/api/roles/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Delete failed');
      fetchRoles();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  // Restore Handler
  const handleRestore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restoreFile) return;

    if (!confirm('WARNING: Restoring a database file will overwrite all current data. Proceed?')) return;

    setRestoreLoading(true);
    setRestoreStatus(null);
    try {
      const formData = new FormData();
      formData.append('file', restoreFile);

      const res = await fetch('/api/backup/restore', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Restore failed');
      setRestoreStatus('Database restored successfully! Reloading...');
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      setRestoreStatus(`Error: ${(err as Error).message}`);
    } finally {
      setRestoreLoading(false);
    }
  };

  const renderCategorySettings = (category: string) => {
    const list = settings.filter((s) => s.category === category);
    return (
      <div className="space-y-4">
        <CardBox className="p-6">
          <div className="divide-y divide-slate-100 dark:divide-slate-850 space-y-4">
            {list.map((s) => (
              <div key={s.key} className="pt-4 first:pt-0 grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
                <div>
                  <label className="text-xs font-bold text-slate-800 dark:text-slate-100 block">{s.label || s.key}</label>
                  <p className="text-[11px] text-slate-400 mt-0.5">{s.description}</p>
                </div>

                <div className="md:col-span-2">
                  {s.type === 'boolean' ? (
                    <select
                      value={settingsValues[s.key] || 'false'}
                      onChange={(e) => setSettingsValues({ ...settingsValues, [s.key]: e.target.value })}
                      className="w-full sm:w-48 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="true">Enabled</option>
                      <option value="false">Disabled</option>
                    </select>
                  ) : (
                    <input
                      type={s.type === 'number' ? 'number' : 'text'}
                      value={settingsValues[s.key] !== undefined ? settingsValues[s.key] : ''}
                      onChange={(e) => setSettingsValues({ ...settingsValues, [s.key]: e.target.value })}
                      className="w-full sm:max-w-md rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardBox>

        <div className="flex items-center justify-end gap-3">
          {saveSuccess && (
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="size-4" />
              <span>Settings saved!</span>
            </span>
          )}
          <button
            type="button"
            onClick={() => handleSaveSettings(category)}
            disabled={savingSettings}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-2 text-xs font-semibold text-white shadow-sm shadow-blue-500/20 disabled:opacity-60 transition"
          >
            {savingSettings ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
            <span>Save Settings</span>
          </button>
        </div>
      </div>
    );
  };

  const tabs = [
    { key: 'defaults', label: 'Defaults', icon: Sliders },
    { key: 'security', label: 'Security', icon: Shield },
    { key: 'branding', label: 'Branding', icon: Palette },
    { key: 'templates', label: 'Alert Templates', icon: MessageSquareCode },
    { key: 'roles', label: 'Roles & RBAC', icon: Users2 },
    { key: 'backup', label: 'Backup / Restore', icon: Database },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Admin One Header */}
      <SectionTitleLineWithButton
        icon={Settings}
        title="System Settings"
        subtitle="Dynamic commercial configuration: parameters, Telegram templates, RBAC roles, and database backups"
      />

      {/* Admin One Navigation Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition ${
                isActive
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <Icon className="size-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      {loadingSettings ? (
        <CardBox className="flex h-48 items-center justify-center">
          <Loader2 className="size-8 animate-spin text-blue-600" />
        </CardBox>
      ) : (
        <>
          {activeTab === 'defaults' && renderCategorySettings('defaults')}
          {activeTab === 'security' && renderCategorySettings('security')}
          {activeTab === 'branding' && renderCategorySettings('branding')}

          {/* Alert Templates Tab */}
          {activeTab === 'templates' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Message Alert Templates
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={openAddTemplate}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition"
                >
                  <Plus className="size-3.5" />
                  <span>Add Template</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {templates.map((tpl) => (
                  <CardBox key={tpl.id} className="p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {tpl.type === 'up' ? (
                          <PillTag label="UP" type="success" dot={false} />
                        ) : (
                          <PillTag label="DOWN" type="danger" dot={false} />
                        )}
                        <span className="font-bold text-slate-900 dark:text-white text-sm">{tpl.name}</span>
                        {tpl.is_default === 1 && (
                          <PillTag label="Default" type="info" dot={false} />
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEditTemplate(tpl)}
                          className="size-7 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-amber-600 dark:hover:text-amber-400"
                        >
                          <Edit className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteTemplate(tpl.id)}
                          className="size-7 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-rose-600 dark:hover:text-rose-400"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>

                    <pre className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3 text-xs font-mono whitespace-pre-wrap max-h-32 overflow-y-auto">
                      {tpl.template}
                    </pre>
                  </CardBox>
                ))}
              </div>
            </div>
          )}

          {/* Roles & RBAC Tab */}
          {activeTab === 'roles' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Role-Based Access Control (RBAC)
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={openAddRole}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition"
                >
                  <Plus className="size-3.5" />
                  <span>Add Custom Role</span>
                </button>
              </div>

              <CardBox hasTable>
                <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {roles.map((r) => {
                    let permsList: string[] = [];
                    try {
                      permsList = JSON.parse(r.permissions);
                    } catch {
                      permsList = [];
                    }

                    return (
                      <div key={r.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 dark:text-white text-sm uppercase font-mono">{r.name}</span>
                            {r.is_system === 1 ? (
                              <PillTag label="System" type="neutral" dot={false} />
                            ) : (
                              <PillTag label="Custom" type="info" dot={false} />
                            )}
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">{r.description}</p>
                          <div className="mt-2.5 flex flex-wrap gap-1">
                            {permsList.map((p) => (
                              <span key={p} className="rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 font-mono text-[10px] font-semibold text-slate-700 dark:text-slate-300">
                                {p}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => openEditRole(r)}
                            className="size-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-amber-600 dark:hover:text-amber-400"
                          >
                            <Edit className="size-3.5" />
                          </button>
                          {r.is_system === 0 && (
                            <button
                              type="button"
                              onClick={() => handleDeleteRole(r.id)}
                              className="size-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-rose-600 dark:hover:text-rose-400"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardBox>
            </div>
          )}

          {/* Backup / Restore Tab */}
          {activeTab === 'backup' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Backup Card */}
              <CardBox className="p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
                    <Download className="size-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white">Download SQLite Backup</h2>
                    <p className="text-xs text-slate-400">Complete offline snapshot of all routers, tokens, and records.</p>
                  </div>
                </div>

                <p className="text-xs text-slate-500 dark:text-slate-400">
                  The SQLite database file contains all user accounts, encrypted secrets, and Netwatch tracking records.
                </p>

                <a
                  href="/api/backup"
                  download
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition"
                >
                  <Download className="size-4" />
                  <span>Download .db File</span>
                </a>
              </CardBox>

              {/* Restore Card */}
              <CardBox className="p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
                    <Upload className="size-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white">Restore from Backup</h2>
                    <p className="text-xs text-slate-400">Replace database with a previously saved .db file.</p>
                  </div>
                </div>

                {restoreStatus && (
                  <div className="rounded-xl bg-slate-100 dark:bg-slate-800 p-3 text-xs font-mono text-slate-900 dark:text-white">
                    {restoreStatus}
                  </div>
                )}

                <form onSubmit={handleRestore} className="space-y-3">
                  <input
                    type="file"
                    accept=".db"
                    required
                    onChange={(e) => setRestoreFile(e.target.files?.[0] || null)}
                    className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:opacity-90"
                  />

                  <button
                    type="submit"
                    disabled={restoreLoading || !restoreFile}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/40 px-4 py-2.5 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/60 transition disabled:opacity-50"
                  >
                    {restoreLoading && <Loader2 className="size-4 animate-spin" />}
                    <span>Restore Database</span>
                  </button>
                </form>
              </CardBox>
            </div>
          )}
        </>
      )}

      {/* Template Modal */}
      {tplModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {editingTpl ? 'Edit Alert Template' : 'Add Message Template'}
              </h2>
              <button
                type="button"
                onClick={() => setTplModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTemplate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Template Name *</label>
                <input
                  type="text"
                  required
                  value={tplName}
                  onChange={(e) => setTplName(e.target.value)}
                  placeholder="e.g. Concise UP Alert"
                  className="mt-1 block w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Trigger Type</label>
                <select
                  value={tplType}
                  onChange={(e) => setTplType(e.target.value as 'up' | 'down')}
                  className="mt-1 block w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="up">UP Alert</option>
                  <option value="down">DOWN Alert</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Template Content (HTML supported) *
                </label>
                <textarea
                  rows={5}
                  required
                  value={tplBody}
                  onChange={(e) => setTplBody(e.target.value)}
                  className="mt-1 block w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  Available tags: <code>{'{name}'}</code>, <code>{'{host}'}</code>, <code>{'{router}'}</code>, <code>{'{date}'}</code>, <code>{'{time}'}</code>
                </p>
              </div>

              <label className="flex items-center gap-2 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={tplIsDefault}
                  onChange={(e) => setTplIsDefault(e.target.checked)}
                  className="size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="font-semibold text-slate-700 dark:text-slate-300">Set as default {tplType.toUpperCase()} template</span>
              </label>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setTplModalOpen(false)}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={tplLoading}
                  className="flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-2 text-xs font-semibold text-white shadow-xs disabled:opacity-60 transition"
                >
                  {tplLoading && <Loader2 className="size-3.5 animate-spin" />}
                  <span>Save Template</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Role Modal */}
      {roleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {editingRole ? `Edit Role: ${editingRole.name}` : 'Create Custom Role'}
              </h2>
              <button
                type="button"
                onClick={() => setRoleModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRole} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Role Name *</label>
                <input
                  type="text"
                  required
                  disabled={Boolean(editingRole && editingRole.is_system === 1)}
                  value={roleName}
                  onChange={(e) => setRoleName(e.target.value)}
                  placeholder="e.g. noc_lead"
                  className="mt-1 block w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Description</label>
                <input
                  type="text"
                  value={roleDesc}
                  onChange={(e) => setRoleDesc(e.target.value)}
                  placeholder="Responsibilities..."
                  className="mt-1 block w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Permissions Granted</label>
                <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 p-3 space-y-2 bg-slate-50 dark:bg-slate-800/50">
                  {ALL_PERMISSIONS.map((perm) => {
                    const checked = rolePerms.includes(perm) || rolePerms.includes('*');
                    return (
                      <label key={perm} className="flex items-center gap-2 cursor-pointer text-xs">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) setRolePerms([...rolePerms, perm]);
                            else setRolePerms(rolePerms.filter((p) => p !== perm));
                          }}
                          className="size-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="font-mono text-slate-800 dark:text-slate-200">{perm}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRoleModalOpen(false)}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={roleLoading}
                  className="flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-2 text-xs font-semibold text-white shadow-xs disabled:opacity-60 transition"
                >
                  {roleLoading && <Loader2 className="size-3.5 animate-spin" />}
                  <span>Save Role</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
