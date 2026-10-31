import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const COOKIE_NAME = 'nw_token';

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET || process.env.ENCRYPT_KEY || 'fallback-secret-at-least-32-chars-long';
  return new TextEncoder().encode(secret);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Static files and public API endpoints bypass auth
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico') ||
    pathname === '/api/login' ||
    pathname === '/api/branding'
  ) {
    return NextResponse.next();
  }

  const cookie = request.cookies.get(COOKIE_NAME)?.value;
  let session = null;

  if (cookie) {
    try {
      const { payload } = await jwtVerify(cookie, getJwtSecret(), {
        algorithms: ['HS256'],
      });
      session = payload;
    } catch {
      // Invalid/expired token
    }
  }

  const isLoginPage = pathname === '/login';
  const isDashboardRoute = pathname.startsWith('/dashboard') || pathname === '/';

  // If user is accessing protected routes without session -> redirect to /login
  if (isDashboardRoute && !session) {
    const loginUrl = new URL('/login', request.url);
    const res = NextResponse.redirect(loginUrl);
    if (cookie) res.cookies.delete(COOKIE_NAME);
    return res;
  }

  // If user is already logged in and visits /login or / -> redirect to /dashboard
  if ((isLoginPage || pathname === '/') && session) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

