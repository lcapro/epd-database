import { NextResponse } from 'next/server';
import { createSupabaseRouteClient, getSupabaseCookieStatus } from '@/lib/supabase/route';
import { getActiveOrgId } from '@/lib/activeOrg';
import { assertOrgMember, OrgAuthError } from '@/lib/orgAuth';
import { buildActiveOrgPostResult } from '@/lib/org/activeOrgPost';
import { getSupabaseUserWithRefresh } from '@/lib/supabase/session';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const requestId = crypto.randomUUID();
  const { supabase, applySupabaseCookies } = createSupabaseRouteClient();
  const cookieStatus = getSupabaseCookieStatus();
  const { user, error: authError, attempts } = await getSupabaseUserWithRefresh(
    supabase,
    cookieStatus.hasSupabaseAuthCookie,
  );

  if (!user) {
    console.warn('Supabase active org missing user', {
      requestId,
      hasUser: false,
      ...cookieStatus,
      code: authError?.code ?? null,
      message: authError?.message ?? null,
      attempt: `${attempts}/2`,
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

  const activeOrgId = getActiveOrgId();
  if (!activeOrgId) {
    return applySupabaseCookies(
      NextResponse.json(
      { organizationId: null },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      },
      ),
    );
  }

  try {
    await assertOrgMember(supabase, user.id, activeOrgId);
  } catch (err) {
    if (err instanceof OrgAuthError) {
      console.warn('Active org membership invalid', {
        requestId,
        userId: user.id,
        organizationId: activeOrgId,
        code: err.code ?? null,
        message: err.message,
      });
      return applySupabaseCookies(
        NextResponse.json(
        { error: err.message },
        {
          status: err.status,
          headers: {
            'Cache-Control': 'no-store, max-age=0',
          },
        },
        ),
      );
    }
    console.error('Active org lookup failed', {
      requestId,
      userId: user.id,
      organizationId: activeOrgId,
      message: err instanceof Error ? err.message : 'Onbekende fout',
    });
    return applySupabaseCookies(
      NextResponse.json(
      { error: 'Kon actieve organisatie niet ophalen' },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      },
      ),
    );
  }

  return applySupabaseCookies(
    NextResponse.json(
    { organizationId: activeOrgId },
    {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    },
    ),
  );
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  const { supabase, applySupabaseCookies } = createSupabaseRouteClient();
  const cookieStatus = getSupabaseCookieStatus();
  const result = await buildActiveOrgPostResult({
    request,
    supabase,
    cookieStatus,
    requestId,
  });
  const response = applySupabaseCookies(
    NextResponse.json(result.body, { status: result.status, headers: result.headers }),
  );
  if (result.setCookie) {
    response.cookies.set({
      name: result.setCookie.name,
      value: result.setCookie.value,
      ...result.setCookie.options,
    });
  }
  return response;
}
