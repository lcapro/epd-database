import { NextResponse } from 'next/server';
import { createSupabaseRouteClient, getSupabaseCookieStatus } from '@/lib/supabase/route';
import { requireActiveOrgId } from '@/lib/activeOrg';
import { assertOrgMember, OrgAuthError } from '@/lib/orgAuth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type FilterOptions = {
  determinationMethodVersions: string[];
  pcrVersions: string[];
  databaseVersions: string[];
  producers: string[];
  productCategories: string[];
};

function uniq(values: (string | null)[]) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value && value.trim().length)))).sort(
    (a, b) => a.localeCompare(b),
  );
}

async function fetchColumnValues(
  supabase: ReturnType<typeof createSupabaseRouteClient>['supabase'],
  column: string,
  organizationId: string,
  requestId: string,
  userId: string,
) {
  const { data, error } = await supabase
    .from('epds')
    .select(column)
    .eq('organization_id', organizationId)
    .not(column, 'is', null)
    .order(column, { ascending: true })
    .limit(500)
    .returns<Record<string, string | null>[]>();

  if (error) {
    console.error('Supabase EPD filter fetch failed', {
      requestId,
      userId,
      organizationId,
      column,
      code: error.code ?? null,
      message: error.message ?? null,
    });
    return [];
  }
  return data.map((row) => row[column] ?? null);
}

export async function GET() {
  const requestId = crypto.randomUUID();
  const { supabase, applySupabaseCookies } = createSupabaseRouteClient();
  const cookieStatus = getSupabaseCookieStatus();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (!user) {
    console.warn('Supabase EPD filters missing user', {
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
      console.warn('EPD filters forbidden', {
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

  const [
    determinationMethodVersions,
    pcrVersions,
    databaseVersions,
    producers,
    productCategories,
  ] = await Promise.all([
    fetchColumnValues(supabase, 'determination_method_version', activeOrgId, requestId, user.id),
    fetchColumnValues(supabase, 'pcr_version', activeOrgId, requestId, user.id),
    fetchColumnValues(supabase, 'database_version', activeOrgId, requestId, user.id),
    fetchColumnValues(supabase, 'producer_name', activeOrgId, requestId, user.id),
    fetchColumnValues(supabase, 'product_category', activeOrgId, requestId, user.id),
  ]);

  const payload: FilterOptions = {
    determinationMethodVersions: uniq(determinationMethodVersions),
    pcrVersions: uniq(pcrVersions),
    databaseVersions: uniq(databaseVersions),
    producers: uniq(producers),
    productCategories: uniq(productCategories),
  };

  return applySupabaseCookies(
    NextResponse.json(payload, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    }),
  );
}
