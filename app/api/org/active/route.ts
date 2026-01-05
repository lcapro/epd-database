import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createSupabaseRouteClient, hasSupabaseAuthCookie } from '@/lib/supabase/route';
import { ACTIVE_ORG_COOKIE, ActiveOrgError, getActiveOrgId } from '@/lib/activeOrg';
import { assertOrgMember, OrgAuthError } from '@/lib/orgAuth';

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
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (!user) {
    console.warn('Supabase active org set missing user', {
      requestId,
      hasUser: false,
      hasCookie,
      code: authError?.code ?? null,
      message: authError?.message ?? null,
    });
    return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 });
  }

  const body = await request.json();
  const organizationId = body?.organizationId as string | undefined;
  if (!organizationId) {
    return NextResponse.json({ error: 'organizationId ontbreekt' }, { status: 400 });
  }

  try {
    await assertOrgMember(supabase, user.id, organizationId);
  } catch (err) {
    if (err instanceof OrgAuthError) {
      console.warn('Active org set forbidden', {
        requestId,
        userId: user.id,
        organizationId,
        code: err.code ?? null,
        message: err.message,
      });
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    if (err instanceof ActiveOrgError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('Active org set failed', {
      requestId,
      userId: user.id,
      organizationId,
      message: err instanceof Error ? err.message : 'Onbekende fout',
    });
    return NextResponse.json({ error: 'Kon actieve organisatie niet instellen' }, { status: 500 });
  }

  cookies().set(ACTIVE_ORG_COOKIE, organizationId, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
  });

  return NextResponse.json({ ok: true, organizationId });
}
