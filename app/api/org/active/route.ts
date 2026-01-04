import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ACTIVE_ORG_COOKIE } from '@/lib/organizations';

export async function GET() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 });
  }

  const activeOrgId = cookies().get(ACTIVE_ORG_COOKIE)?.value;
  if (!activeOrgId) {
    return NextResponse.json({ organization: null });
  }

  const { data: membership } = await supabase
    .from('organization_members')
    .select('organization:organizations(id, name, slug)')
    .eq('organization_id', activeOrgId)
    .eq('user_id', user.id)
    .single();

  return NextResponse.json({ organization: membership?.organization ?? null });
}

export async function POST(request: Request) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 });
  }

  const body = await request.json();
  const orgId = body?.orgId as string | undefined;
  if (!orgId) {
    return NextResponse.json({ error: 'orgId ontbreekt' }, { status: 400 });
  }

  const { data: membership } = await supabase
    .from('organization_members')
    .select('organization:organizations(id, name, slug)')
    .eq('organization_id', orgId)
    .eq('user_id', user.id)
    .single();

  if (!membership?.organization) {
    return NextResponse.json({ error: 'Geen toegang tot organisatie' }, { status: 403 });
  }

  cookies().set(ACTIVE_ORG_COOKIE, orgId, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
  });

  return NextResponse.json({ ok: true, organization: membership.organization });
}
