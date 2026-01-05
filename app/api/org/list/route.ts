import { NextResponse } from 'next/server';
import { createSupabaseRouteClient, getSupabaseCookieStatus } from '@/lib/supabase/route';
import { getSupabaseUserWithRefresh } from '@/lib/supabase/session';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const requestId = crypto.randomUUID();
  const { supabase, applySupabaseCookies } = createSupabaseRouteClient();
  const cookieStatus = getSupabaseCookieStatus();
  const { user, error: authError } = await getSupabaseUserWithRefresh(
    supabase,
    cookieStatus.hasSupabaseAuthCookie,
  );

  if (!user) {
    console.warn('Supabase org list missing user', {
      requestId,
      hasUser: false,
      ...cookieStatus,
      code: authError?.code ?? null,
      message: authError?.message ?? null,
    });
    return applySupabaseCookies(
      NextResponse.json(
      { error: 'Niet ingelogd' },
      {
        status: 401,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      },
      ),
    );
  }

  const { data, error } = await supabase
    .from('organization_members')
    .select('role, organization:organizations(id, name, slug)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Supabase org list failed', {
      requestId,
      userId: user.id,
      code: error.code ?? null,
      message: error.message ?? null,
    });
    return applySupabaseCookies(
      NextResponse.json(
      { error: error.message },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      },
      ),
    );
  }

  const memberships = (data || []).map((membership) => ({
    role: membership.role,
    organization: membership.organization,
  }));

  return applySupabaseCookies(
    NextResponse.json(
    { items: memberships },
    {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    },
    ),
  );
}
