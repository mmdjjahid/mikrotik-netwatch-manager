import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getDb, createDatabaseBackup, restoreDatabase } from '@/lib/db';
import {
  COOKIE_NAME,
  createSessionToken,
  getCurrentUser,
  hashPassword,
  verifyPassword,
  isAccountLocked,
  recordFailedLoginAttempt,
  clearFailedLoginAttempts,
} from '@/lib/auth';
import { encrypt, decrypt } from '@/lib/crypto';
import { requirePermission } from '@/lib/permissions';
import {
  jsonSuccess,
  jsonError,
  parseQueryParams,
  queryList,
  exportCsv,
  recordActivityLog,
} from '@/lib/api-helpers';
import {
  withRouter,
  testRouterConnection,
  friendlyRouterError,
  RouterRecord,
} from '@/lib/ros';
import { verifyBotToken, sendTelegramTestMessage } from '@/lib/telegram';
import { buildNetwatchScripts } from '@/lib/script';
import { getAllSettings, updateSetting, bulkUpdateSettings } from '@/lib/settings';
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';

// Helper to get client IP for logs
function getClientIp(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    req.headers.get('x-real-ip') ||
    '127.0.0.1'
  );
}

// Helper to parse metadata from router scripts
function parseRouterNetwatchEntry(
  entry: Record<string, any>,
  existingTokens: Array<{ id: number; token_enc: string; label: string; bot_username?: string }>
) {
  const host = String(entry.host || '').trim();
  const itemId = String(entry['.id'] || '').trim();
  const status = String(entry.status || 'unknown').toLowerCase();
  const since = String(entry.since || '').trim();
  const type = String(entry.type || 'simple').trim();
  const interval = String(entry.interval || '00:00:10').trim();
  const timeout = String(entry.timeout || '1000ms').trim();
  const disabled = entry.disabled === 'true' || entry.disabled === true;
  const enabled = disabled ? 0 : 1;
  const doneTests = parseInt(entry['done-tests'] || '0', 10);
  const failedTests = parseInt(entry['failed-tests'] || '0', 10);
  const rawComment = String(entry.comment || '').trim();
  const upScript = String(entry['up-script'] || '').trim();
  const downScript = String(entry['down-script'] || '').trim();
  const combinedScripts = `${upScript}\n${downScript}`;

  // 1. Extract Name:
  let name = '';
  if (rawComment.startsWith('TG|')) {
    name = rawComment.slice(3).trim();
  } else if (rawComment.length > 0) {
    name = rawComment;
  }

  if (!name) {
    const nameMatch = combinedScripts.match(/:local\s+name\s+"([^"]+)"/i) ||
                      combinedScripts.match(/name="([^"]+)"/i) ||
                      combinedScripts.match(/<b>([^<]+)<\/b>/i);
    if (nameMatch) {
      name = nameMatch[1].trim();
    }
  }

  if (!name) {
    name = host;
  }

  // 2. Extract Bot Token:
  let botToken = '';
  const tokenMatch = combinedScripts.match(/:local\s+botToken\s+"([^"]+)"/i) ||
                     combinedScripts.match(/api\.telegram\.org\/bot([0-9]{8,12}:[a-zA-Z0-9_-]+)/i);
  if (tokenMatch) {
    botToken = tokenMatch[1].trim();
  }

  // Match tokenId from existingTokens
  let matchedTokenId: number | null = null;
  let matchedTokenLabel = '';
  let matchedBotUsername = '';
  if (botToken) {
    for (const t of existingTokens) {
      try {
        if (decrypt(t.token_enc) === botToken) {
          matchedTokenId = t.id;
          matchedTokenLabel = t.label;
          matchedBotUsername = t.bot_username || '';
          break;
        }
      } catch {
        // ignore decryption failure
      }
    }
  }

  // 3. Extract Chat IDs:
  const chatIds: string[] = [];
  const chatMatch1 = combinedScripts.match(/:local\s+chatID\s+"([^"]+)"/i);
  if (chatMatch1) {
    const id = chatMatch1[1].trim();
    if (id && !chatIds.includes(id)) chatIds.push(id);
  }
  const chatRegex = /chat_id=([0-9-]+)/gi;
  let m: RegExpExecArray | null = null;
  while ((m = chatRegex.exec(combinedScripts)) !== null) {
    const id = m[1]?.trim();
    if (id && !chatIds.includes(id)) chatIds.push(id);
  }

  return {
    itemId,
    host,
    name,
    status,
    since,
    type,
    interval,
    timeout,
    disabled,
    enabled,
    doneTests,
    failedTests,
    botToken,
    tokenId: matchedTokenId,
    tokenLabel: matchedTokenLabel,
    botUsername: matchedBotUsername,
    chatIds: chatIds.join(','),
    comment: rawComment,
    upScript,
    downScript,
  };
}

async function syncAndGetNetwatchList(db: any, router: RouterRecord) {
  let routerEntries: Record<string, any>[] = [];
  let isOnline = false;
  let routerError: string | null = null;

  try {
    routerEntries = (await withRouter(router, async (conn) => {
      return await conn.write('/tool/netwatch/print');
    })) as Record<string, any>[];
    isOnline = true;
  } catch (err) {
    isOnline = false;
    routerError = friendlyRouterError(err);
    console.warn(`Could not connect to router ${router.name} (${router.host}):`, routerError);
  }

  const existingTokens = db.prepare('SELECT id, token_enc, label, bot_username FROM tokens').all() as Array<{
    id: number;
    token_enc: string;
    label: string;
    bot_username?: string;
  }>;

  if (isOnline) {
    const currentNw = db.prepare('SELECT * FROM nw_records WHERE router_id = ?').all(router.id) as Array<{
      id: number;
      item_id: string;
      host: string;
      name: string;
      token_id: number | null;
      chat_ids: string;
      enabled: number;
      interval: string;
    }>;

    const routerHosts = new Set<string>();
    const routerItemIds = new Set<string>();

    const updateStmt = db.prepare(`
      UPDATE nw_records SET
        item_id = ?,
        host = ?,
        name = CASE WHEN (name IS NULL OR name = '' OR name = host) AND ? != '' THEN ? ELSE name END,
        token_id = COALESCE(token_id, ?),
        chat_ids = CASE WHEN (chat_ids IS NULL OR chat_ids = '') AND ? != '' THEN ? ELSE chat_ids END,
        enabled = ?,
        interval = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `);

    const insertStmt = db.prepare(`
      INSERT INTO nw_records
        (router_id, item_id, host, name, token_id, chat_ids, enabled, interval, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `);

    for (const rawEntry of routerEntries) {
      const parsed = parseRouterNetwatchEntry(rawEntry, existingTokens);
      routerHosts.add(parsed.host);
      if (parsed.itemId) routerItemIds.add(parsed.itemId);

      const existing = currentNw.find(
        (loc) => (parsed.itemId && loc.item_id === parsed.itemId) || loc.host === parsed.host
      );

      if (existing) {
        updateStmt.run(
          parsed.itemId,
          parsed.host,
          parsed.name,
          parsed.name,
          parsed.tokenId,
          parsed.chatIds,
          parsed.chatIds,
          parsed.enabled,
          parsed.interval,
          existing.id
        );
      } else {
        insertStmt.run(
          router.id,
          parsed.itemId,
          parsed.host,
          parsed.name,
          parsed.tokenId,
          parsed.chatIds,
          parsed.enabled,
          parsed.interval
        );
      }
    }

    // Clean up local records that were deleted on the router
    const deleteStmt = db.prepare('DELETE FROM nw_records WHERE id = ?');
    for (const loc of currentNw) {
      const stillOnRouter =
        (loc.item_id && routerItemIds.has(loc.item_id)) || routerHosts.has(loc.host);
      if (!stillOnRouter) {
        deleteStmt.run(loc.id);
      }
    }
  }

  // Load all updated records from SQLite
  const rows = db
    .prepare(
      `SELECT nw.*, t.label as token_label, t.bot_username
       FROM nw_records nw
       LEFT JOIN tokens t ON t.id = nw.token_id
       WHERE nw.router_id = ?
       ORDER BY nw.id DESC`
    )
    .all(router.id) as any[];

  if (isOnline) {
    const parsedMap = new Map<string, ReturnType<typeof parseRouterNetwatchEntry>>();
    for (const raw of routerEntries) {
      const p = parseRouterNetwatchEntry(raw, existingTokens);
      if (p.itemId) parsedMap.set(p.itemId, p);
      parsedMap.set(p.host, p);
    }

    for (const r of rows) {
      const live = (r.item_id && parsedMap.get(r.item_id)) || parsedMap.get(r.host);
      if (live) {
        r.status = live.status;
        r.since = live.since;
        r.done_tests = live.doneTests;
        r.failed_tests = live.failedTests;
        r.type = live.type;
        r.comment = live.comment;
        r.up_script = live.upScript;
        r.down_script = live.downScript;
        r.router_online = true;
      } else {
        r.status = 'unknown';
        r.router_online = true;
      }
    }
  } else {
    for (const r of rows) {
      r.status = 'offline';
      r.router_online = false;
    }
  }

  return {
    rows,
    router_online: isOnline,
    router_error: routerError,
    total_on_router: routerEntries.length,
  };
}

