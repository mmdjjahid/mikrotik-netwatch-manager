import { getDb } from './db';

interface SettingRow {
  key: string;
  value: string;
  type: string;
  category: string;
  label: string;
  description: string;
}

let cache: SettingRow[] | null = null;
let cacheTime = 0;
const CACHE_TTL_MS = 20_000; // 20 seconds cache

export function getAllSettings(): SettingRow[] {
  if (cache && Date.now() - cacheTime < CACHE_TTL_MS) {
    return cache;
  }
  const db = getDb();
  const rows = db.prepare('SELECT * FROM settings ORDER BY category, key').all() as unknown as SettingRow[];
  cache = rows;
  cacheTime = Date.now();
  return rows;
}

export function getSetting<T = string>(key: string, fallback: T): T {
  const all = getAllSettings();
  const found = all.find((s) => s.key === key);
  if (!found) return fallback;

  switch (found.type) {
    case 'number': {
      const num = Number(found.value);
      return (isNaN(num) ? fallback : num) as unknown as T;
    }
    case 'boolean': {
      return (found.value.toLowerCase() === 'true') as unknown as T;
    }
    case 'json': {
      try {
        return JSON.parse(found.value) as T;
      } catch {
        return fallback;
      }
    }
    default:
      return found.value as unknown as T;
  }
}

export function updateSetting(key: string, value: string): void {
  const db = getDb();
  db.prepare('UPDATE settings SET value = ? WHERE key = ?').run(String(value), key);
  invalidateSettingsCache();
}

export function bulkUpdateSettings(settingsObj: Record<string, string>): void {
  const db = getDb();
  const stmt = db.prepare('UPDATE settings SET value = ? WHERE key = ?');
  for (const [key, val] of Object.entries(settingsObj)) {
    stmt.run(String(val), key);
  }
  invalidateSettingsCache();
}

export function invalidateSettingsCache(): void {
  cache = null;
  cacheTime = 0;
}

