/**
 * Netwatch Manager — Automated Full-Stack E2E Integration Test
 *
 * Runs complete test suite against the live running Next.js server,
 * live MikroTik RouterOS device, and live Telegram Bot API.
 *
 * Usage:
 *   1. Start the server: npm run build && npm start
 *   2. Run test:         npm run test:e2e
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load test config
function getTestConfig() {
  const envPath = join(__dirname, '.env.test');
  const config = {
    TEST_BASE_URL: process.env.TEST_BASE_URL || 'http://localhost:3000',
    TEST_ADMIN_USER: process.env.TEST_ADMIN_USER || 'admin',
    TEST_ADMIN_PASS: process.env.TEST_ADMIN_PASS || 'admin',
    TEST_BOT_TOKEN: process.env.TEST_BOT_TOKEN || '123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ',
    TEST_CHAT_ID: process.env.TEST_CHAT_ID || '-100123456789',
    TEST_ROUTER_HOST: process.env.TEST_ROUTER_HOST || '192.168.88.1',
    TEST_ROUTER_USER: process.env.TEST_ROUTER_USER || 'admin',
    TEST_ROUTER_PASS: process.env.TEST_ROUTER_PASS || 'admin',
    TEST_ROUTER_PORT: process.env.TEST_ROUTER_PORT || '8728',
  };

  if (existsSync(envPath)) {
    const lines = readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const [key, ...rest] = trimmed.split('=');
      if (key && rest.length > 0) {
        config[key.trim()] = rest.join('=').trim();
      }
    }
  }

  return config;
}

const cfg = getTestConfig();
const BASE = cfg.TEST_BASE_URL.replace(/\/$/, '');

let sessionCookie = '';
let routerId = null;
let tokenId = null;
let chatId = null;
let netwatchItemId = null;
const results = [];

async function api(method, endpoint, body = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (sessionCookie) headers['Cookie'] = sessionCookie;

  const res = await fetch(`${BASE}/api/${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  // Capture session cookie from login
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) {
    const match = setCookie.match(/nw_token=([^;]+)/);
    if (match) {
      sessionCookie = `nw_token=${match[1]}`;
    }
  }

  let json = {};
  try {
    json = await res.json();
  } catch {
    // Non-JSON
  }

  return { status: res.status, ok: res.ok, data: json };
}

function test(name, fn) {
  return async () => {
    process.stdout.write(`  ⏳ ${name}... `);
    try {
      await fn();
      results.push({ name, passed: true });
      console.log('✅ PASS');
    } catch (err) {
      results.push({ name, passed: false, error: err.message });
      console.log(`❌ FAIL\n     → ${err.message}`);
    }
  };
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

let isNewRouter = false;
let isNewToken = false;
let isNewChat = false;

// ── Test Steps ──
const suite = [
  test('1. Authenticate as Administrator', async () => {
    const res = await api('POST', 'login', {
      username: cfg.TEST_ADMIN_USER,
      password: cfg.TEST_ADMIN_PASS,
    });
    assert(res.ok, `Login failed: ${res.data?.error || res.status}`);
    assert(sessionCookie, 'No session cookie received');
  }),

  test('2. Verify Authenticated Session (/api/me)', async () => {
    const res = await api('GET', 'me');
    assert(res.ok, `me failed: ${res.data?.error}`);
    assert(res.data?.username === cfg.TEST_ADMIN_USER, `Expected ${cfg.TEST_ADMIN_USER}, got ${res.data?.username}`);
  }),

  test('3. Test Dynamic Setting Mutation & Query', async () => {
    await api('PUT', 'settings/branding.app_name', { value: 'Netwatch Commercial Suite' });
    const res = await api('GET', 'settings/branding');
    assert(res.ok, 'Failed to fetch settings');
    const row = res.data?.data?.find((s) => s.key === 'branding.app_name');
    assert(row?.value === 'Netwatch Commercial Suite', 'Dynamic setting value mismatch');
  }),

  test('4. Register or Identify MikroTik Router in System', async () => {
    const res = await api('POST', 'routers', {
      name: 'E2E-MikroTik-Live',
      host: cfg.TEST_ROUTER_HOST,
      api_user: cfg.TEST_ROUTER_USER,
      api_pass: cfg.TEST_ROUTER_PASS,
      api_port: parseInt(cfg.TEST_ROUTER_PORT, 10),
      use_ssl: 0,
      note: 'Automated test device',
    });

    if (res.ok) {
      routerId = res.data?.id;
      isNewRouter = true;
    } else {
      // If already registered, fetch existing router id
      const list = await api('GET', 'routers');
      const found = list.data?.data?.find((r) => r.host === cfg.TEST_ROUTER_HOST);
      assert(found, `Router registration failed: ${res.data?.error}`);
      routerId = found.id;
    }
    assert(routerId, 'No router ID returned');
  }),

  test('5. Execute Live RouterOS API Handshake & Diagnostic', async () => {
    assert(routerId, 'Router ID required');
    const res = await api('POST', `routers/${routerId}/test`);
    assert(res.ok, `Router handshake failed: ${res.data?.error}`);
    assert(res.data?.name, 'Router identity not returned');
  }),

  test('6. Register Telegram Bot Token', async () => {
    const res = await api('POST', 'tokens', {
      label: 'E2E-Alert-Bot',
      token: cfg.TEST_BOT_TOKEN,
    });
    assert(res.ok, `Bot registration failed: ${res.data?.error}`);
    tokenId = res.data?.id;
    assert(tokenId, 'No token ID returned');
  }),

  test('7. Verify Telegram Bot Token via getMe API', async () => {
    assert(tokenId, 'Token ID required');
    const res = await api('POST', `tokens/${tokenId}/verify`);
    assert(res.ok, `Token verification failed: ${res.data?.error}`);
    assert(res.data?.username, 'Bot username not returned');
  }),

  test('8. Register Telegram Destination Chat', async () => {
    assert(tokenId, 'Token ID required');
    const res = await api('POST', `tokens/${tokenId}/chats`, {
      label: 'E2E-Alert-Channel',
      chat_id: cfg.TEST_CHAT_ID,
    });
    assert(res.ok, `Chat registration failed: ${res.data?.error}`);
    chatId = res.data?.id;
    assert(chatId, 'No chat ID returned');
  }),

  test('9. Send Live Test Alert to Telegram Chat', async () => {
    assert(chatId, 'Chat ID required');
    const res = await api('POST', `chats/${chatId}/test`);
    assert(res.ok, `Test message failed: ${res.data?.error}`);
  }),

  test('10. Generate & Validate RouterOS Netwatch Script Preview', async () => {
    assert(routerId && tokenId, 'Router and Token required');
    const res = await api('POST', `netwatch/${routerId}/preview`, {
      host: '8.8.8.8',
      name: 'Google Primary DNS (E2E Test)',
      token_id: tokenId,
      chat_ids: [cfg.TEST_CHAT_ID],
    });
    assert(res.ok, `Preview generation failed: ${res.data?.error}`);
    assert(res.data?.upScript?.includes('/tool fetch'), 'UP script missing fetch command');
    assert(res.data?.downScript?.includes('/tool fetch'), 'DOWN script missing fetch command');
  }),

  test('11. Push Netwatch Entry directly to MikroTik Router', async () => {
    assert(routerId && tokenId, 'Router and Token required');
    const res = await api('POST', `netwatch/${routerId}`, {
      host: '8.8.8.8',
      name: 'Google Primary DNS (E2E Test)',
      token_id: tokenId,
      chat_ids: [cfg.TEST_CHAT_ID],
    });
    assert(res.ok, `Netwatch push failed: ${res.data?.error}`);
    netwatchItemId = res.data?.item_id || res.data?.id;
    assert(netwatchItemId, 'No Netwatch item id returned');
  }),

  test('12. Query Netwatch Table for Router', async () => {
    assert(routerId, 'Router ID required');
    const res = await api('GET', `netwatch/${routerId}`);
    assert(res.ok, 'Failed to fetch netwatch entries');
    const list = res.data?.data || [];
    assert(list.length > 0, 'No netwatch records found');
  }),

  test('13. Toggle Netwatch State on Router (Disable)', async () => {
    assert(routerId && netwatchItemId, 'Router and Netwatch item required');
    const res = await api('POST', `netwatch/${routerId}/${netwatchItemId}/toggle`);
    assert(res.ok, `Toggle disable failed: ${res.data?.error}`);
    assert(res.data?.enabled === 0, 'Expected disabled state');
  }),

  test('14. Toggle Netwatch State on Router (Re-enable)', async () => {
    assert(routerId && netwatchItemId, 'Router and Netwatch item required');
    const res = await api('POST', `netwatch/${routerId}/${netwatchItemId}/toggle`);
    assert(res.ok, `Toggle enable failed: ${res.data?.error}`);
    assert(res.data?.enabled === 1, 'Expected enabled state');
  }),

  test('15. Remove Netwatch Entry from Router', async () => {
    assert(routerId && netwatchItemId, 'Router and Netwatch item required');
    const res = await api('DELETE', `netwatch/${routerId}/${netwatchItemId}`);
    assert(res.ok, `Netwatch removal failed: ${res.data?.error}`);
  }),

  test('16. Verify Audit Trail Log Records', async () => {
    const res = await api('GET', 'logs?pageSize=10');
    assert(res.ok, 'Failed to fetch audit logs');
    const logs = res.data?.data || [];
    assert(logs.length > 0, 'Audit logs empty');
  }),
];

async function cleanup() {
  console.log('\n🧹 Cleaning up test artifacts...');
  if (chatId) await api('DELETE', `chats/${chatId}`).catch(() => {});
  if (tokenId) await api('DELETE', `tokens/${tokenId}`).catch(() => {});
  if (routerId && isNewRouter) await api('DELETE', `routers/${routerId}`).catch(() => {});
  console.log('   Cleanup completed.\n');
}

async function run() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║       Netwatch Manager — Live Integration Suite          ║');
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log(`║ Target URL:    ${BASE.padEnd(42)}║`);
  console.log(`║ MikroTik Host: ${(cfg.TEST_ROUTER_HOST + ':' + cfg.TEST_ROUTER_PORT).padEnd(42)}║`);
  console.log(`║ Bot Token:     ${('...' + cfg.TEST_BOT_TOKEN.slice(-10)).padEnd(42)}║`);
  console.log(`║ Chat ID:       ${cfg.TEST_CHAT_ID.padEnd(42)}║`);
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  for (const step of suite) {
    await step();
  }

  await cleanup();

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log('═════════════════════ TEST SUMMARY ═════════════════════');
  console.log(`  Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
  console.log('════════════════════════════════════════════════════════');

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

