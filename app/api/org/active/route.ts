import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ACTIVE_ORG_COOKIE, ActiveOrgError, getActiveOrgId } from '@/lib/activeOrg';
import { assertOrgMember, OrgAuthError } from '@/lib/orgAuth';

export async function GET() {
  const requestId = crypto.randomUUID();
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 });
  }

  const activeOrgId = getActiveOrgId();
  if (!activeOrgId) {
    return NextResponse.json({ organizationId: null });
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
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('Active org lookup failed', {
      requestId,
      userId: user.id,
      organizationId: activeOrgId,
      message: err instanceof Error ? err.message : 'Onbekende fout',
    });
    return NextResponse.json({ error: 'Kon actieve organisatie niet ophalen' }, { status: 500 });
  }

  return NextResponse.json({ organizationId: activeOrgId });
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
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
