import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, writeFileSync, readFileSync, copyFileSync, unlinkSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { hashSync } from 'bcryptjs';

const DB_DIR = join(process.cwd(), 'data');
const DB_PATH = join(DB_DIR, 'netwatch.db');

let _db: DatabaseSync | null = null;

export const DEFAULT_SETTINGS = [
  // Security
  { key: 'security.max_login_attempts', value: '5', type: 'number', category: 'security', label: 'Max Login Attempts', description: 'Lock account after this many failures' },
  { key: 'security.lockout_minutes', value: '5', type: 'number', category: 'security', label: 'Lockout Duration (min)', description: 'How long a locked account stays locked' },
  { key: 'security.jwt_expiry_hours', value: '8', type: 'number', category: 'security', label: 'Session Expiry (hours)', description: 'Auto-logout after this many hours' },
  { key: 'security.password_min_length', value: '6', type: 'number', category: 'security', label: 'Min Password Length', description: 'Enforced on password change' },
  // Defaults
  { key: 'defaults.api_port', value: '8728', type: 'number', category: 'defaults', label: 'Default API Port', description: 'Pre-filled when adding a router' },
  { key: 'defaults.api_ssl_port', value: '8729', type: 'number', category: 'defaults', label: 'Default SSL Port', description: 'Pre-filled when SSL is on' },
  { key: 'defaults.netwatch_interval', value: '00:00:10', type: 'string', category: 'defaults', label: 'Netwatch Interval', description: 'Default check interval (hh:mm:ss)' },
  { key: 'defaults.netwatch_timeout', value: '1000ms', type: 'string', category: 'defaults', label: 'Netwatch Timeout', description: 'Default ping timeout' },
  { key: 'defaults.comment_prefix', value: 'TG|', type: 'string', category: 'defaults', label: 'Comment Prefix', description: 'Prefix on auto-generated comments' },
  // Branding
  { key: 'branding.app_name', value: 'Netwatch Manager', type: 'string', category: 'branding', label: 'Application Name', description: 'Header, login, and browser tab title' },
  { key: 'branding.app_logo_url', value: '', type: 'string', category: 'branding', label: 'Logo URL', description: 'Logo image URL (empty = text only)' },
  { key: 'branding.primary_color', value: '#2563eb', type: 'string', category: 'branding', label: 'Primary Color', description: 'Main accent color (hex)' },
  { key: 'branding.login_message', value: 'MikroTik Netwatch + Telegram Alert Manager', type: 'string', category: 'branding', label: 'Login Page Message', description: 'Custom text shown on login screen' },
  { key: 'branding.footer_text', value: 'Netwatch Manager Commercial Edition', type: 'string', category: 'branding', label: 'Footer Text', description: 'Custom footer text' },
  // UI
  { key: 'ui.page_size', value: '25', type: 'number', category: 'ui', label: 'Table Page Size', description: 'Default rows per page' },
  { key: 'ui.date_format', value: 'YYYY-MM-DD', type: 'string', category: 'ui', label: 'Date Format', description: 'Display format for dates' },
  { key: 'ui.time_format', value: 'HH:mm:ss', type: 'string', category: 'ui', label: 'Time Format', description: 'Display format for times' },
  { key: 'ui.show_dashboard_stats', value: 'true', type: 'boolean', category: 'ui', label: 'Show Dashboard Stats', description: 'Display statistics cards on dashboard' },
  { key: 'ui.enable_export', value: 'true', type: 'boolean', category: 'ui', label: 'Enable CSV Export', description: 'Allow exporting tables to CSV' },
];

export function getDb(): DatabaseSync {
  if (_db) return _db;
  mkdirSync(DB_DIR, { recursive: true });
  _db = new DatabaseSync(DB_PATH);
  _db.exec('PRAGMA journal_mode = WAL;');
  _db.exec('PRAGMA foreign_keys = ON;');
  _db.exec('PRAGMA busy_timeout = 5000;');
  migrate(_db);
  return _db;
}

export function closeDb(): void {
  if (_db) {
    try {
      _db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
    } catch {
      // ignore
    }
    try {
      _db.close();
    } catch {
      // ignore
    }
    _db = null;
  }
}

export function createDatabaseBackup(): Buffer {
  const db = getDb();
  // Ensure all WAL changes are fully checkpointed into the main database file
  db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
  return readFileSync(DB_PATH);
}

