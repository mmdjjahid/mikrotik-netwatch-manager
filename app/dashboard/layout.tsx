'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AsideMenu } from '@/components/admin-one/AsideMenu';
import { NavBar } from '@/components/admin-one/NavBar';
import { ShieldAlert, Loader2, CheckCircle2 } from 'lucide-react';

interface CurrentUser {
  id: number;
  username: string;
  role: string;
  must_change: number;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  // Change password modal for must_change
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdSuccess, setPwdSuccess] = useState(false);

  // Load current user
  useEffect(() => {
    fetch('/api/me')
      .then((res) => {
        if (!res.ok) throw new Error('Not logged in');
        return res.json();
      })
      .then((data) => {
        setCurrentUser(data);
        if (data.must_change === 1) {
          setShowPasswordModal(true);
        }
      })
      .catch(() => {
        router.push('/login');
      })
      .finally(() => {
        setLoadingUser(false);
      });
  }, [router]);

  const handleLogout = async () => {
    await fetch('/api/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdError(null);

    if (newPassword.length < 6) {
      setPwdError('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwdError('Passwords do not match.');
      return;
    }

    setPwdLoading(true);
    try {
      const res = await fetch('/api/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldPassword: 'admin', newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update password');

      setPwdSuccess(true);
      setTimeout(() => {
        setShowPasswordModal(false);
        if (currentUser) {
          setCurrentUser({ ...currentUser, must_change: 0 });
        }
      }, 1500);
    } catch (err) {
      setPwdError((err as Error).message);
    } finally {
      setPwdLoading(false);
    }
  };

  if (loadingUser) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-900 text-white">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-9 animate-spin text-blue-500" />
          <p className="text-xs font-semibold text-slate-400 tracking-wider uppercase">Loading Netwatch Console...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans antialiased text-slate-800 dark:text-slate-100">
      {/* Admin One Left Sidebar */}
      <AsideMenu
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      {/* Main Content Area Offset by Sidebar */}
      <div className="xl:pl-64 flex flex-col min-h-screen transition-all duration-300">
        <NavBar
          onOpenMobile={() => setMobileMenuOpen(true)}
          currentUser={currentUser}
          onLogout={handleLogout}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Default Password Change Banner / Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center gap-3 text-amber-500">
              <ShieldAlert className="size-7" />
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Change Default Password</h2>
            </div>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              You are currently using default administrator credentials. For commercial production security, you must set a new password before proceeding.
            </p>

            {pwdSuccess ? (
              <div className="mt-6 flex items-center gap-2 rounded-xl bg-emerald-500/10 p-4 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="size-5 shrink-0" />
                <span>Password updated successfully! Welcome to Netwatch Suite.</span>
              </div>
            ) : (
              <form onSubmit={handleUpdatePassword} className="mt-5 space-y-4">
                {pwdError && (
                  <p className="rounded-lg bg-rose-500/10 p-3 text-xs text-rose-500">{pwdError}</p>
                )}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">New Password</label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="mt-1 block w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Confirm New Password</label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat new password"
                    className="mt-1 block w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={pwdLoading}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-500/20 disabled:opacity-60 transition"
                >
                  {pwdLoading ? <Loader2 className="size-4 animate-spin" /> : 'Set Secure Password'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
