import { NextResponse } from 'next/server';
import { createSupabaseRouteClient, getSupabaseCookieStatus } from '@/lib/supabase/route';
import { requireActiveOrgId } from '@/lib/activeOrg';
import { assertOrgMember, OrgAuthError } from '@/lib/orgAuth';
import { applyEpdListFilters, parseEpdListFilters } from '@/lib/epdFilters';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  const requestId = crypto.randomUUID();
  const { searchParams } = new URL(request.url);
  const filters = parseEpdListFilters(searchParams);
  const from = (filters.page - 1) * filters.pageSize;
  const to = from + filters.pageSize - 1;

  const { supabase, applySupabaseCookies } = createSupabaseRouteClient();
  const cookieStatus = getSupabaseCookieStatus();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (!user) {
    console.warn('Supabase EPD list missing user', {
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

  let activeOrgId: string | null = null;
  try {
    activeOrgId = requireActiveOrgId();
    await assertOrgMember(supabase, user.id, activeOrgId);
  } catch (err) {
    if (err instanceof OrgAuthError) {
      console.warn('EPD list forbidden', {
        requestId,
        userId: user.id,
        organizationId: activeOrgId ?? null,
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
    const message = err instanceof Error ? err.message : 'Geen actieve organisatie geselecteerd';
    return applySupabaseCookies(
      NextResponse.json(
      { error: message },
      {
        status: 400,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      },
      ),
    );
  }

  if (!activeOrgId) {
    return applySupabaseCookies(
      NextResponse.json(
      { error: 'Geen actieve organisatie geselecteerd. Kies eerst een organisatie.' },
      {
        status: 400,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      },
      ),
    );
  }

  let query = supabase
    .from('epds')
    .select(
      [
        'id',
        'product_name',
        'producer_name',
        'functional_unit',
        'publication_date',
        'expiration_date',
        'standard_set',
        'determination_method_version',
        'pcr_version',
        'database_version',
        'product_category',
        'mki_a1a3',
        'mki_d',
        'co2_a1a3',
        'co2_d',
        'created_at',
        'updated_at',
        'status',
      ].join(', '),
      { count: 'exact' },
    )
    .range(from, to);

  query = query.eq('organization_id', activeOrgId);
  query = applyEpdListFilters(query, filters);

  const sortColumn = filters.sort ?? 'publication_date';
  query = query.order(sortColumn, { ascending: filters.order === 'asc' });

  const { data, error, count } = await query;

  if (error) {
    console.error('Supabase EPD list failed', {
      requestId,
      userId: user.id,
      organizationId: activeOrgId,
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

  return applySupabaseCookies(
    NextResponse.json(
    {
      items: data || [],
      total: count || 0,
      page: filters.page,
      pageSize: filters.pageSize,
    },
    {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    },
    ),
  );
}