export function restoreDatabase(buffer: Buffer): { success: boolean } {
  // 1. Minimum SQLite header check
  if (buffer.length < 100) {
    throw new Error('Invalid backup file: file size is too small to be a SQLite database.');
  }

  const magic = buffer.subarray(0, 16).toString('utf8');
  if (!magic.startsWith('SQLite format 3')) {
    throw new Error('Invalid backup file: header does not match SQLite 3 format.');
  }

  mkdirSync(DB_DIR, { recursive: true });

  // 2. Validate integrity by opening a temporary test database
  const tempVerifyPath = join(DB_DIR, `temp_verify_${Date.now()}.db`);
  try {
    writeFileSync(tempVerifyPath, buffer);
    const testDb = new DatabaseSync(tempVerifyPath);
    try {
      const integrity = testDb.prepare('PRAGMA quick_check').get() as { quick_check?: string } | undefined;
      if (integrity?.quick_check !== 'ok') {
        throw new Error('Database integrity check failed: file appears corrupted.');
      }
    } finally {
      testDb.close();
      if (existsSync(tempVerifyPath)) unlinkSync(tempVerifyPath);
      if (existsSync(tempVerifyPath + '-wal')) unlinkSync(tempVerifyPath + '-wal');
      if (existsSync(tempVerifyPath + '-shm')) unlinkSync(tempVerifyPath + '-shm');
    }
  } catch (err) {
    if (existsSync(tempVerifyPath)) unlinkSync(tempVerifyPath);
    if (existsSync(tempVerifyPath + '-wal')) unlinkSync(tempVerifyPath + '-wal');
    if (existsSync(tempVerifyPath + '-shm')) unlinkSync(tempVerifyPath + '-shm');
    throw err;
  }

  // 3. Close currently active database connection
  closeDb();

  const walPath = DB_PATH + '-wal';
  const shmPath = DB_PATH + '-shm';

  // 4. Save safety copy of current database before replacing
  const preRestoreBackup = join(DB_DIR, `netwatch.pre_restore_${Date.now()}.db`);
  try {
    if (existsSync(DB_PATH)) {
      copyFileSync(DB_PATH, preRestoreBackup);
    }
  } catch (err) {
    console.warn('Could not create safety pre-restore backup:', err);
  }

  // 5. Delete existing WAL and SHM files
  // If not deleted, the old WAL logs will replay over the restored database or trigger WAL salt mismatch!
  try {
    if (existsSync(walPath)) unlinkSync(walPath);
    if (existsSync(shmPath)) unlinkSync(shmPath);
  } catch (err) {
    console.warn('Could not remove old WAL/SHM files:', err);
  }

  // 6. Overwrite main database file
  writeFileSync(DB_PATH, buffer);

  // 7. Re-initialize database singleton & auto-migrate/seed if tables are missing
  const restoredDb = getDb();
  migrate(restoredDb);
  restoredDb.exec('PRAGMA wal_checkpoint(TRUNCATE);');

  return { success: true };
}

function migrate(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY
    );
  `);

  const verRow = db.prepare('SELECT MAX(version) as v FROM schema_version').get() as { v: number | null } | undefined;
  const ver = verRow?.v || 0;

  if (ver < 1) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL DEFAULT '',
        type TEXT NOT NULL DEFAULT 'string',
        category TEXT NOT NULL DEFAULT 'general',
        label TEXT NOT NULL DEFAULT '',
        description TEXT NOT NULL DEFAULT ''
      );

      CREATE TABLE IF NOT EXISTS roles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        permissions TEXT NOT NULL DEFAULT '[]',
        description TEXT DEFAULT '',
        is_system INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'operator',
        must_change INTEGER NOT NULL DEFAULT 0,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS routers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        host TEXT UNIQUE NOT NULL,
        api_user TEXT NOT NULL DEFAULT 'admin',
        api_pass_enc TEXT,
        api_port INTEGER NOT NULL DEFAULT 8728,
        use_ssl INTEGER NOT NULL DEFAULT 0,
        note TEXT DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        label TEXT NOT NULL,
        token_enc TEXT NOT NULL,
        bot_username TEXT DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS chats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        token_id INTEGER NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
        label TEXT NOT NULL,
        chat_id TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS message_templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('up','down')),
        template TEXT NOT NULL,
        is_default INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS nw_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        router_id INTEGER NOT NULL REFERENCES routers(id) ON DELETE CASCADE,
        item_id TEXT,
        host TEXT NOT NULL,
        name TEXT NOT NULL,
        token_id INTEGER REFERENCES tokens(id) ON DELETE SET NULL,
        chat_ids TEXT DEFAULT '',
        enabled INTEGER NOT NULL DEFAULT 1,
        interval TEXT DEFAULT '',
        template_up_id INTEGER REFERENCES message_templates(id) ON DELETE SET NULL,
        template_down_id INTEGER REFERENCES message_templates(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user TEXT NOT NULL,
        action TEXT NOT NULL,
        detail TEXT DEFAULT '',
        ip_address TEXT DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      INSERT INTO schema_version VALUES (1);
    `);

    // Seed default roles
    const roles = [
      { name: 'admin', perms: '["*"]', desc: 'Full administrative access', sys: 1 },
      { name: 'operator', perms: '["routers.*","tokens.*","chats.*","netwatch.*","import.*","templates.read","logs.read","settings.read"]', desc: 'Manage routers, Telegram, and Netwatch', sys: 1 },
      { name: 'viewer', perms: '["routers.read","tokens.read","chats.read","netwatch.read","logs.read","templates.read","settings.read"]', desc: 'Read-only monitoring', sys: 1 },
    ];
    const insRole = db.prepare('INSERT OR IGNORE INTO roles (name, permissions, description, is_system) VALUES (?, ?, ?, ?)');
    for (const r of roles) {
      insRole.run(r.name, r.perms, r.desc, r.sys);
    }

    // Seed default admin
    const cntRow = db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number };
    if (cntRow.c === 0) {
      db.prepare('INSERT INTO users (username, password_hash, role, must_change) VALUES (?, ?, ?, ?)').run(
        'admin',
        hashSync('admin', 10),
        'admin',
        1
      );
    }

    // Seed default settings
    const insSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value, type, category, label, description) VALUES (?, ?, ?, ?, ?, ?)');
    for (const s of DEFAULT_SETTINGS) {
      insSetting.run(s.key, s.value, s.type, s.category, s.label, s.description);
    }

    // Seed default message templates
    const insTpl = db.prepare('INSERT OR IGNORE INTO message_templates (name, type, template, is_default) VALUES (?, ?, ?, ?)');
    insTpl.run(
      'Default UP Alert',
      'up',
      '✅ <b>{name}</b>\nHost: <code>{host}</code>\nRouter: {router}\nStatus: UP 🟢\nDate: {date}\nTime: {time}',
      1
    );
    insTpl.run(
      'Default DOWN Alert',
      'down',
      '🔴 <b>{name}</b>\nHost: <code>{host}</code>\nRouter: {router}\nStatus: DOWN 🔻\nDate: {date}\nTime: {time}',
      1
    );
  }
}

