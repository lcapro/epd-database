import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const requestId = crypto.randomUUID();
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 });
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
    return NextResponse.json(
      { error: error.message },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      },
    );
  }

  const memberships = (data || []).map((membership) => ({
    role: membership.role,
    organization: membership.organization,
  }));

  return NextResponse.json(
    { items: memberships },
    {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    },
  );
}
