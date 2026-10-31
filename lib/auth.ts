import { SignJWT, jwtVerify } from 'jose';
import { hashSync, compareSync } from 'bcryptjs';
import { cookies } from 'next/headers';
import { getSetting } from './settings';

export const COOKIE_NAME = 'nw_token';

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET || process.env.ENCRYPT_KEY || 'fallback-secret-at-least-32-chars-long';
  return new TextEncoder().encode(secret);
}

// In-memory lockout tracking: username -> { count, lockedUntil }
const loginAttempts = new Map<string, { count: number; lockedUntil: number | null }>();

export interface SessionUser {
  id: number;
  username: string;
  role: string;
  must_change: number;
}

export async function createSessionToken(user: SessionUser): Promise<string> {
  const expiryHours = getSetting<number>('security.jwt_expiry_hours', 8);
  return new SignJWT({
    id: user.id,
    username: user.username,
    role: user.role,
    must_change: user.must_change,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${expiryHours}h`)
    .sign(getJwtSecret());
}

export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret(), {
      algorithms: ['HS256'],
    });
    return payload as unknown as SessionUser;
  } catch {
    return null;
  }
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export function hashPassword(plain: string): string {
  return hashSync(plain, 10);
}

export function verifyPassword(plain: string, hash: string): boolean {
  return compareSync(plain, hash);
}

export function isAccountLocked(username: string): { locked: boolean; remainingSeconds?: number } {
  const record = loginAttempts.get(username);
  if (!record || !record.lockedUntil) return { locked: false };

  const now = Date.now();
  if (now < record.lockedUntil) {
    return { locked: true, remainingSeconds: Math.ceil((record.lockedUntil - now) / 1000) };
  }

  // Lockout expired
  loginAttempts.delete(username);
  return { locked: false };
}

export function recordFailedLoginAttempt(username: string): { locked: boolean; attemptsLeft: number } {
  const maxAttempts = getSetting<number>('security.max_login_attempts', 5);
  const lockoutMinutes = getSetting<number>('security.lockout_minutes', 5);

  const rec = loginAttempts.get(username) || { count: 0, lockedUntil: null };
  rec.count += 1;

  if (rec.count >= maxAttempts) {
    rec.lockedUntil = Date.now() + lockoutMinutes * 60 * 1000;
    loginAttempts.set(username, rec);
    return { locked: true, attemptsLeft: 0 };
  }

  loginAttempts.set(username, rec);
  return { locked: false, attemptsLeft: maxAttempts - rec.count };
}

export function clearFailedLoginAttempts(username: string): void {
  loginAttempts.delete(username);
}

