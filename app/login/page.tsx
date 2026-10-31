'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ThemeToggle } from '@/components/theme-toggle';
import { ShieldCheck, Loader2, AlertCircle, Radio, User, Lock } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dynamic branding state
  const [branding, setBranding] = useState<{
    'branding.app_name'?: string;
    'branding.login_message'?: string;
    'branding.app_logo_url'?: string;
  }>({
    'branding.app_name': 'Netwatch Suite',
    'branding.login_message': 'MikroTik Netwatch & Telegram Alert Manager',
  });

  useEffect(() => {
    fetch('/api/branding')
      .then((res) => res.json())
      .then((data) => {
        if (data && typeof data === 'object') {
          setBranding((prev) => ({ ...prev, ...data }));
        }
      })
      .catch(() => {
        // use defaults if branding fetch fails
      });
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to authenticate');
      }

      // Full window navigation commits session cookie and ensures fresh page load
      window.location.href = '/dashboard';
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col justify-center bg-slate-50 dark:bg-slate-950 px-4 py-12 sm:px-6 lg:px-8 relative antialiased">
      {/* Top right theme toggle */}
      <div className="fixed right-6 top-6 z-50">
        <ThemeToggle />
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/25">
            <Radio className="size-8" />
          </div>
        </div>

        <h1 className="mt-4 text-center text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
          {branding['branding.app_name'] || 'Netwatch Suite'}
        </h1>
        <p className="mt-1 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          {branding['branding.login_message'] || 'MikroTik Netwatch & Telegram Alert Manager'}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-7 sm:p-8 shadow-sm">
          {error && (
            <div
              role="alert"
              className="mb-6 flex items-start gap-3 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/40 p-4 text-xs text-rose-700 dark:text-rose-300"
            >
              <AlertCircle className="mt-0.5 size-4.5 shrink-0 text-rose-600 dark:text-rose-400" />
              <div>
                <p className="font-bold">Authentication failed</p>
                <p className="mt-0.5">{error}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label
                htmlFor="username"
                className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"
              >
                Username
              </label>
              <div className="mt-1.5 relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <User className="size-4" />
                </div>
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin"
                  className="block w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-10 pr-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"
              >
                Password
              </label>
              <div className="mt-1.5 relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <Lock className="size-4" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-10 pr-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-3 text-sm font-semibold text-white shadow-sm shadow-blue-500/20 transition disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                'Sign In to Console'
              )}
            </button>
          </form>

          <div className="mt-6 border-t border-slate-100 dark:border-slate-800 pt-4 text-center text-xs text-slate-400">
            Default credentials:{' '}
            <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">admin / admin</span>
          </div>
        </div>
      </div>
    </div>
  );
}
