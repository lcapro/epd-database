import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { ACTIVE_ORG_COOKIE } from '@/lib/activeOrgConstants';

type CookieList = { name: string }[];

export type SupabaseCookieStatus = {
  hasActiveOrgCookie: boolean;
  hasSupabaseAuthCookie: boolean;
};

const SUPABASE_AUTH_COOKIE = /^sb-.*(auth-token|access-token|refresh-token)$/;

function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
}

export function createSupabaseServerClient() {
  const supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL);
  const supabaseAnonKey = requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const cookieStore = cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set({ name, value, path: '/', ...options });
        });
      },
    },
  });
}

export function getSupabaseCookieStatusFromCookies(cookiesList: CookieList): SupabaseCookieStatus {
  const hasActiveOrgCookie = cookiesList.some((cookie) => cookie.name === ACTIVE_ORG_COOKIE);
  const hasSupabaseAuthCookie = cookiesList.some((cookie) => SUPABASE_AUTH_COOKIE.test(cookie.name));
  return { hasActiveOrgCookie, hasSupabaseAuthCookie };
}

export function getSupabaseCookieStatus(): SupabaseCookieStatus {
  return getSupabaseCookieStatusFromCookies(cookies().getAll());
}
