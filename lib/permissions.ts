import { getDb } from './db';
export { ALL_PERMISSIONS } from './permissions-constants';

export function hasPermission(roleName: string, requiredPermission: string): boolean {
  if (roleName === 'admin') return true;
  const db = getDb();
  const role = db.prepare('SELECT permissions FROM roles WHERE name = ?').get(roleName) as { permissions: string } | undefined;
  if (!role) return false;

  let perms: string[] = [];
  try {
    perms = JSON.parse(role.permissions);
  } catch {
    return false;
  }

  if (perms.includes('*')) return true;
  if (perms.includes(requiredPermission)) return true;

  const [entity] = requiredPermission.split('.');
  if (perms.includes(`${entity}.*`)) return true;

  return false;
}

export function requirePermission(user: { role: string; username: string }, permission: string): void {
  if (!hasPermission(user.role, permission)) {
    throw new Error(`Forbidden: Role '${user.role}' lacks permission '${permission}'`);
  }
}
