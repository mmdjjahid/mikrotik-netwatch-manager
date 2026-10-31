'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Plus,
  KeyRound,
  Trash2,
  Edit,
  Loader2,
  AlertCircle,
  X,
  UserCheck,
  UserX,
} from 'lucide-react';
import { SectionTitleLineWithButton } from '@/components/admin-one/SectionTitleLineWithButton';
import { CardBox } from '@/components/admin-one/CardBox';
import { PillTag } from '@/components/admin-one/PillTag';

interface UserRecord {
  id: number;
  username: string;
  role: string;
  must_change: number;
  is_active: number;
  created_at: string;
}

interface RoleRecord {
  id: number;
  name: string;
  description: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Add / Edit Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState('operator');
  const [formIsActive, setFormIsActive] = useState(1);
  const [formMustChange, setFormMustChange] = useState(0);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Reset Password Modal
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetUserId, setResetUserId] = useState<number | null>(null);
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const fetchUsersAndRoles = useCallback(async () => {
    setLoading(true);
    try {
      const [uRes, rRes] = await Promise.all([fetch('/api/users'), fetch('/api/roles')]);
      const uData = await uRes.json();
      const rData = await rRes.json();
      setUsers(uData.data || []);
      setRoles(rData.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsersAndRoles();
  }, [fetchUsersAndRoles]);

  const openAddModal = () => {
    setEditingUser(null);
    setFormUsername('');
    setFormPassword('');
    setFormRole(roles.length > 0 ? roles[0].name : 'operator');
    setFormIsActive(1);
    setFormMustChange(0);
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (u: UserRecord) => {
    setEditingUser(u);
    setFormUsername(u.username);
    setFormRole(u.role);
    setFormIsActive(u.is_active);
    setFormMustChange(u.must_change);
    setFormError(null);
    setModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError(null);

    try {
      const url = editingUser ? `/api/users/${editingUser.id}` : '/api/users';
      const method = editingUser ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: formUsername,
          password: formPassword,
          role: formRole,
          is_active: formIsActive,
          must_change: formMustChange,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save user');

      setModalOpen(false);
      fetchUsersAndRoles();
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetUserId) return;
    setResetLoading(true);
    setResetError(null);

    try {
      const res = await fetch(`/api/users/${resetUserId}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword: resetNewPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reset password');

      setResetModalOpen(false);
      setResetNewPassword('');
      alert(data.message || 'Password reset successfully.');
      fetchUsersAndRoles();
    } catch (err) {
      setResetError((err as Error).message);
    } finally {
      setResetLoading(false);
    }
  };

  const handleDeleteUser = async (u: UserRecord) => {
    if (!confirm(`Are you sure you want to permanently delete user "${u.username}"?`)) return;
    try {
      const res = await fetch(`/api/users/${u.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete user');
      fetchUsersAndRoles();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Admin One Header */}
      <SectionTitleLineWithButton
        icon={Users}
        title="User Accounts & Access"
        subtitle="Manage administrative operators, role assignments, and authentication credentials"
      >
        <button
          onClick={openAddModal}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-2.5 text-xs font-semibold text-white shadow-sm shadow-blue-500/20 transition"
        >
          <Plus className="size-4" />
          <span>Add User</span>
        </button>
      </SectionTitleLineWithButton>

      {/* Users Table */}
      {loading ? (
        <CardBox className="flex h-48 items-center justify-center">
          <Loader2 className="size-8 animate-spin text-blue-600" />
        </CardBox>
      ) : (
        <CardBox hasTable>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/70 dark:bg-slate-850/50 border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Operator
                  </th>
                  <th className="px-6 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Assigned Role
                  </th>
                  <th className="px-6 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Status
                  </th>
                  <th className="px-6 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Must Change Password
                  </th>
                  <th className="px-6 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Created At
                  </th>
                  <th className="px-6 py-3.5 text-right text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-6 py-4 font-semibold text-slate-800 dark:text-slate-100">
                      <div className="flex items-center gap-2.5">
                        <div className="flex size-8 items-center justify-center rounded-xl bg-blue-600 text-white font-black text-xs uppercase shadow-xs">
                          {u.username.slice(0, 2)}
                        </div>
                        <span>{u.username}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs font-bold uppercase text-slate-700 dark:text-slate-300">
                        {u.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {u.is_active ? (
                        <PillTag label="Active" type="success" icon={UserCheck} dot />
                      ) : (
                        <PillTag label="Disabled" type="disabled" icon={UserX} dot={false} />
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-400 font-mono">
                      {u.must_change ? 'Yes' : 'No'}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-slate-400">{u.created_at}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setResetUserId(u.id);
                            setResetNewPassword('');
                            setResetError(null);
                            setResetModalOpen(true);
                          }}
                          title="Reset Password"
                          aria-label={`Reset password for ${u.username}`}
                          className="size-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 transition"
                        >
                          <KeyRound className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditModal(u)}
                          title="Edit User"
                          aria-label={`Edit user ${u.username}`}
                          className="size-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-amber-600 dark:hover:text-amber-400 transition"
                        >
                          <Edit className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteUser(u)}
                          title="Delete User"
                          aria-label={`Delete user ${u.username}`}
                          className="size-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 transition"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBox>
      )}

      {/* Add / Edit User Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {editingUser ? 'Edit User Account' : 'Create User Account'}
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
              <div className="mt-4 rounded-xl bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-400 flex items-start gap-2">
                <AlertCircle className="size-4 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveUser} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Username *</label>
                <input
                  type="text"
                  required
                  value={formUsername}
                  onChange={(e) => setFormUsername(e.target.value)}
                  placeholder="operator"
                  className="mt-1 block w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {!editingUser && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Password *</label>
                  <input
                    type="password"
                    required
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="mt-1 block w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Role *</label>
                <select
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value)}
                  className="mt-1 block w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.name}>
                      {r.name.toUpperCase()} — {r.description}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-4 pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={formIsActive === 1}
                    onChange={(e) => setFormIsActive(e.target.checked ? 1 : 0)}
                    className="size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>Account Active</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={formMustChange === 1}
                    onChange={(e) => setFormMustChange(e.target.checked ? 1 : 0)}
                    className="size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>Require Password Change</span>
                </label>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-2 text-xs font-semibold text-white shadow-xs disabled:opacity-60 transition"
                >
                  {formLoading && <Loader2 className="size-3.5 animate-spin" />}
                  <span>{editingUser ? 'Save Changes' : 'Create User'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Reset User Password</h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Provide a new temporary or permanent password for this account.
            </p>

            {resetError && (
              <div className="mt-3 rounded-xl bg-rose-500/10 p-2.5 text-xs text-rose-600 dark:text-rose-400">
                {resetError}
              </div>
            )}

            <form onSubmit={handleResetPassword} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">New Password</label>
                <input
                  type="password"
                  required
                  value={resetNewPassword}
                  onChange={(e) => setResetNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="mt-1 block w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResetModalOpen(false)}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetLoading}
                  className="rounded-xl bg-blue-600 hover:bg-blue-700 px-3.5 py-2 text-xs font-semibold text-white shadow-xs disabled:opacity-60 transition"
                >
                  {resetLoading ? 'Resetting...' : 'Set Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
