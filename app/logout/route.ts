import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ACTIVE_ORG_COOKIE } from '@/lib/organizations';

export async function GET(request: Request) {
  const supabase = createSupabaseServerClient();
  await supabase.auth.signOut();
  cookies().set(ACTIVE_ORG_COOKIE, '', { path: '/', maxAge: 0 });
  return NextResponse.redirect(new URL('/login', request.url));
}
