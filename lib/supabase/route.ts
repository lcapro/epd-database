import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { getSupabaseCookieStatusFromCookies, type SupabaseCookieStatus } from '@/lib/supabase/server';

function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
}

type SupabaseCookie = { name: string; value: string; options: CookieOptions };

export function applySupabaseCookiesToResponse(response: NextResponse, cookiesToSet: SupabaseCookie[]) {
  cookiesToSet.forEach(({ name, value, options }) => {
    response.cookies.set({ name, value, path: '/', ...options });
  });
  return response;
}

export function createSupabaseRouteClient() {
  const supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL);
  const supabaseAnonKey = requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const cookieStore = cookies();
  const pendingCookies: SupabaseCookie[] = [];

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: SupabaseCookie[]) {
        pendingCookies.push(...cookiesToSet);
      },
    },
  });

  const applySupabaseCookies = (response: NextResponse) =>
    applySupabaseCookiesToResponse(response, pendingCookies);

  return { supabase, applySupabaseCookies };
}

export function getSupabaseCookieStatus(): SupabaseCookieStatus {
  return getSupabaseCookieStatusFromCookies(cookies().getAll());
}
