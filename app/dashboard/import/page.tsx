'use client';

import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import {
  FileSpreadsheet,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Download,
  Check,
  X,
  Router as RouterIcon,
  Send,
  Eye,
} from 'lucide-react';
import { SectionTitleLineWithButton } from '@/components/admin-one/SectionTitleLineWithButton';
import { CardBox, CardBoxHeader } from '@/components/admin-one/CardBox';
import { CardBoxWidget } from '@/components/admin-one/CardBoxWidget';
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

interface ParsedRow {
  row: number;
  host: string;
  name: string;
  valid: boolean;
  reason?: string;
}

interface ImportReport {
  created: number;
  failed: number;
  total: number;
  results: Array<{
    row: number;
    host: string;
    name: string;
    status: 'created' | 'failed';
    error?: string;
  }>;
}

export default function ImportPage() {
  const [routers, setRouters] = useState<RouterItem[]>([]);
  const [selectedRouterId, setSelectedRouterId] = useState<number | null>(null);

  const [tokens, setTokens] = useState<TokenItem[]>([]);
  const [selectedTokenId, setSelectedTokenId] = useState<number | null>(null);

  const [chats, setChats] = useState<ChatItem[]>([]);
  const [selectedChats, setSelectedChats] = useState<string[]>([]);

  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    async function loadConfig() {
      try {
        const [rRes, tRes] = await Promise.all([fetch('/api/routers'), fetch('/api/tokens')]);
        const rData = await rRes.json();
        const tData = await tRes.json();

        const rList = rData.data || [];
        setRouters(rList);
        if (rList.length > 0) setSelectedRouterId(rList[0].id);

        const tList = tData.data || [];
        setTokens(tList);
        if (tList.length > 0) setSelectedTokenId(tList[0].id);
      } catch (err) {
        console.error(err);
      }
    }
    loadConfig();
  }, []);

  useEffect(() => {
    if (!selectedTokenId) {
      setChats([]);
      setSelectedChats([]);
      return;
    }
    fetch(`/api/tokens/${selectedTokenId}/chats`)
      .then((res) => res.json())
      .then((data) => {
        const list = data.data || [];
        setChats(list);
        setSelectedChats(list.map((c: ChatItem) => c.chat_id));
      })
      .catch(() => setChats([]));
  }, [selectedTokenId]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setReport(null);
    setErrorMsg(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);

        if (!data || data.length === 0) {
          setErrorMsg('The uploaded spreadsheet contains no rows.');
          setParsedRows([]);
          return;
        }

        const ipRegex =
          /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;

        const parsed: ParsedRow[] = data.map((row, idx) => {
          const hostVal = String(
            row['Host'] ||
              row['host'] ||
              row['IP'] ||
              row['ip'] ||
              row['IP Address'] ||
              row['Host IP'] ||
              ''
          ).trim();

          const nameVal = String(
            row['Name'] ||
              row['name'] ||
              row['Comment'] ||
              row['comment'] ||
              row['Description'] ||
              `Target ${hostVal}`
          ).trim();

          const isValid = Boolean(hostVal && ipRegex.test(hostVal) && nameVal);
          let reason: string | undefined;
          if (!hostVal) reason = 'Missing Host/IP';
          else if (!ipRegex.test(hostVal)) reason = 'Invalid IPv4 address format';
          else if (!nameVal) reason = 'Missing Name';

          return {
            row: idx + 2,
            host: hostVal,
            name: nameVal,
            valid: isValid,
            reason,
          };
        });

        setParsedRows(parsed);
      } catch (err) {
        setErrorMsg(`Failed to parse file: ${(err as Error).message}`);
        setParsedRows([]);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleDownloadSample = () => {
    const sampleData = [
      { Host: '192.168.1.10', Name: 'Primary Domain Controller' },
      { Host: '192.168.1.20', Name: 'Core Database Server' },
      { Host: '10.0.0.1', Name: 'Edge Firewall Gateway' },
      { Host: '8.8.8.8', Name: 'Google Public DNS' },
    ];
    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Netwatch');
    XLSX.writeFile(wb, 'netwatch-sample-import.xlsx');
  };

  const handleStartImport = async () => {
    if (!selectedRouterId) {
      alert('Please select a target MikroTik Router first.');
      return;
    }
    const validRows = parsedRows.filter((r) => r.valid);
    if (validRows.length === 0) {
      alert('No valid rows to import.');
      return;
    }

    setImporting(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/netwatch/${selectedRouterId}/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rows: validRows.map((r) => ({
            row: r.row,
            host: r.host,
            name: r.name,
          })),
          token_id: selectedTokenId || null,
          chat_ids: selectedChats,
          interval: '00:00:10',
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import failed');

      setReport(data);
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Admin One Header */}
      <SectionTitleLineWithButton
        icon={FileSpreadsheet}
        title="Excel / CSV Bulk Import"
        subtitle="Batch create Netwatch entries with auto-generated Telegram alert scripts from an Excel spreadsheet"
      >
        <button
          onClick={handleDownloadSample}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition shadow-2xs"
        >
          <Download className="size-4" />
          <span>Download Sample Excel</span>
        </button>
      </SectionTitleLineWithButton>

      {errorMsg && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/40 p-4 text-xs font-semibold text-rose-700 dark:text-rose-300">
          <AlertCircle className="size-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Target Configuration Card */}
      <CardBox className="p-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              1. Target MikroTik Router *
            </label>
            <select
              value={selectedRouterId || ''}
              onChange={(e) => setSelectedRouterId(Number(e.target.value))}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {routers.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.host})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              2. Telegram Bot *
            </label>
            <select
              value={selectedTokenId || ''}
              onChange={(e) => setSelectedTokenId(Number(e.target.value))}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {tokens.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label} (@{t.bot_username || 'bot'})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              3. Destination Channels *
            </label>
            {chats.length === 0 ? (
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5 text-xs text-slate-400">
                No chats under this bot.
              </div>
            ) : (
              <div className="max-h-24 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 space-y-1.5 bg-slate-50 dark:bg-slate-800/50">
                {chats.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 cursor-pointer text-xs">
                    <input
                      type="checkbox"
                      checked={selectedChats.includes(c.chat_id)}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedChats([...selectedChats, c.chat_id]);
                        else setSelectedChats(selectedChats.filter((id) => id !== c.chat_id));
                      }}
                      className="size-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{c.label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardBox>

      {/* Upload Zone */}
      <CardBox className="border-2 border-dashed border-slate-200 dark:border-slate-700 text-center py-12 hover:bg-slate-50/50 dark:hover:bg-slate-850/30 transition-colors">
        <UploadCloud className="mx-auto size-12 text-blue-600 dark:text-blue-400" />
        <h3 className="mt-3 text-sm font-bold text-slate-900 dark:text-white">Select or Drop Excel / CSV File</h3>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Columns supported: <code>Host</code> (or <code>IP</code>) and <code>Name</code> (or <code>Comment</code>)
        </p>

        <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-2 text-xs font-semibold text-white shadow-sm transition">
          <span>Choose File</span>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileUpload}
            className="hidden"
          />
        </label>
        {fileName && <p className="mt-3 text-xs font-mono text-blue-600 dark:text-blue-400 font-bold">{fileName}</p>}
      </CardBox>

      {/* Parsed Rows Preview */}
      {parsedRows.length > 0 && !report && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Preview Rows ({parsedRows.length})
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {parsedRows.filter((r) => r.valid).length} valid • {parsedRows.filter((r) => !r.valid).length} invalid
              </p>
            </div>
            <button
              onClick={handleStartImport}
              disabled={importing || parsedRows.filter((r) => r.valid).length === 0}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-2 text-xs font-semibold text-white shadow-sm transition disabled:opacity-60"
            >
              {importing ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
              <span>Start Batch Import</span>
            </button>
          </div>

          <CardBox hasTable className="max-h-80 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-5 py-3">Row</th>
                  <th className="px-5 py-3">Host IP</th>
                  <th className="px-5 py-3">Host Name</th>
                  <th className="px-5 py-3">Validation Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {parsedRows.map((r) => (
                  <tr key={r.row} className={r.valid ? 'hover:bg-slate-50/70 dark:hover:bg-slate-800/40' : 'bg-rose-50/20 dark:bg-rose-950/20'}>
                    <td className="px-5 py-3 font-mono text-slate-400">#{r.row}</td>
                    <td className="px-5 py-3 font-mono font-bold text-slate-900 dark:text-white">{r.host || '—'}</td>
                    <td className="px-5 py-3 font-semibold text-slate-800 dark:text-slate-200">{r.name}</td>
                    <td className="px-5 py-3">
                      {r.valid ? (
                        <PillTag label="Valid" type="success" dot />
                      ) : (
                        <PillTag label={r.reason || 'Invalid'} type="danger" dot />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBox>
        </div>
      )}

      {/* Import Report */}
      {report && (
        <div className="space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Import Summary
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <CardBoxWidget
              title="Total Processed"
              value={report.total}
              icon={FileSpreadsheet}
              color="blue"
            />
            <CardBoxWidget
              title="Created on MikroTik"
              value={report.created}
              icon={CheckCircle2}
              color="emerald"
            />
            <CardBoxWidget
              title="Failed Entries"
              value={report.failed}
              icon={AlertCircle}
              color="rose"
            />
          </div>

          <CardBox hasTable>
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-5 py-3">Row</th>
                  <th className="px-5 py-3">Host IP</th>
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">Outcome</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {report.results.map((res, i) => (
                  <tr key={i} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="px-5 py-3 font-mono text-slate-400">#{res.row}</td>
                    <td className="px-5 py-3 font-mono font-bold text-slate-900 dark:text-white">{res.host}</td>
                    <td className="px-5 py-3 font-semibold text-slate-800 dark:text-slate-200">{res.name}</td>
                    <td className="px-5 py-3">
                      {res.status === 'created' ? (
                        <PillTag label="Created & Synced" type="success" dot />
                      ) : (
                        <PillTag label={res.error || 'Failed'} type="danger" dot />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBox>
        </div>
      )}
    </div>
  );
}