// Global API Request Handler
async function handleRequest(req: Request, { params }: { params: { p?: string[] } }) {
  const p = params.p || [];
  const method = req.method.toUpperCase();
  const ip = getClientIp(req);
  const db = getDb();

  try {
    // ==========================================
    // 1. PUBLIC ROUTES (No Auth Required)
    // ==========================================

    // POST /api/login
    if (p[0] === 'login' && method === 'POST') {
      const body = await req.json().catch(() => ({}));
      const username = String(body.username || '').trim();
      const password = String(body.password || '');

      if (!username || !password) {
        return jsonError('Username and password are required.', 400);
      }

      // Check lockout
      const lockStatus = isAccountLocked(username);
      if (lockStatus.locked) {
        return jsonError(
          `Account is temporarily locked. Please try again in ${lockStatus.remainingSeconds} seconds.`,
          429
        );
      }

      const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as
        | {
            id: number;
            username: string;
            password_hash: string;
            role: string;
            must_change: number;
            is_active: number;
          }
        | undefined;

      if (!user || user.is_active === 0 || !verifyPassword(password, user.password_hash)) {
        const attemptResult = recordFailedLoginAttempt(username);
        recordActivityLog(username, 'LOGIN_FAILED', 'Invalid credentials or inactive account', ip);

        if (attemptResult.locked) {
          return jsonError('Too many failed attempts. Account locked for 5 minutes.', 429);
        }
        return jsonError(
          `Invalid username or password. ${attemptResult.attemptsLeft} attempt(s) remaining.`,
          401
        );
      }

      clearFailedLoginAttempts(username);

      const token = await createSessionToken({
        id: user.id,
        username: user.username,
        role: user.role,
        must_change: user.must_change,
      });

      // Secure cookie handling:
      // Chrome/Firefox refuse to store a cookie if 'Secure' is true over an unencrypted HTTP origin (e.g. http://172.16.17.3:3001).
      // We detect if request is actually over HTTPS (direct or via X-Forwarded-Proto header) or explicitly forced.
      const forwardedProto = req.headers.get('x-forwarded-proto');
      const isHttps = forwardedProto
        ? forwardedProto.toLowerCase() === 'https'
        : req.url.startsWith('https://');
      const secureFlag =
        process.env.COOKIE_SECURE === 'true'
          ? true
          : process.env.COOKIE_SECURE === 'false'
          ? false
          : isHttps;

      const cookieStore = await cookies();
      cookieStore.set(COOKIE_NAME, token, {
        httpOnly: true,
        secure: secureFlag,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7,
      });

      recordActivityLog(user.username, 'LOGIN_SUCCESS', 'Logged in successfully', ip);

      const res = jsonSuccess({
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          must_change: user.must_change,
        },
      });

      res.cookies.set(COOKIE_NAME, token, {
        httpOnly: true,
        secure: secureFlag,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7,
      });

      return res;
    }

    // POST /api/logout
    if (p[0] === 'logout') {
      const cookieStore = await cookies();
      cookieStore.delete(COOKIE_NAME);
      const res = jsonSuccess({ message: 'Logged out successfully' });
      res.cookies.delete(COOKIE_NAME);
      return res;
    }

    // GET /api/branding (Public so login page can display dynamic title, logo & message)
    if (p[0] === 'branding' && method === 'GET') {
      const settings = getAllSettings().filter((s) => s.category === 'branding');
      const brandingObj = settings.reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {});
      return jsonSuccess(brandingObj);
    }

    // ==========================================
    // 2. AUTH GUARD (All routes below require JWT)
    // ==========================================
    const user = await getCurrentUser();
    if (!user) {
      return jsonError('Authentication required. Please log in.', 401);
    }

    // GET /api/me
    if (p[0] === 'me' && method === 'GET') {
      const dbUser = db.prepare('SELECT id, username, role, must_change, is_active FROM users WHERE id = ?').get(user.id) as {
        id: number;
        username: string;
        role: string;
        must_change: number;
        is_active: number;
      };
      if (!dbUser || dbUser.is_active === 0) {
        return jsonError('Account is no longer active.', 401);
      }
      return jsonSuccess(dbUser);
    }

    // POST /api/change-password
    if (p[0] === 'change-password' && method === 'POST') {
      const body = await req.json().catch(() => ({}));
      const { oldPassword, newPassword } = body;

      if (!newPassword || newPassword.length < 6) {
        return jsonError('New password must be at least 6 characters long.', 400);
      }

      const curr = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(user.id) as { password_hash: string };
      if (!verifyPassword(oldPassword || '', curr.password_hash)) {
        return jsonError('Incorrect current password.', 400);
      }

      const newHash = hashPassword(newPassword);
      db.prepare("UPDATE users SET password_hash = ?, must_change = 0, updated_at = datetime('now') WHERE id = ?").run(newHash, user.id);
      recordActivityLog(user.username, 'PASSWORD_CHANGE', 'Password updated successfully', ip);

      return jsonSuccess({ message: 'Password updated successfully.' });
    }

    // ==========================================
    // 3. ROUTERS CRUD & OPERATIONS
    // ==========================================
    if (p[0] === 'routers') {
      // Export CSV
      if (p[1] === 'export' && method === 'GET') {
        requirePermission(user, 'routers.read');
        const rows = db.prepare('SELECT id, name, host, api_user, api_port, use_ssl, note, created_at FROM routers').all() as Record<string, unknown>[];
        const csv = exportCsv(rows, ['id', 'name', 'host', 'api_user', 'api_port', 'use_ssl', 'note', 'created_at']);
        return new NextResponse(csv, {
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': 'attachment; filename="routers.csv"',
          },
        });
      }

      // Test connection by ID: POST /api/routers/:id/test
      if (p[1] && p[2] === 'test' && method === 'POST') {
        requirePermission(user, 'routers.test');
        const routerId = parseInt(p[1], 10);
        const router = db.prepare('SELECT * FROM routers WHERE id = ?').get(routerId) as RouterRecord | undefined;
        if (!router) return jsonError('Router not found.', 404);

        const info = await testRouterConnection(router);
        recordActivityLog(user.username, 'ROUTER_TEST_SUCCESS', `Tested router ${router.name} (${router.host})`, ip);
        return jsonSuccess(info);
      }

      // Test connection with ad-hoc credentials (before saving): POST /api/routers/test-ad-hoc
      if (p[1] === 'test-ad-hoc' && method === 'POST') {
        requirePermission(user, 'routers.test');
        const body = await req.json().catch(() => ({}));
        const info = await testRouterConnection({
          name: body.name || 'Test',
          host: body.host,
          api_user: body.api_user || 'admin',
          api_password: body.api_password || '',
          api_port: Number(body.api_port) || 8728,
          use_ssl: Number(body.use_ssl) || 0,
        });
        return jsonSuccess(info);
      }

      // Bulk actions: POST /api/routers/bulk
      if (p[1] === 'bulk' && method === 'POST') {
        const { action, ids } = await req.json();
        if (action === 'delete') {
          requirePermission(user, 'routers.delete');
          const delStmt = db.prepare('DELETE FROM routers WHERE id = ?');
          for (const id of ids) delStmt.run(id);
          recordActivityLog(user.username, 'ROUTERS_BULK_DELETE', `Deleted routers: ${ids.join(', ')}`, ip);
          return jsonSuccess({ message: `Deleted ${ids.length} router(s)` });
        }
        return jsonError('Unknown bulk action', 400);
      }

      // Single Router operations
      const routerId = p[1] ? parseInt(p[1], 10) : null;

      // GET /api/routers
      if (!routerId && method === 'GET') {
        requirePermission(user, 'routers.read');
        const queryOpts = parseQueryParams(req);
        const result = queryList('routers', {
          ...queryOpts,
          searchFields: ['name', 'host', 'note'],
        });
        // Sanitize: do not send encrypted passwords to client
        const safeData = (result.data as unknown as RouterRecord[]).map(({ api_pass_enc, ...rest }) => ({
          ...rest,
          has_password: Boolean(api_pass_enc),
        }));
        return jsonSuccess({ ...result, data: safeData });
      }

      // POST /api/routers
      if (!routerId && method === 'POST') {
        requirePermission(user, 'routers.create');
        const body = await req.json();
        const { name, host, api_user, api_pass, api_port, use_ssl, note } = body;

        if (!name || !host) {
          return jsonError('Router Name and Host IP are required.', 400);
        }

        const passEnc = api_pass ? encrypt(api_pass) : null;
        const res = db
          .prepare(
            'INSERT INTO routers (name, host, api_user, api_pass_enc, api_port, use_ssl, note) VALUES (?, ?, ?, ?, ?, ?, ?)'
          )
          .run(name.trim(), host.trim(), (api_user || 'admin').trim(), passEnc, Number(api_port) || 8728, Number(use_ssl) || 0, (note || '').trim());

        recordActivityLog(user.username, 'ROUTER_CREATE', `Created router ${name} (${host})`, ip);
        return jsonSuccess({ id: res.lastInsertRowid, message: 'Router added successfully.' });
      }

      // GET /api/routers/:id
      if (routerId && method === 'GET') {
        requirePermission(user, 'routers.read');
        const router = db.prepare('SELECT * FROM routers WHERE id = ?').get(routerId) as RouterRecord | undefined;
        if (!router) return jsonError('Router not found.', 404);
        const { api_pass_enc, ...safe } = router;
        return jsonSuccess({ ...safe, has_password: Boolean(api_pass_enc) });
      }

      // PUT /api/routers/:id
      if (routerId && method === 'PUT') {
        requirePermission(user, 'routers.update');
        const body = await req.json();
        const { name, host, api_user, api_pass, api_port, use_ssl, note } = body;

        const current = db.prepare('SELECT * FROM routers WHERE id = ?').get(routerId) as RouterRecord | undefined;
        if (!current) return jsonError('Router not found.', 404);

        const passEnc = api_pass ? encrypt(api_pass) : current.api_pass_enc;

        db.prepare(
          "UPDATE routers SET name = ?, host = ?, api_user = ?, api_pass_enc = ?, api_port = ?, use_ssl = ?, note = ?, updated_at = datetime('now') WHERE id = ?"
        ).run(
          name !== undefined ? name.trim() : current.name,
          host !== undefined ? host.trim() : current.host,
          api_user !== undefined ? api_user.trim() : current.api_user,
          passEnc || null,
          api_port !== undefined ? Number(api_port) : current.api_port,
          use_ssl !== undefined ? Number(use_ssl) : current.use_ssl,
          note !== undefined ? note.trim() : current.note,
          routerId
        );

        recordActivityLog(user.username, 'ROUTER_UPDATE', `Updated router id ${routerId}`, ip);
        return jsonSuccess({ message: 'Router updated successfully.' });
      }

      // DELETE /api/routers/:id
      if (routerId && method === 'DELETE') {
        requirePermission(user, 'routers.delete');
        db.prepare('DELETE FROM routers WHERE id = ?').run(routerId);
        recordActivityLog(user.username, 'ROUTER_DELETE', `Deleted router id ${routerId}`, ip);
        return jsonSuccess({ message: 'Router deleted successfully.' });
      }
    }

    // ==========================================
    // 4. TELEGRAM TOKENS & CHATS
    // ==========================================
    if (p[0] === 'tokens') {
      const tokenId = p[1] ? parseInt(p[1], 10) : null;

      // GET /api/tokens/:id/chats
      if (tokenId && p[2] === 'chats' && method === 'GET') {
        requirePermission(user, 'chats.read');
        const rows = db.prepare('SELECT * FROM chats WHERE token_id = ? ORDER BY id DESC').all(tokenId);
        return jsonSuccess({ data: rows });
      }

      // POST /api/tokens/:id/chats
      if (tokenId && p[2] === 'chats' && method === 'POST') {
        requirePermission(user, 'chats.create');
        const body = await req.json();
        const { label, chat_id } = body;
        if (!label || !chat_id) return jsonError('Label and Chat ID are required.', 400);

        const res = db.prepare('INSERT INTO chats (token_id, label, chat_id) VALUES (?, ?, ?)').run(tokenId, label.trim(), String(chat_id).trim());
        recordActivityLog(user.username, 'CHAT_ADD', `Added chat ${label} (${chat_id})`, ip);
        return jsonSuccess({ id: res.lastInsertRowid, message: 'Chat added successfully.' });
      }

      // POST /api/tokens/:id/verify
      if (tokenId && p[2] === 'verify' && method === 'POST') {
        requirePermission(user, 'tokens.read');
        const tokenRow = db.prepare('SELECT token_enc FROM tokens WHERE id = ?').get(tokenId) as { token_enc: string } | undefined;
        if (!tokenRow) return jsonError('Token not found.', 404);

        const botInfo = await verifyBotToken(tokenRow.token_enc);
        db.prepare("UPDATE tokens SET bot_username = ?, updated_at = datetime('now') WHERE id = ?").run(botInfo.username, tokenId);
        return jsonSuccess({ ...botInfo, message: 'Token verified successfully.' });
      }

      // GET /api/tokens
      if (!tokenId && method === 'GET') {
        requirePermission(user, 'tokens.read');
        const tokens = db
          .prepare(
            `SELECT t.id, t.label, t.bot_username, t.created_at, t.updated_at,
             COUNT(c.id) as chats_count
             FROM tokens t
             LEFT JOIN chats c ON c.token_id = t.id
             GROUP BY t.id
             ORDER BY t.id DESC`
          )
          .all();
        return jsonSuccess({ data: tokens });
      }

      // POST /api/tokens
      if (!tokenId && method === 'POST') {
        requirePermission(user, 'tokens.create');
        const body = await req.json();
        const { label, token } = body;
        if (!label || !token) return jsonError('Label and Bot Token are required.', 400);

        // Verify token with Telegram first
        const botInfo = await verifyBotToken(token.trim());
        const enc = encrypt(token.trim());

        const res = db
          .prepare('INSERT INTO tokens (label, token_enc, bot_username) VALUES (?, ?, ?)')
          .run(label.trim(), enc, botInfo.username);

        recordActivityLog(user.username, 'TOKEN_ADD', `Added token ${label} (@${botInfo.username})`, ip);
        return jsonSuccess({
          id: res.lastInsertRowid,
          bot_username: botInfo.username,
          message: `Bot @${botInfo.username} connected successfully.`,
        });
      }

      // GET /api/tokens/:id
      if (tokenId && method === 'GET') {
        requirePermission(user, 'tokens.read');
        const tokenRow = db.prepare('SELECT id, label, bot_username, token_enc, created_at FROM tokens WHERE id = ?').get(tokenId) as {
          id: number;
          label: string;
          bot_username: string;
          token_enc: string;
          created_at: string;
        } | undefined;

        if (!tokenRow) return jsonError('Token not found', 404);

        let plain = '';
        try {
          plain = decrypt(tokenRow.token_enc);
        } catch {}

        const resultObj = {
          id: tokenRow.id,
          label: tokenRow.label,
          bot_username: tokenRow.bot_username,
          token: plain,
          created_at: tokenRow.created_at,
        };

        return jsonSuccess({
          data: resultObj,
          ...resultObj,
        });
      }

      // PUT /api/tokens/:id
      if (tokenId && method === 'PUT') {
        requirePermission(user, 'tokens.update');
        const body = await req.json();
        const label = String(body.label || '').trim();
        const rawToken = body.token !== undefined ? String(body.token).trim() : '';

        if (!label) return jsonError('Label is required', 400);

        const currentToken = db.prepare('SELECT * FROM tokens WHERE id = ?').get(tokenId) as
          | { id: number; label: string; token_enc: string; bot_username: string }
          | undefined;

        if (!currentToken) return jsonError('Token not found', 404);

        let currentPlain = '';
        try {
          currentPlain = decrypt(currentToken.token_enc);
        } catch {}

        let finalEnc = currentToken.token_enc;
        let finalUsername = currentToken.bot_username;
        let effectiveToken = currentPlain;

        if (rawToken && rawToken !== currentPlain) {
          // New token provided: verify with Telegram API first
          const botInfo = await verifyBotToken(rawToken);
          finalEnc = encrypt(rawToken);
          finalUsername = botInfo.username;
          effectiveToken = rawToken;
        }

        db.prepare(
          "UPDATE tokens SET label = ?, token_enc = ?, bot_username = ?, updated_at = datetime('now') WHERE id = ?"
        ).run(label, finalEnc, finalUsername, tokenId);

        // Propagate updated token & scripts to all MikroTik routers using this bot!
        const affectedRecords = db
          .prepare(
            `SELECT nw.*, r.id as r_id, r.name as router_name, r.host as router_host,
                    r.api_user, r.api_pass_enc, r.api_port, r.use_ssl
             FROM nw_records nw
             JOIN routers r ON r.id = nw.router_id
             WHERE nw.token_id = ?`
          )
          .all(tokenId) as any[];

        // Group records by router
        const recordsByRouter = new Map<number, { router: RouterRecord; records: any[] }>();
        for (const row of affectedRecords) {
          if (!recordsByRouter.has(row.r_id)) {
            recordsByRouter.set(row.r_id, {
              router: {
                id: row.r_id,
                name: row.router_name,
                host: row.router_host,
                api_user: row.api_user,
                api_pass_enc: row.api_pass_enc,
                api_port: row.api_port,
                use_ssl: row.use_ssl,
              },
              records: [],
            });
          }
          recordsByRouter.get(row.r_id)!.records.push(row);
        }

        let updatedEntriesCount = 0;
        let updatedRoutersCount = 0;
        const routerSyncErrors: string[] = [];

        for (const group of Array.from(recordsByRouter.values())) {
          try {
            await withRouter(group.router, async (conn) => {
              for (const rec of group.records) {
                const chatIdsArray = (rec.chat_ids || '')
                  .split(',')
                  .map((s: string) => s.trim())
                  .filter(Boolean);

                const scripts = buildNetwatchScripts({
                  name: rec.name,
                  host: rec.host,
                  tokenOrEnc: effectiveToken,
                  chatIds: chatIdsArray,
                  routerName: group.router.name,
                  templateUpId: rec.template_up_id,
                  templateDownId: rec.template_down_id,
                  interval: rec.interval,
                });

                if (rec.item_id) {
                  try {
                    await conn.write('/tool/netwatch/set', [
                      `=.id=${rec.item_id}`,
                      `=interval=${scripts.interval}`,
                      `=comment=${scripts.comment}`,
                      `=up-script=${scripts.upScript}`,
                      `=down-script=${scripts.downScript}`,
                    ]);
                    updatedEntriesCount++;
                  } catch (itemErr) {
                    console.warn(`Could not update item ${rec.item_id} on router ${group.router.name}:`, itemErr);
                  }
                }
              }
            });
            updatedRoutersCount++;
          } catch (routerErr) {
            const errStr = friendlyRouterError(routerErr);
            routerSyncErrors.push(`${group.router.name}: ${errStr}`);
          }
        }

        recordActivityLog(
          user.username,
          'TOKEN_UPDATE',
          `Updated token ${label} (@${finalUsername}). Synchronized ${updatedEntriesCount} Netwatch entries across ${updatedRoutersCount} router(s) on MikroTik.`,
          ip
        );

        let message = `Token updated (@${finalUsername}).`;
        if (updatedEntriesCount > 0) {
          message += ` Automatically updated ${updatedEntriesCount} Netwatch entry(ies) across ${updatedRoutersCount} router(s) on MikroTik.`;
        }
        if (routerSyncErrors.length > 0) {
          message += ` (Router warnings: ${routerSyncErrors.join('; ')})`;
        }

        return jsonSuccess({
          message,
          bot_username: finalUsername,
          updated_entries: updatedEntriesCount,
          updated_routers: updatedRoutersCount,
        });
      }

      // DELETE /api/tokens/:id
      if (tokenId && method === 'DELETE') {
        requirePermission(user, 'tokens.delete');
        db.prepare('DELETE FROM tokens WHERE id = ?').run(tokenId);
        recordActivityLog(user.username, 'TOKEN_DELETE', `Deleted token id ${tokenId}`, ip);
        return jsonSuccess({ message: 'Token deleted.' });
      }
    }

    // Chats standalone operations: PUT, DELETE, and TEST
    if (p[0] === 'chats') {
      const chatId = p[1] ? parseInt(p[1], 10) : null;

      // POST /api/chats/:id/test
      if (chatId && p[2] === 'test' && method === 'POST') {
        requirePermission(user, 'chats.test');
        const chat = db
          .prepare(
            `SELECT c.chat_id, t.token_enc
             FROM chats c
             JOIN tokens t ON t.id = c.token_id
             WHERE c.id = ?`
          )
          .get(chatId) as { chat_id: string; token_enc: string } | undefined;

        if (!chat) return jsonError('Chat or associated token not found.', 404);

        await sendTelegramTestMessage(chat.token_enc, chat.chat_id);
        recordActivityLog(user.username, 'CHAT_TEST', `Sent test message to chat ${chat.chat_id}`, ip);
        return jsonSuccess({ message: 'Test message sent successfully!' });
      }

      // PUT /api/chats/:id
      if (chatId && method === 'PUT') {
        requirePermission(user, 'chats.update');
        const body = await req.json();
        const label = String(body.label || '').trim();
        const newChatId = String(body.chat_id || '').trim();

        if (!label || !newChatId) return jsonError('Label and Chat ID are required.', 400);

        const currentChat = db
          .prepare(
            `SELECT c.*, t.token_enc
             FROM chats c
             JOIN tokens t ON t.id = c.token_id
             WHERE c.id = ?`
          )
          .get(chatId) as
          | { id: number; token_id: number; label: string; chat_id: string; token_enc: string }
          | undefined;

        if (!currentChat) return jsonError('Chat not found.', 404);

        const oldChatId = currentChat.chat_id;
        const chatIdChanged = oldChatId !== newChatId;

        db.prepare('UPDATE chats SET label = ?, chat_id = ? WHERE id = ?').run(label, newChatId, chatId);

        let updatedEntriesCount = 0;
        let updatedRoutersCount = 0;
        const routerSyncErrors: string[] = [];

        // If the chat_id changed, propagate change across all nw_records and MikroTik routers!
        if (chatIdChanged) {
          // Find all Netwatch records that have oldChatId in their chat_ids
          const affectedRecords = db
            .prepare(
              `SELECT nw.*, r.id as r_id, r.name as router_name, r.host as router_host,
                      r.api_user, r.api_pass_enc, r.api_port, r.use_ssl,
                      t.token_enc
               FROM nw_records nw
               JOIN routers r ON r.id = nw.router_id
               LEFT JOIN tokens t ON t.id = nw.token_id
               WHERE nw.chat_ids LIKE '%' || ? || '%'`
            )
            .all(oldChatId) as any[];

          // Update local nw_records in SQLite
          for (const rec of affectedRecords) {
            const currentIds = (rec.chat_ids || '').split(',').map((s: string) => s.trim()).filter(Boolean);
            const replacedIds = currentIds.map((id: string) => (id === oldChatId ? newChatId : id));
            const uniqueIds = Array.from(new Set(replacedIds));
            rec.chat_ids = uniqueIds.join(',');
            db.prepare("UPDATE nw_records SET chat_ids = ?, updated_at = datetime('now') WHERE id = ?").run(
              rec.chat_ids,
              rec.id
            );
          }

          // Group by router
          const recordsByRouter = new Map<number, { router: RouterRecord; records: any[] }>();
          for (const row of affectedRecords) {
            if (!recordsByRouter.has(row.r_id)) {
              recordsByRouter.set(row.r_id, {
                router: {
                  id: row.r_id,
                  name: row.router_name,
                  host: row.router_host,
                  api_user: row.api_user,
                  api_pass_enc: row.api_pass_enc,
                  api_port: row.api_port,
                  use_ssl: row.use_ssl,
                },
                records: [],
              });
            }
            recordsByRouter.get(row.r_id)!.records.push(row);
          }

          for (const group of Array.from(recordsByRouter.values())) {
            try {
              await withRouter(group.router, async (conn) => {
                for (const rec of group.records) {
                  const tokenOrEnc = rec.token_enc || currentChat.token_enc;
                  const chatIdsArray = (rec.chat_ids || '')
                    .split(',')
                    .map((s: string) => s.trim())
                    .filter(Boolean);

                  const scripts = buildNetwatchScripts({
                    name: rec.name,
                    host: rec.host,
                    tokenOrEnc,
                    chatIds: chatIdsArray,
                    routerName: group.router.name,
                    templateUpId: rec.template_up_id,
                    templateDownId: rec.template_down_id,
                    interval: rec.interval,
                  });

                  if (rec.item_id) {
                    try {
                      await conn.write('/tool/netwatch/set', [
                        `=.id=${rec.item_id}`,
                        `=interval=${scripts.interval}`,
                        `=comment=${scripts.comment}`,
                        `=up-script=${scripts.upScript}`,
                        `=down-script=${scripts.downScript}`,
                      ]);
                      updatedEntriesCount++;
                    } catch (itemErr) {
                      console.warn(`Could not update item ${rec.item_id} on router ${group.router.name}:`, itemErr);
                    }
                  }
                }

                // Also check if any other Netwatch entries directly on the router contain the old chat ID in scripts
                try {
                  const routerList = await conn.write('/tool/netwatch/print');
                  for (const rItem of routerList || []) {
                    const up = String(rItem['up-script'] || '');
                    const down = String(rItem['down-script'] || '');
                    if (up.includes(oldChatId) || down.includes(oldChatId)) {
                      const newUp = up.split(oldChatId).join(newChatId);
                      const newDown = down.split(oldChatId).join(newChatId);
                      await conn.write('/tool/netwatch/set', [
                        `=.id=${rItem['.id']}`,
                        `=up-script=${newUp}`,
                        `=down-script=${newDown}`,
                      ]);
                    }
                  }
                } catch {
                  // ignore print scan failure
                }
              });
              updatedRoutersCount++;
            } catch (routerErr) {
              const errStr = friendlyRouterError(routerErr);
              routerSyncErrors.push(`${group.router.name}: ${errStr}`);
            }
          }
        }

        recordActivityLog(
          user.username,
          'CHAT_UPDATE',
          `Updated chat ${label} (ID: ${newChatId}, was: ${oldChatId}). Synced ${updatedEntriesCount} Netwatch entries across ${updatedRoutersCount} router(s).`,
          ip
        );

        let message = `Chat updated (${label}).`;
        if (chatIdChanged && updatedEntriesCount > 0) {
          message += ` Automatically updated ${updatedEntriesCount} Netwatch entry(ies) across ${updatedRoutersCount} router(s) on MikroTik.`;
        }
        if (routerSyncErrors.length > 0) {
          message += ` (Router warnings: ${routerSyncErrors.join('; ')})`;
        }

        return jsonSuccess({
          message,
          updated_entries: updatedEntriesCount,
          updated_routers: updatedRoutersCount,
        });
      }

      // DELETE /api/chats/:id
      if (chatId && method === 'DELETE') {
        requirePermission(user, 'chats.delete');
        const currentChat = db.prepare('SELECT * FROM chats WHERE id = ?').get(chatId) as
          | { id: number; token_id: number; label: string; chat_id: string }
          | undefined;

        if (currentChat) {
          const oldChatId = currentChat.chat_id;

          // Find affected Netwatch records
          const affectedRecords = db
            .prepare(
              `SELECT nw.*, r.id as r_id, r.name as router_name, r.host as router_host,
                      r.api_user, r.api_pass_enc, r.api_port, r.use_ssl,
                      t.token_enc
               FROM nw_records nw
               JOIN routers r ON r.id = nw.router_id
               LEFT JOIN tokens t ON t.id = nw.token_id
               WHERE nw.chat_ids LIKE '%' || ? || '%'`
            )
            .all(oldChatId) as any[];

          // Remove oldChatId from SQLite nw_records
          for (const rec of affectedRecords) {
            const currentIds = (rec.chat_ids || '').split(',').map((s: string) => s.trim()).filter(Boolean);
            const remainingIds = currentIds.filter((id: string) => id !== oldChatId);
            rec.chat_ids = remainingIds.join(',');
            db.prepare("UPDATE nw_records SET chat_ids = ?, updated_at = datetime('now') WHERE id = ?").run(
              rec.chat_ids,
              rec.id
            );
          }

          // Group by router and update MikroTik
          const recordsByRouter = new Map<number, { router: RouterRecord; records: any[] }>();
          for (const row of affectedRecords) {
            if (!recordsByRouter.has(row.r_id)) {
              recordsByRouter.set(row.r_id, {
                router: {
                  id: row.r_id,
                  name: row.router_name,
                  host: row.router_host,
                  api_user: row.api_user,
                  api_pass_enc: row.api_pass_enc,
                  api_port: row.api_port,
                  use_ssl: row.use_ssl,
                },
                records: [],
              });
            }
            recordsByRouter.get(row.r_id)!.records.push(row);
          }

          for (const group of Array.from(recordsByRouter.values())) {
            try {
              await withRouter(group.router, async (conn) => {
                for (const rec of group.records) {
                  const chatIdsArray = (rec.chat_ids || '')
                    .split(',')
                    .map((s: string) => s.trim())
                    .filter(Boolean);

                  if (rec.token_enc && chatIdsArray.length > 0) {
                    const scripts = buildNetwatchScripts({
                      name: rec.name,
                      host: rec.host,
                      tokenOrEnc: rec.token_enc,
                      chatIds: chatIdsArray,
                      routerName: group.router.name,
                      templateUpId: rec.template_up_id,
                      templateDownId: rec.template_down_id,
                      interval: rec.interval,
                    });
                    if (rec.item_id) {
                      await conn.write('/tool/netwatch/set', [
                        `=.id=${rec.item_id}`,
                        `=up-script=${scripts.upScript}`,
                        `=down-script=${scripts.downScript}`,
                      ]);
                    }
                  }
                }
              });
            } catch (err) {
              console.warn(`Failed to sync chat deletion on router ${group.router.name}:`, err);
            }
          }

          db.prepare('DELETE FROM chats WHERE id = ?').run(chatId);
          recordActivityLog(user.username, 'CHAT_DELETE', `Deleted chat ${currentChat.label} (${currentChat.chat_id})`, ip);
        }

        return jsonSuccess({ message: 'Chat deleted and removed from MikroTik scripts.' });
      }
    }

    // ==========================================
    // 5. NETWATCH CRUD & SCRIPT PUSH
    // ==========================================
    if (p[0] === 'netwatch') {
      const routerId = p[1] ? parseInt(p[1], 10) : null;
      if (!routerId) return jsonError('Router ID is required in URL.', 400);

      const router = db.prepare('SELECT * FROM routers WHERE id = ?').get(routerId) as RouterRecord | undefined;
      if (!router) return jsonError('Router not found.', 404);

      // POST /api/netwatch/:routerId/preview (Generate preview without touching router)
      if (p[2] === 'preview' && method === 'POST') {
        requirePermission(user, 'netwatch.read');
        const body = await req.json();
        const tokenRow = body.token_id
          ? (db.prepare('SELECT token_enc FROM tokens WHERE id = ?').get(body.token_id) as { token_enc: string } | undefined)
          : null;

        const chatIds = Array.isArray(body.chat_ids)
          ? body.chat_ids
          : String(body.chat_ids || '').split(',').map((s) => s.trim()).filter(Boolean);

        const scripts = buildNetwatchScripts({
          name: body.name || 'Test Host',
          host: body.host || '1.1.1.1',
          tokenOrEnc: tokenRow ? tokenRow.token_enc : '123456:FAKE_TOKEN_FOR_PREVIEW',
          chatIds: chatIds.length > 0 ? chatIds : ['-100123456789'],
          routerName: router.name,
          templateUpId: body.template_up_id,
          templateDownId: body.template_down_id,
          interval: body.interval,
        });

        return jsonSuccess(scripts);
      }

      // POST /api/netwatch/:routerId/sync (Read entries from router and sync local DB)
      if (p[2] === 'sync' && method === 'POST') {
        requirePermission(user, 'netwatch.sync');
        const syncResult = await syncAndGetNetwatchList(db, router);
        if (!syncResult.router_online) {
          return jsonError(`Failed to sync with router: ${syncResult.router_error || 'Connection timed out or unreachable.'}`, 502);
        }
        recordActivityLog(user.username, 'NETWATCH_SYNC', `Synced netwatch entries for router ${router.name}`, ip);
        return jsonSuccess({
          message: `Synced with router: found ${syncResult.total_on_router} Netwatch entries on MikroTik.`,
          data: syncResult.rows,
          router_online: syncResult.router_online,
          total_on_router: syncResult.total_on_router,
        });
      }

      // Bulk Netwatch operations: POST /api/netwatch/:routerId/bulk
      if (p[2] === 'bulk' && method === 'POST') {
        const { action, ids } = await req.json();
        if (action === 'delete') {
          requirePermission(user, 'netwatch.delete');
          await withRouter(router, async (conn) => {
            for (const id of ids) {
              const rec = db.prepare('SELECT item_id, host FROM nw_records WHERE id = ?').get(id) as { item_id: string; host: string } | undefined;
              if (rec && rec.item_id) {
                try {
                  await conn.write('/tool/netwatch/remove', [`=.id=${rec.item_id}`]);
                } catch {
                  // If item doesn't exist on router, still delete locally
                }
              }
              db.prepare('DELETE FROM nw_records WHERE id = ?').run(id);
            }
          });
          return jsonSuccess({ message: `Deleted ${ids.length} entries.` });
        }
        return jsonError('Unknown bulk action.', 400);
      }

      // POST /api/netwatch/:routerId/fix-scripts (Re-push all Netwatch alert scripts on this router with correct emoji percent-encoding)
      if (p[2] === 'fix-scripts' && method === 'POST') {
        requirePermission(user, 'netwatch.update');
        // First sync to ensure all router entries are captured
        await syncAndGetNetwatchList(db, router);

        const records = db
          .prepare(
            `SELECT nw.*, t.token_enc
             FROM nw_records nw
             LEFT JOIN tokens t ON t.id = nw.token_id
             WHERE nw.router_id = ? AND nw.token_id IS NOT NULL`
          )
          .all(routerId) as any[];

        let updated = 0;
        await withRouter(router, async (conn) => {
          for (const rec of records) {
            if (!rec.item_id || !rec.token_enc) continue;
            try {
              const chatIdsArray = (rec.chat_ids || '')
                .split(',')
                .map((s: string) => s.trim())
                .filter(Boolean);

              const scripts = buildNetwatchScripts({
                name: rec.name,
                host: rec.host,
                tokenOrEnc: rec.token_enc,
                chatIds: chatIdsArray,
                routerName: router.name,
                templateUpId: rec.template_up_id,
                templateDownId: rec.template_down_id,
                interval: rec.interval,
              });

              await conn.write('/tool/netwatch/set', [
                `=.id=${rec.item_id}`,
                `=interval=${scripts.interval}`,
                `=comment=${scripts.comment}`,
                `=up-script=${scripts.upScript}`,
                `=down-script=${scripts.downScript}`,
              ]);
              updated++;
            } catch (itemErr) {
              console.warn(`Failed to fix script for item ${rec.item_id}:`, itemErr);
            }
          }
        });

        recordActivityLog(
          user.username,
          'NETWATCH_SCRIPTS_FIX',
          `Re-pushed emoji alert scripts for ${updated} Netwatch items on router ${router.name}`,
          ip
        );

        return jsonSuccess({
          message: `Successfully re-pushed and updated emoji alert scripts on ${updated} Netwatch entries on MikroTik.`,
          updated_count: updated,
        });
      }

      const itemIdParam = p[2];

      // POST /api/netwatch/:routerId/:itemId/toggle
      if (itemIdParam && p[3] === 'toggle' && method === 'POST') {
        requirePermission(user, 'netwatch.toggle');
        const rec = db
          .prepare('SELECT * FROM nw_records WHERE router_id = ? AND (item_id = ? OR id = ?)')
          .get(routerId, itemIdParam, itemIdParam) as
          | {
              id: number;
              item_id: string;
              enabled: number;
            }
          | undefined;

        if (!rec) return jsonError('Netwatch record not found.', 404);

        const newEnabled = rec.enabled === 1 ? 0 : 1;
        const disabledValue = newEnabled === 1 ? 'no' : 'yes';

        await withRouter(router, async (conn) => {
          await conn.write('/tool/netwatch/set', [`=.id=${rec.item_id}`, `=disabled=${disabledValue}`]);
        });

        db.prepare("UPDATE nw_records SET enabled = ?, updated_at = datetime('now') WHERE id = ?").run(newEnabled, rec.id);
        recordActivityLog(user.username, 'NETWATCH_TOGGLE', `Toggled netwatch id ${rec.id} to enabled=${newEnabled}`, ip);
        return jsonSuccess({ enabled: newEnabled, message: `Entry ${newEnabled ? 'enabled' : 'disabled'}.` });
      }

      // GET /api/netwatch/:routerId
      if (!itemIdParam && method === 'GET') {
        requirePermission(user, 'netwatch.read');
        const syncResult = await syncAndGetNetwatchList(db, router);
        return jsonSuccess({
          data: syncResult.rows,
          router_online: syncResult.router_online,
          router_error: syncResult.router_error,
          total_on_router: syncResult.total_on_router,
        });
      }

      // POST /api/netwatch/:routerId (Add new Netwatch to Router and DB)
      if (!itemIdParam && method === 'POST') {
        requirePermission(user, 'netwatch.create');
        const body = await req.json();
        const { host, name, token_id, chat_ids, interval, template_up_id, template_down_id } = body;

        if (!host || !name) {
          return jsonError('Host IP and Name are required.', 400);
        }

        const chatIdsArray = Array.isArray(chat_ids)
          ? chat_ids.map(String)
          : String(chat_ids || '').split(',').map((s) => s.trim()).filter(Boolean);

        let scripts = {
          interval: interval || '00:00:10',
          timeout: '1000ms',
          comment: `TG|${name.trim()}`,
          upScript: '',
          downScript: '',
        };

        if (token_id) {
          const tokenRow = db.prepare('SELECT token_enc FROM tokens WHERE id = ?').get(token_id) as { token_enc: string } | undefined;
          if (!tokenRow) return jsonError('Selected Telegram Bot Token not found.', 404);

          scripts = buildNetwatchScripts({
            name: name.trim(),
            host: host.trim(),
            tokenOrEnc: tokenRow.token_enc,
            chatIds: chatIdsArray,
            routerName: router.name,
            templateUpId: template_up_id,
            templateDownId: template_down_id,
            interval,
          });
        }

        // Push to MikroTik Router
        let createdItemId = '';
        await withRouter(router, async (conn) => {
          const params = [
            `=host=${host.trim()}`,
            `=interval=${scripts.interval}`,
            `=timeout=${scripts.timeout}`,
            `=comment=${scripts.comment}`,
          ];
          if (scripts.upScript) params.push(`=up-script=${scripts.upScript}`);
          if (scripts.downScript) params.push(`=down-script=${scripts.downScript}`);
          const res = await conn.write('/tool/netwatch/add', params);
          createdItemId = res?.[0]?.ret || res?.[0]?.['.id'] || '';
        });

        // Save record into SQLite DB
        const safeItemId = createdItemId || String(host.trim());
        const ins = db
          .prepare(
            `INSERT INTO nw_records
             (router_id, item_id, host, name, token_id, chat_ids, enabled, interval, template_up_id, template_down_id)
             VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`
          )
          .run(
            routerId,
            safeItemId,
            host.trim(),
            name.trim(),
            token_id ? Number(token_id) : null,
            chatIdsArray.join(','),
            scripts.interval,
            template_up_id || null,
            template_down_id || null
          );

        recordActivityLog(user.username, 'NETWATCH_ADD', `Added netwatch ${name} (${host}) to router ${router.name}`, ip);
        return jsonSuccess({
          id: ins.lastInsertRowid,
          item_id: safeItemId,
          message: 'Netwatch entry successfully added to router and saved.',
        });
      }

      // PUT /api/netwatch/:routerId/:itemId (Update Netwatch)
      if (itemIdParam && method === 'PUT') {
        requirePermission(user, 'netwatch.update');
        const body = await req.json();
        const { host, name, token_id, chat_ids, interval, template_up_id, template_down_id } = body;

        const current = db
          .prepare('SELECT * FROM nw_records WHERE router_id = ? AND (item_id = ? OR id = ?)')
          .get(routerId, itemIdParam, itemIdParam) as
          | {
              id: number;
              item_id: string;
              host: string;
              name: string;
              token_id: number | null;
              chat_ids: string;
              interval: string;
            }
          | undefined;

        if (!current) return jsonError('Netwatch record not found.', 404);

        const targetTokenId = token_id !== undefined ? (token_id ? Number(token_id) : null) : current.token_id;
        const updatedName = name ? name.trim() : current.name;
        const updatedHost = host ? host.trim() : current.host;

        const chatIdsArray = chat_ids !== undefined
          ? (Array.isArray(chat_ids) ? chat_ids.map(String) : String(chat_ids).split(',').map((s) => s.trim()).filter(Boolean))
          : (current.chat_ids ? current.chat_ids.split(',').filter(Boolean) : []);

        let scripts = {
          interval: interval || current.interval || '00:00:10',
          timeout: '1000ms',
          comment: `TG|${updatedName}`,
          upScript: '',
          downScript: '',
        };

        if (targetTokenId) {
          const tokenRow = db.prepare('SELECT token_enc FROM tokens WHERE id = ?').get(targetTokenId) as { token_enc: string } | undefined;
          if (tokenRow) {
            scripts = buildNetwatchScripts({
              name: updatedName,
              host: updatedHost,
              tokenOrEnc: tokenRow.token_enc,
              chatIds: chatIdsArray,
              routerName: router.name,
              templateUpId: template_up_id,
              templateDownId: template_down_id,
              interval,
            });
          }
        }

        // Update on RouterOS
        await withRouter(router, async (conn) => {
          const params = [
            `=.id=${current.item_id}`,
            `=host=${updatedHost}`,
            `=interval=${scripts.interval}`,
            `=comment=${scripts.comment}`,
          ];
          if (scripts.upScript !== undefined) params.push(`=up-script=${scripts.upScript}`);
          if (scripts.downScript !== undefined) params.push(`=down-script=${scripts.downScript}`);
          await conn.write('/tool/netwatch/set', params);
        });

        db.prepare(
          `UPDATE nw_records SET
           host = ?, name = ?, token_id = ?, chat_ids = ?, interval = ?,
           template_up_id = ?, template_down_id = ?, updated_at = datetime('now')
           WHERE id = ?`
        ).run(
          updatedHost,
          updatedName,
          targetTokenId,
          chatIdsArray.join(','),
          scripts.interval,
          template_up_id || null,
          template_down_id || null,
          current.id
        );

        recordActivityLog(user.username, 'NETWATCH_UPDATE', `Updated netwatch ${updatedName} on ${router.name}`, ip);
        return jsonSuccess({ message: 'Netwatch entry successfully updated.' });
      }

      // DELETE /api/netwatch/:routerId/:itemId (Delete Netwatch from router & DB)
      if (itemIdParam && method === 'DELETE') {
        requirePermission(user, 'netwatch.delete');
        const current = db
          .prepare('SELECT * FROM nw_records WHERE router_id = ? AND (item_id = ? OR id = ?)')
          .get(routerId, itemIdParam, itemIdParam) as { id: number; item_id: string; name: string } | undefined;

        if (current) {
          try {
            await withRouter(router, async (conn) => {
              await conn.write('/tool/netwatch/remove', [`=.id=${current.item_id}`]);
            });
          } catch (e) {
            console.warn(`Could not remove entry ${current.item_id} from router (maybe already deleted):`, e);
          }
          db.prepare('DELETE FROM nw_records WHERE id = ?').run(current.id);
          recordActivityLog(user.username, 'NETWATCH_DELETE', `Deleted netwatch ${current.name} from router ${router.name}`, ip);
        }

        return jsonSuccess({ message: 'Netwatch entry deleted.' });
      }
    }

    // ==========================================
    // 6. EXCEL / CSV BULK IMPORT
    // ==========================================
    if (p[0] === 'import' && method === 'POST') {
      requirePermission(user, 'import.execute');
      const body = await req.json();
      const { router_id, token_id, chat_ids, rows } = body;

      if (!router_id || !token_id || !Array.isArray(rows) || rows.length === 0) {
        return jsonError('Router, Telegram Token, and at least one row are required.', 400);
      }

      const router = db.prepare('SELECT * FROM routers WHERE id = ?').get(router_id) as RouterRecord | undefined;
      if (!router) return jsonError('Router not found.', 404);

      const tokenRow = db.prepare('SELECT token_enc FROM tokens WHERE id = ?').get(token_id) as { token_enc: string } | undefined;
      if (!tokenRow) return jsonError('Telegram token not found.', 404);

      const chatIdsArray = Array.isArray(chat_ids)
        ? chat_ids.map(String)
        : String(chat_ids || '').split(',').map((s) => s.trim()).filter(Boolean);

      const results: { row: number; host: string; name: string; status: 'created' | 'failed'; error?: string }[] = [];
      let createdCount = 0;
      let failedCount = 0;

      // Connect once to router and process items sequentially
      await withRouter(router, async (conn) => {
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const host = String(row.host || row.ip || row.IP || row.Host || '').trim();
          const name = String(row.name || row.Name || row.comment || row.Comment || host).trim();

          if (!host) {
            results.push({ row: i + 1, host: '', name, status: 'failed', error: 'Missing Host IP' });
            failedCount++;
            continue;
          }

          try {
            const scripts = buildNetwatchScripts({
              name,
              host,
              tokenOrEnc: tokenRow.token_enc,
              chatIds: chatIdsArray,
              routerName: router.name,
            });

            const res = await conn.write('/tool/netwatch/add', [
              `=host=${host}`,
              `=interval=${scripts.interval}`,
              `=timeout=${scripts.timeout}`,
              `=comment=${scripts.comment}`,
              `=up-script=${scripts.upScript}`,
              `=down-script=${scripts.downScript}`,
            ]);

            const createdItemId = res?.[0]?.ret || res?.[0]?.['.id'] || String(host);

            db.prepare(
              `INSERT INTO nw_records (router_id, item_id, host, name, token_id, chat_ids, enabled, interval)
               VALUES (?, ?, ?, ?, ?, ?, 1, ?)`
            ).run(router_id, createdItemId, host, name, token_id, chatIdsArray.join(','), scripts.interval);

            results.push({ row: i + 1, host, name, status: 'created' });
            createdCount++;
          } catch (err) {
            results.push({
              row: i + 1,
              host,
              name,
              status: 'failed',
              error: friendlyRouterError(err),
            });
            failedCount++;
          }
        }
      });

      recordActivityLog(user.username, 'IMPORT_EXECUTE', `Imported ${createdCount} entries, ${failedCount} failed on ${router.name}`, ip);
      return jsonSuccess({
        created: createdCount,
        failed: failedCount,
        total: rows.length,
        results,
      });
    }

    // ==========================================
    // 7. USER MANAGEMENT CRUD
    // ==========================================
    if (p[0] === 'users') {
      const targetUserId = p[1] ? parseInt(p[1], 10) : null;

      // GET /api/users
      if (!targetUserId && method === 'GET') {
        requirePermission(user, 'users.read');
        const rows = db.prepare('SELECT id, username, role, must_change, is_active, created_at, updated_at FROM users ORDER BY id ASC').all();
        return jsonSuccess({ data: rows });
      }

      // POST /api/users
      if (!targetUserId && method === 'POST') {
        requirePermission(user, 'users.create');
        const { username, password, role, must_change } = await req.json();
        if (!username || !password) return jsonError('Username and password are required.', 400);

        const hash = hashPassword(password);
        const res = db
          .prepare('INSERT INTO users (username, password_hash, role, must_change) VALUES (?, ?, ?, ?)')
          .run(username.trim(), hash, role || 'operator', must_change ? 1 : 0);

        recordActivityLog(user.username, 'USER_CREATE', `Created user ${username} with role ${role}`, ip);
        return jsonSuccess({ id: res.lastInsertRowid, message: 'User created successfully.' });
      }

      // POST /api/users/:id/reset-password
      if (targetUserId && p[2] === 'reset-password' && method === 'POST') {
        requirePermission(user, 'users.update');
        const { newPassword } = await req.json();
        if (!newPassword || newPassword.length < 6) return jsonError('Password must be at least 6 characters.', 400);

        const hash = hashPassword(newPassword);
        db.prepare("UPDATE users SET password_hash = ?, must_change = 1, updated_at = datetime('now') WHERE id = ?").run(hash, targetUserId);
        recordActivityLog(user.username, 'USER_RESET_PASSWORD', `Reset password for user id ${targetUserId}`, ip);
        return jsonSuccess({ message: 'Password reset. User will be prompted to change password on next login.' });
      }

      // PUT /api/users/:id
      if (targetUserId && method === 'PUT') {
        requirePermission(user, 'users.update');
        const { role, is_active, must_change } = await req.json();
        db.prepare("UPDATE users SET role = ?, is_active = ?, must_change = ?, updated_at = datetime('now') WHERE id = ?").run(
          role,
          is_active !== undefined ? (is_active ? 1 : 0) : 1,
          must_change !== undefined ? (must_change ? 1 : 0) : 0,
          targetUserId
        );
        recordActivityLog(user.username, 'USER_UPDATE', `Updated user id ${targetUserId}`, ip);
        return jsonSuccess({ message: 'User updated.' });
      }

      // DELETE /api/users/:id
      if (targetUserId && method === 'DELETE') {
        requirePermission(user, 'users.delete');
        if (targetUserId === user.id) return jsonError('Cannot delete your own account.', 400);
        db.prepare('DELETE FROM users WHERE id = ?').run(targetUserId);
        recordActivityLog(user.username, 'USER_DELETE', `Deleted user id ${targetUserId}`, ip);
        return jsonSuccess({ message: 'User deleted.' });
      }
    }

    // ==========================================
    // 8. ROLES & PERMISSIONS CRUD
    // ==========================================
    if (p[0] === 'roles') {
      const roleId = p[1] ? parseInt(p[1], 10) : null;

      // GET /api/roles
      if (!roleId && method === 'GET') {
        requirePermission(user, 'roles.read');
        const rows = db.prepare('SELECT * FROM roles ORDER BY id ASC').all();
        return jsonSuccess({ data: rows });
      }

      // POST /api/roles
      if (!roleId && method === 'POST') {
        requirePermission(user, 'roles.create');
        const { name, permissions, description } = await req.json();
        if (!name) return jsonError('Role name is required.', 400);

        const permsStr = Array.isArray(permissions) ? JSON.stringify(permissions) : permissions || '[]';
        const res = db.prepare('INSERT INTO roles (name, permissions, description, is_system) VALUES (?, ?, ?, 0)').run(name.trim().toLowerCase(), permsStr, (description || '').trim());
        return jsonSuccess({ id: res.lastInsertRowid, message: 'Role created.' });
      }

      // PUT /api/roles/:id
      if (roleId && method === 'PUT') {
        requirePermission(user, 'roles.update');
        const { permissions, description } = await req.json();
        const permsStr = Array.isArray(permissions) ? JSON.stringify(permissions) : permissions || '[]';
        db.prepare('UPDATE roles SET permissions = ?, description = ? WHERE id = ?').run(permsStr, (description || '').trim(), roleId);
        return jsonSuccess({ message: 'Role updated.' });
      }

      // DELETE /api/roles/:id
      if (roleId && method === 'DELETE') {
        requirePermission(user, 'roles.delete');
        const role = db.prepare('SELECT is_system, name FROM roles WHERE id = ?').get(roleId) as { is_system: number; name: string } | undefined;
        if (!role) return jsonError('Role not found', 404);
        if (role.is_system === 1) return jsonError('System roles cannot be deleted.', 400);

        // Check if any user uses this role
        const inUse = db.prepare('SELECT COUNT(*) as c FROM users WHERE role = ?').get(role.name) as { c: number };
        if (inUse.c > 0) return jsonError(`Cannot delete role: ${inUse.c} user(s) currently have this role.`, 400);

        db.prepare('DELETE FROM roles WHERE id = ?').run(roleId);
        return jsonSuccess({ message: 'Role deleted.' });
      }
    }

    // ==========================================
    // 9. MESSAGE TEMPLATES CRUD
    // ==========================================
    if (p[0] === 'templates') {
      const tplId = p[1] ? parseInt(p[1], 10) : null;

      // GET /api/templates
      if (!tplId && method === 'GET') {
        requirePermission(user, 'templates.read');
        const rows = db.prepare('SELECT * FROM message_templates ORDER BY id ASC').all();
        return jsonSuccess({ data: rows });
      }

      // POST /api/templates
      if (!tplId && method === 'POST') {
        requirePermission(user, 'templates.create');
        const { name, type, template, is_default } = await req.json();
        if (!name || !template || !type) return jsonError('Name, Type (up/down), and Template content are required.', 400);

        if (is_default) {
          db.prepare('UPDATE message_templates SET is_default = 0 WHERE type = ?').run(type);
        }

        const res = db
          .prepare('INSERT INTO message_templates (name, type, template, is_default) VALUES (?, ?, ?, ?)')
          .run(name.trim(), type, template.trim(), is_default ? 1 : 0);

        return jsonSuccess({ id: res.lastInsertRowid, message: 'Template created.' });
      }

      // PUT /api/templates/:id
      if (tplId && method === 'PUT') {
        requirePermission(user, 'templates.update');
        const { name, template, is_default } = await req.json();
        const current = db.prepare('SELECT type FROM message_templates WHERE id = ?').get(tplId) as { type: string } | undefined;
        if (!current) return jsonError('Template not found', 404);

        if (is_default) {
          db.prepare('UPDATE message_templates SET is_default = 0 WHERE type = ?').run(current.type);
        }

        db.prepare("UPDATE message_templates SET name = ?, template = ?, is_default = ?, updated_at = datetime('now') WHERE id = ?").run(
          name.trim(),
          template.trim(),
          is_default ? 1 : 0,
          tplId
        );

        return jsonSuccess({ message: 'Template updated.' });
      }

      // DELETE /api/templates/:id
      if (tplId && method === 'DELETE') {
        requirePermission(user, 'templates.delete');
        db.prepare('DELETE FROM message_templates WHERE id = ?').run(tplId);
        return jsonSuccess({ message: 'Template deleted.' });
      }
    }

    // ==========================================
    // 10. DYNAMIC SETTINGS CRUD
    // ==========================================
    if (p[0] === 'settings') {
      // GET /api/settings
      if (method === 'GET') {
        requirePermission(user, 'settings.read');
        const category = p[1];
        const all = getAllSettings();
        if (category) {
          return jsonSuccess({ data: all.filter((s) => s.category === category) });
        }
        return jsonSuccess({ data: all });
      }

      // POST /api/settings/bulk
      if (p[1] === 'bulk' && method === 'POST') {
        requirePermission(user, 'settings.update');
        const settingsMap = await req.json();
        bulkUpdateSettings(settingsMap);
        recordActivityLog(user.username, 'SETTINGS_BULK_UPDATE', `Updated settings`, ip);
        return jsonSuccess({ message: 'Settings updated successfully.' });
      }

      // PUT /api/settings/:key
      const key = p.slice(1).join('.');
      if (key && method === 'PUT') {
        requirePermission(user, 'settings.update');
        const { value } = await req.json();
        updateSetting(key, String(value));
        recordActivityLog(user.username, 'SETTINGS_UPDATE', `Updated ${key} to ${value}`, ip);
        return jsonSuccess({ message: `Setting '${key}' updated.` });
      }
    }

    // ==========================================
    // 11. AUDIT LOGS
    // ==========================================
    if (p[0] === 'logs') {
      requirePermission(user, 'logs.read');

      // Export CSV: GET /api/logs/export
      if (p[1] === 'export' && method === 'GET') {
        requirePermission(user, 'logs.export');
        const rows = db.prepare('SELECT id, user, action, detail, ip_address, created_at FROM logs ORDER BY id DESC').all() as Record<string, unknown>[];
        const csv = exportCsv(rows, ['id', 'user', 'action', 'detail', 'ip_address', 'created_at']);
        return new NextResponse(csv, {
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': 'attachment; filename="activity_logs.csv"',
          },
        });
      }

      // Clear logs: DELETE /api/logs/clear
      if (p[1] === 'clear' && method === 'DELETE') {
        requirePermission(user, 'logs.clear');
        db.prepare('DELETE FROM logs').run();
        recordActivityLog(user.username, 'LOGS_CLEARED', 'Cleared all activity logs', ip);
        return jsonSuccess({ message: 'Activity logs cleared.' });
      }

      // GET /api/logs
      if (method === 'GET') {
        const queryOpts = parseQueryParams(req);
        const result = queryList('logs', {
          ...queryOpts,
          searchFields: ['user', 'action', 'detail', 'ip_address'],
        });
        return jsonSuccess(result);
      }
    }

    // ==========================================
    // 12. BACKUP & RESTORE
    // ==========================================
    if (p[0] === 'backup') {
      // GET /api/backup (Download database file)
      if (method === 'GET') {
        requirePermission(user, 'backup.download');
        const fileBuffer = createDatabaseBackup();
        recordActivityLog(user.username, 'BACKUP_DOWNLOAD', 'Downloaded database backup', ip);
        return new NextResponse(fileBuffer, {
          headers: {
            'Content-Type': 'application/octet-stream',
            'Content-Disposition': `attachment; filename="netwatch_backup_${Date.now()}.db"`,
          },
        });
      }

      // POST /api/backup/restore (Restore database from uploaded file)
      if (p[1] === 'restore' && method === 'POST') {
        requirePermission(user, 'backup.restore');
        const formData = await req.formData();
        const file = formData.get('file') as File | null;
        if (!file) return jsonError('Please select a .db backup file to restore.', 400);

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        restoreDatabase(buffer);
        recordActivityLog(user.username, 'BACKUP_RESTORE', `Restored database from ${file.name || 'backup.db'}`, ip);

        return jsonSuccess({ message: 'Database restored successfully. Reloading...' });
      }
    }

    // 404 for unhandled API routes
    return jsonError(`Endpoint /api/${p.join('/')} not found.`, 404);
  } catch (err) {
    const errorMsg = friendlyRouterError(err);
    console.error(`[API Error] ${method} /api/${p.join('/')}:`, err);
    return jsonError(errorMsg, 500);
  }
}

export const GET = handleRequest;
export const POST = handleRequest;
export const PUT = handleRequest;
export const DELETE = handleRequest;
export const PATCH = handleRequest;
