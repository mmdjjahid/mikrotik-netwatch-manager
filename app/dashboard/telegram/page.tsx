'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Send,
  Plus,
  Trash2,
  Edit,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  ExternalLink,
  MessageSquare,
  X,
  HelpCircle,
  Radio,
} from 'lucide-react';
import { SectionTitleLineWithButton } from '@/components/admin-one/SectionTitleLineWithButton';
import { CardBox, CardBoxHeader } from '@/components/admin-one/CardBox';
import { PillTag } from '@/components/admin-one/PillTag';

interface TokenItem {
  id: number;
  label: string;
  bot_username: string;
  chats_count: number;
  created_at: string;
}

interface ChatItem {
  id: number;
  token_id: number;
  label: string;
  chat_id: string;
  created_at: string;
}

export default function TelegramPage() {
  const [tokens, setTokens] = useState<TokenItem[]>([]);
  const [selectedTokenId, setSelectedTokenId] = useState<number | null>(null);
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [loadingTokens, setLoadingTokens] = useState(true);
  const [loadingChats, setLoadingChats] = useState(false);

  // Token Modal (Add & Edit)
  const [tokenModalOpen, setTokenModalOpen] = useState(false);
  const [editingToken, setEditingToken] = useState<TokenItem | null>(null);
  const [tokenLabel, setTokenLabel] = useState('');
  const [tokenString, setTokenString] = useState('');
  const [tokenLoading, setTokenLoading] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [tokenSuccessMessage, setTokenSuccessMessage] = useState<string | null>(null);

  // Chat Modal
  const [chatModalOpen, setChatModalOpen] = useState(false);
  const [editingChat, setEditingChat] = useState<ChatItem | null>(null);
  const [chatLabel, setChatLabel] = useState('');
  const [chatIdValue, setChatIdValue] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  // Test Message Status: chatId -> status
  const [testingChatId, setTestingChatId] = useState<number | null>(null);
  const [testStatus, setTestStatus] = useState<{ id: number; success: boolean; msg: string } | null>(null);

  const fetchTokens = useCallback(async () => {
    setLoadingTokens(true);
    try {
      const res = await fetch('/api/tokens');
      const data = await res.json();
      const list = data.data || [];
      setTokens(list);
      if (list.length > 0 && !selectedTokenId) {
        setSelectedTokenId(list[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingTokens(false);
    }
  }, [selectedTokenId]);

  const fetchChats = useCallback(async (tId: number) => {
    setLoadingChats(true);
    try {
      const res = await fetch(`/api/tokens/${tId}/chats`);
      const data = await res.json();
      setChats(data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingChats(false);
    }
  }, []);

  useEffect(() => {
    fetchTokens();
  }, [fetchTokens]);

  useEffect(() => {
    if (selectedTokenId) {
      fetchChats(selectedTokenId);
    } else {
      setChats([]);
    }
  }, [selectedTokenId, fetchChats]);

  const openAddTokenModal = () => {
    setEditingToken(null);
    setTokenLabel('');
    setTokenString('');
    setTokenError(null);
    setTokenModalOpen(true);
  };

  const openEditTokenModal = (t: TokenItem) => {
    setEditingToken(t);
    setTokenLabel(t.label);
    setTokenString(''); // leave empty unless changing
    setTokenError(null);
    setTokenModalOpen(true);
  };

  const handleSaveToken = async (e: React.FormEvent) => {
    e.preventDefault();
    setTokenLoading(true);
    setTokenError(null);

    try {
      const url = editingToken ? `/api/tokens/${editingToken.id}` : '/api/tokens';
      const method = editingToken ? 'PUT' : 'POST';

      const payload: { label: string; token?: string } = { label: tokenLabel };
      if (tokenString.trim() !== '') {
        payload.token = tokenString.trim();
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save bot token');

      setTokenModalOpen(false);
      setTokenSuccessMessage(
        data.message || (editingToken ? 'Bot token updated and synced.' : 'Bot token connected.')
      );
      setTimeout(() => setTokenSuccessMessage(null), 8000);
      fetchTokens();
      if (editingToken && selectedTokenId === editingToken.id) {
        fetchChats(editingToken.id);
      }
    } catch (err) {
      setTokenError((err as Error).message);
    } finally {
      setTokenLoading(false);
    }
  };

  const handleVerifyToken = async (tId: number) => {
    try {
      const res = await fetch(`/api/tokens/${tId}/verify`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Verification failed');
      alert(`Token verified! Connected as @${data.username}`);
      fetchTokens();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const handleDeleteToken = async (tId: number) => {
    if (!confirm('Are you sure? This will delete this bot token and all associated chats.')) return;
    try {
      await fetch(`/api/tokens/${tId}`, { method: 'DELETE' });
      if (selectedTokenId === tId) setSelectedTokenId(null);
      fetchTokens();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const handleSaveChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTokenId) return;
    setChatLoading(true);
    setChatError(null);

    try {
      const url = editingChat ? `/api/chats/${editingChat.id}` : `/api/tokens/${selectedTokenId}/chats`;
      const method = editingChat ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: chatLabel, chat_id: chatIdValue }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save chat');

      setChatModalOpen(false);
      setTokenSuccessMessage(
        data.message || (editingChat ? 'Chat updated and synced with MikroTik.' : 'Chat added.')
      );
      setTimeout(() => setTokenSuccessMessage(null), 8000);
      fetchChats(selectedTokenId);
      fetchTokens();
    } catch (err) {
      setChatError((err as Error).message);
    } finally {
      setChatLoading(false);
    }
  };

  const handleDeleteChat = async (cId: number) => {
    if (!confirm('Are you sure you want to remove this chat?')) return;
    try {
      const res = await fetch(`/api/chats/${cId}`, { method: 'DELETE' });
      const data = await res.json();
      if (selectedTokenId) fetchChats(selectedTokenId);
      fetchTokens();
      if (data.message) {
        setTokenSuccessMessage(data.message);
        setTimeout(() => setTokenSuccessMessage(null), 8000);
      }
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const handleTestChat = async (cId: number) => {
    setTestingChatId(cId);
    setTestStatus(null);
    try {
      const res = await fetch(`/api/chats/${cId}/test`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send test message');
      setTestStatus({ id: cId, success: true, msg: 'Test alert delivered to Telegram!' });
    } catch (err) {
      setTestStatus({ id: cId, success: false, msg: (err as Error).message });
    } finally {
      setTestingChatId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Admin One Page Header */}
      <SectionTitleLineWithButton
        icon={Send}
        title="Telegram Bot & Alert Chats"
        subtitle="Configure Telegram bots, channels, and groups with instant live testing & automatic MikroTik sync"
      >
        <button
          onClick={openAddTokenModal}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-2.5 text-xs font-semibold text-white shadow-sm shadow-blue-500/20 transition"
        >
          <Plus className="size-4" />
          <span>Add Telegram Bot</span>
        </button>
      </SectionTitleLineWithButton>

      {/* Global Success Notification */}
      {tokenSuccessMessage && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/40 p-4 text-xs font-semibold text-emerald-800 dark:text-emerald-300 shadow-xs animate-in fade-in duration-300">
          <CheckCircle2 className="size-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
          <p>{tokenSuccessMessage}</p>
        </div>
      )}

      {/* Admin One 2-Column Split: Bots on Left, Chats on Right */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column: Bots List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Configured Bots ({tokens.length})
            </h2>
          </div>

          {loadingTokens ? (
            <CardBox className="flex h-32 items-center justify-center">
              <Loader2 className="size-6 animate-spin text-blue-600" />
            </CardBox>
          ) : tokens.length === 0 ? (
            <CardBox className="text-center py-12 space-y-2">
              <Send className="mx-auto size-8 text-slate-300 dark:text-slate-700" />
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">No bots added</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Click Add Telegram Bot to connect your bot token.</p>
            </CardBox>
          ) : (
            <div className="space-y-2.5">
              {tokens.map((t) => {
                const isSelected = selectedTokenId === t.id;
                return (
                  <div
                    key={t.id}
                    onClick={() => setSelectedTokenId(t.id)}
                    className={`cursor-pointer rounded-2xl border p-4 transition-all duration-200 ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-950/30 dark:border-blue-600 shadow-xs'
                        : 'border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-850'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-1.5">
                          <span>{t.label}</span>
                          {t.bot_username && (
                            <span className="text-xs font-normal text-blue-600 dark:text-blue-400 font-mono">
                              (@{t.bot_username})
                            </span>
                          )}
                        </div>
                        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {t.chats_count} alert destination(s)
                        </div>
                      </div>

                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        {/* Edit Bot Token */}
                        <button
                          type="button"
                          onClick={() => openEditTokenModal(t)}
                          title="Edit Bot Token & Sync MikroTik"
                          aria-label="Edit Bot"
                          className="size-7 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-amber-600 dark:hover:text-amber-400 transition"
                        >
                          <Edit className="size-3.5" />
                        </button>

                        {/* Re-verify Bot */}
                        <button
                          type="button"
                          onClick={() => handleVerifyToken(t.id)}
                          title="Re-verify with Telegram"
                          aria-label="Re-verify token"
                          className="size-7 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 transition"
                        >
                          <RefreshCw className="size-3.5" />
                        </button>

                        {/* Delete Bot */}
                        <button
                          type="button"
                          onClick={() => handleDeleteToken(t.id)}
                          title="Delete Bot"
                          aria-label="Delete Bot"
                          className="size-7 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 transition"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Setup Guide Card */}
          <CardBox className="p-4 space-y-2 bg-slate-50/60 dark:bg-slate-850/40 border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
              <HelpCircle className="size-4 text-blue-600 dark:text-blue-400" />
              <span>How to get Bot Token & Chat ID</span>
            </div>
            <p>
              1. Open Telegram and search for <b>@BotFather</b> to create a bot and copy your Token.
            </p>
            <p>
              2. Add your bot to your target Group or Channel as an administrator.
            </p>
            <p>
              3. Forward a message to <b>@RawDataBot</b> to find the numeric <b>Chat ID</b> (e.g. <code>-5443904638</code>).
            </p>
          </CardBox>
        </div>

        {/* Right Column: Chats for Selected Bot */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Alert Destination Chats
              </h2>
            </div>
            {selectedTokenId && (
              <button
                onClick={() => {
                  setEditingChat(null);
                  setChatLabel('');
                  setChatIdValue('');
                  setChatError(null);
                  setChatModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition"
              >
                <Plus className="size-3.5" />
                <span>Add Alert Chat</span>
              </button>
            )}
          </div>

          {!selectedTokenId ? (
            <CardBox className="text-center py-16 text-xs text-slate-400">
              Select a Telegram Bot from the left to configure its alert destination chats.
            </CardBox>
          ) : loadingChats ? (
            <CardBox className="flex h-48 items-center justify-center">
              <Loader2 className="size-8 animate-spin text-blue-600" />
            </CardBox>
          ) : chats.length === 0 ? (
            <CardBox className="text-center py-16 space-y-2">
              <MessageSquare className="mx-auto size-8 text-slate-300 dark:text-slate-700" />
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">No alert chats configured</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Add a destination chat ID to receive automated Netwatch UP/DOWN notifications.
              </p>
            </CardBox>
          ) : (
            <CardBox hasTable>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50/70 dark:bg-slate-850/50 border-b border-slate-100 dark:border-slate-800">
                    <tr>
                      <th className="px-6 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        Chat Label / Group
                      </th>
                      <th className="px-6 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        Telegram Chat ID
                      </th>
                      <th className="px-6 py-3.5 text-right text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        Actions & Live Test
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                    {chats.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="px-6 py-4 font-semibold text-slate-800 dark:text-slate-100">
                          {c.label}
                        </td>
                        <td className="px-6 py-4 font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">
                          {c.chat_id}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleTestChat(c.id)}
                              disabled={testingChatId === c.id}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition disabled:opacity-50 shadow-2xs"
                            >
                              {testingChatId === c.id ? (
                                <Loader2 className="size-3.5 animate-spin text-blue-600" />
                              ) : (
                                <Send className="size-3.5 text-blue-600 dark:text-blue-400" />
                              )}
                              <span>Send Test</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setEditingChat(c);
                                setChatLabel(c.label);
                                setChatIdValue(c.chat_id);
                                setChatError(null);
                                setChatModalOpen(true);
                              }}
                              className="size-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-amber-600 dark:hover:text-amber-400 transition"
                            >
                              <Edit className="size-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteChat(c.id)}
                              className="size-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 transition"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>

                          {testStatus?.id === c.id && (
                            <div className="mt-2 text-left">
                              {testStatus.success ? (
                                <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                                  <CheckCircle2 className="size-3.5" />
                                  <span>{testStatus.msg}</span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                                  <AlertCircle className="size-3.5" />
                                  <span>{testStatus.msg}</span>
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
        </div>
      </div>

      {/* Add / Edit Bot Token Modal */}
      {tokenModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {editingToken ? 'Edit Telegram Bot Token' : 'Connect Telegram Bot'}
              </h2>
              <button
                type="button"
                onClick={() => setTokenModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="size-5" />
              </button>
            </div>

            {editingToken && (
              <div className="mt-4 rounded-xl border border-blue-500/20 bg-blue-50/50 dark:bg-blue-950/30 p-3 text-xs text-blue-800 dark:text-blue-300">
                <p className="font-semibold">Automatic MikroTik Sync</p>
                <p className="mt-0.5">
                  Updating this bot token will automatically rewrite alert scripts for all Netwatch entries using it across your MikroTik routers.
                </p>
              </div>
            )}

            {tokenError && (
              <div className="mt-4 rounded-xl bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-400 flex items-start gap-2">
                <AlertCircle className="size-4 shrink-0 mt-0.5" />
                <span>{tokenError}</span>
              </div>
            )}

            <form onSubmit={handleSaveToken} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Friendly Label *</label>
                <input
                  type="text"
                  required
                  value={tokenLabel}
                  onChange={(e) => setTokenLabel(e.target.value)}
                  placeholder="NOC Alert Bot"
                  className="mt-1 block w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Bot Token {editingToken ? '(Leave blank to keep existing)' : '*'}
                </label>
                <input
                  type="password"
                  required={!editingToken}
                  value={tokenString}
                  onChange={(e) => setTokenString(e.target.value)}
                  placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                  className="mt-1 block w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setTokenModalOpen(false)}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={tokenLoading}
                  className="flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-2 text-xs font-semibold text-white shadow-xs disabled:opacity-60 transition"
                >
                  {tokenLoading && <Loader2 className="size-3.5 animate-spin" />}
                  <span>{editingToken ? 'Update & Sync' : 'Connect Bot'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Chat Modal */}
      {chatModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {editingChat ? 'Edit Alert Chat' : 'Add Destination Chat'}
              </h2>
              <button
                type="button"
                onClick={() => setChatModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="size-5" />
              </button>
            </div>

            {editingChat && (
              <div className="mt-4 rounded-xl border border-blue-500/20 bg-blue-50/50 dark:bg-blue-950/30 p-3 text-xs text-blue-800 dark:text-blue-300">
                <p className="font-semibold">Automatic MikroTik Sync</p>
                <p className="mt-0.5">
                  Updating this chat ID will update all Netwatch entries assigned to this chat on your MikroTik routers.
                </p>
              </div>
            )}

            {chatError && (
              <div className="mt-4 rounded-xl bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-400 flex items-start gap-2">
                <AlertCircle className="size-4 shrink-0 mt-0.5" />
                <span>{chatError}</span>
              </div>
            )}

            <form onSubmit={handleSaveChat} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Group / Channel Name *</label>
                <input
                  type="text"
                  required
                  value={chatLabel}
                  onChange={(e) => setChatLabel(e.target.value)}
                  placeholder="NOC Urgent Alerts"
                  className="mt-1 block w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Telegram Chat ID *</label>
                <input
                  type="text"
                  required
                  value={chatIdValue}
                  onChange={(e) => setChatIdValue(e.target.value)}
                  placeholder="-100123456789 or -5443904638"
                  className="mt-1 block w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setChatModalOpen(false)}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={chatLoading}
                  className="flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-2 text-xs font-semibold text-white shadow-xs disabled:opacity-60 transition"
                >
                  {chatLoading && <Loader2 className="size-3.5 animate-spin" />}
                  <span>{editingChat ? 'Save & Sync MikroTik' : 'Add Chat'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
