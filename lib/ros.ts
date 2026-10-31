import { RouterOSAPI } from 'node-routeros';
import { decrypt } from './crypto';

export interface RouterRecord {
  id?: number;
  name: string;
  host: string;
  api_user: string;
  api_pass_enc?: string | null;
  api_password?: string;
  api_port: number;
  use_ssl: number;
  note?: string;
}

/**
 * Format any MikroTik / Network error into a human-friendly string.
 * Guaranteed to NEVER return an empty string.
 */
export function friendlyRouterError(err: unknown): string {
  if (!err) return 'Unknown error occurred while communicating with the router.';
  if (typeof err === 'string' && err.trim().length > 0) return err.trim();

  const msg = (err as Error)?.message || '';

  if (msg.includes('ECONNREFUSED')) {
    return 'Connection refused. Please verify the Router IP address and that the API service is enabled on the specified port.';
  }
  if (msg.includes('ETIMEDOUT') || msg.toLowerCase().includes('timeout')) {
    return 'Connection timed out. The router is unreachable or a firewall is dropping API packets on this port.';
  }
  if (msg.includes('ENOTFOUND') || msg.includes('EHOSTUNREACH')) {
    return 'Host unreachable. The specified IP address or hostname could not be routed.';
  }
  if (msg.includes('cannot log in') || msg.toLowerCase().includes('authentication') || msg.includes('password')) {
    return 'Authentication failed. Please verify API username and password. Ensure the user has the "api" policy group.';
  }
  if (msg.includes('already have') || msg.includes('already exists') || msg.includes('failure: already exists')) {
    return 'A Netwatch entry for this host already exists on the router.';
  }
  if (msg.includes('no such item')) {
    return 'The target Netwatch entry does not exist on the router (it may have been deleted on the router).';
  }
  if (msg.includes('not enough permissions') || msg.includes('permission denied')) {
    return 'API user lacks sufficient permissions (needs: read, write, test, api, policy).';
  }

  const jsonError = (err as { error?: string | object }).error;
  if (jsonError) {
    if (typeof jsonError === 'string' && jsonError.trim().length > 0) return jsonError.trim();
    try {
      return JSON.stringify(jsonError);
    } catch {
      // fallback
    }
  }

  if (msg.trim().length > 0) return msg.trim();

  try {
    const serialized = JSON.stringify(err);
    if (serialized && serialized !== '{}') return serialized;
  } catch {
    // fallback
  }

  return 'Unknown RouterOS communication error.';
}

/**
 * Connect to a MikroTik router, execute a task, and reliably close the connection.
 */
export async function withRouter<T>(
  router: RouterRecord,
  action: (conn: RouterOSAPI) => Promise<T>
): Promise<T> {
  const password = router.api_password !== undefined
    ? router.api_password
    : router.api_pass_enc
    ? decrypt(router.api_pass_enc)
    : '';

  const conn = new RouterOSAPI({
    host: router.host,
    user: router.api_user || 'admin',
    password,
    port: router.api_port || (router.use_ssl ? 8729 : 8728),
    timeout: 10,
    tls: router.use_ssl ? { rejectUnauthorized: false } : undefined,
  });

  try {
    await conn.connect();
    return await action(conn);
  } catch (err) {
    const errorMsg = friendlyRouterError(err);
    console.error(`[RouterOS API Error] router=${router.host}:${router.api_port} user=${router.api_user}:`, err);
    throw new Error(errorMsg);
  } finally {
    try {
      conn.close();
    } catch {
      // ignore close errors
    }
  }
}

/**
 * Test connectivity, returning router identity and system resource info.
 */
export async function testRouterConnection(router: RouterRecord) {
  return withRouter(router, async (conn) => {
    const identityRes = await conn.write('/system/identity/print');
    const resourceRes = await conn.write('/system/resource/print');

    const identity = identityRes?.[0] || {};
    const resource = resourceRes?.[0] || {};

    return {
      name: identity.name || 'MikroTik',
      version: resource.version || 'Unknown',
      uptime: resource.uptime || 'Unknown',
      board: resource['board-name'] || resource.platform || 'RouterBOARD',
      cpuLoad: resource['cpu-load'] !== undefined ? `${resource['cpu-load']}%` : 'N/A',
      freeMemory: resource['free-memory'] ? `${Math.round(Number(resource['free-memory']) / 1024 / 1024)}MB` : 'N/A',
    };
  });
}

