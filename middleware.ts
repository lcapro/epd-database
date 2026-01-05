import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { ACTIVE_ORG_COOKIE } from '@/lib/organizations';

function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
}

const protectedRoots = ['/epd', '/epd-database', '/org'];
const orgRequiredRoots = ['/epd', '/epd-database'];

function isUnderPath(pathname: string, roots: string[]) {
  return roots.some((root) => pathname === root || pathname.startsWith(`${root}/`));
}

function applySupabaseCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set(cookie);
  });
  return to;
}

export async function middleware(request: NextRequest) {
  const supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL);
  const supabaseAnonKey = requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  const response = NextResponse.next();
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set({ name, value, path: '/', ...options });
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isProtected = isUnderPath(pathname, protectedRoots);
  const needsOrg = isUnderPath(pathname, orgRequiredRoots);

  if (!user && isProtected) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('next', `${pathname}${request.nextUrl.search}`);
    return applySupabaseCookies(response, NextResponse.redirect(loginUrl));
  }

  if (user && pathname === '/login') {
    const redirectUrl = request.nextUrl.clone();
    const activeOrgId = request.cookies.get(ACTIVE_ORG_COOKIE)?.value;
    redirectUrl.pathname = activeOrgId ? '/epd-database' : '/org';
    redirectUrl.search = '';
    return applySupabaseCookies(response, NextResponse.redirect(redirectUrl));
  }

  if (user && needsOrg) {
    const activeOrgId = request.cookies.get(ACTIVE_ORG_COOKIE)?.value;
    if (!activeOrgId) {
      const orgUrl = request.nextUrl.clone();
      orgUrl.pathname = '/org';
      orgUrl.search = '';
      return applySupabaseCookies(response, NextResponse.redirect(orgUrl));
    }
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
