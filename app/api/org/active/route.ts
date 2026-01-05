import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createSupabaseRouteClient, hasSupabaseAuthCookie } from '@/lib/supabase/route';
import { ACTIVE_ORG_COOKIE, ActiveOrgError, getActiveOrgId } from '@/lib/activeOrg';
import { assertOrgMember, OrgAuthError } from '@/lib/orgAuth';
import { buildActiveOrgPostResult } from '@/lib/org/activeOrgPost';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const requestId = crypto.randomUUID();
  const supabase = createSupabaseRouteClient();
  const hasCookie = hasSupabaseAuthCookie();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (!user) {
    console.warn('Supabase active org missing user', {
      requestId,
      hasUser: false,
      hasCookie,
      code: authError?.code ?? null,
      message: authError?.message ?? null,
    });
    return NextResponse.json(
      { error: 'Niet ingelogd' },
      {
        status: 401,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      },
    );
  }

  const activeOrgId = getActiveOrgId();
  if (!activeOrgId) {
    return NextResponse.json(
      { organizationId: null },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      },
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
      return NextResponse.json(
        { error: err.message },
        {
          status: err.status,
          headers: {
            'Cache-Control': 'no-store, max-age=0',
          },
        },
      );
    }
    console.error('Active org lookup failed', {
      requestId,
      userId: user.id,
      organizationId: activeOrgId,
      message: err instanceof Error ? err.message : 'Onbekende fout',
    });
    return NextResponse.json(
      { error: 'Kon actieve organisatie niet ophalen' },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      },
    );
  }

  return NextResponse.json(
    { organizationId: activeOrgId },
    {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    },
  );
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  const supabase = createSupabaseRouteClient();
  const hasCookie = hasSupabaseAuthCookie();
  const cookieStore = cookies();
  const result = await buildActiveOrgPostResult({ request, supabase, hasCookie, requestId });
  if (result.setCookie) {
    cookieStore.set(result.setCookie.name, result.setCookie.value, result.setCookie.options);
  }
  return NextResponse.json(result.body, { status: result.status, headers: result.headers });
}
