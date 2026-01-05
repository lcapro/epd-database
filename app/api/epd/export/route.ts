import { NextResponse } from 'next/server';
import { createSupabaseRouteClient, getSupabaseCookieStatus } from '@/lib/supabase/route';
import { requireActiveOrgId } from '@/lib/activeOrg';
import { assertOrgMember, OrgAuthError } from '@/lib/orgAuth';
import { buildDatabaseExportRowsWithImpacts, exportToCsv, exportToWorkbook } from '@/lib/epdExport';
import type { DatabaseExportRecord, DatabaseExportWithImpacts } from '@/lib/epdExport';
import type { EpdImpactRecord } from '@/lib/types';
import { applyEpdListFilters, parseEpdListFilters } from '@/lib/epdFilters';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  const requestId = crypto.randomUUID();
  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format') || 'excel';
  const filters = parseEpdListFilters(searchParams);
  const { supabase, applySupabaseCookies } = createSupabaseRouteClient();
  const cookieStatus = getSupabaseCookieStatus();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (!user) {
    console.warn('Supabase EPD export missing user', {
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
      console.warn('EPD export forbidden', {
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
        'mki_a1a3',
        'mki_d',
        'co2_a1a3',
        'co2_d',
        'determination_method_version',
        'pcr_version',
        'database_version',
        'product_category',
        'created_at',
        'epd_impacts (indicator, set_type, stage, value, unit)',
      ].join(', '),
    );

  query = query.eq('organization_id', activeOrgId);
  query = applyEpdListFilters(query, filters);

  const sortColumn = filters.sort ?? 'publication_date';
  query = query.order(sortColumn, { ascending: filters.order === 'asc' });

  const { data, error } = await query.returns<
    (DatabaseExportRecord & { epd_impacts: EpdImpactRecord[] | null })[]
  >();

  if (error || !data) {
    console.error('Supabase EPD export failed', {
      requestId,
      userId: user.id,
      organizationId: activeOrgId,
      code: error?.code ?? null,
      message: error?.message ?? null,
    });
    const response = NextResponse.json(
      { error: error?.message || 'Geen data' },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      },
    );
    return applySupabaseCookies(response);
  }

  const withImpacts: DatabaseExportWithImpacts[] = data.map((epd) => ({
    ...epd,
    impacts: epd.epd_impacts ?? [],
  }));
  const rows = buildDatabaseExportRowsWithImpacts(withImpacts);

  if (format === 'csv') {
    const csv = exportToCsv(rows);
    const response = new NextResponse(csv, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="epds.csv"',
      },
    });
    return applySupabaseCookies(response);
  }

  const buffer = await exportToWorkbook(rows);
  const response = new NextResponse(buffer, {
    status: 200,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="epds.xlsx"',
    },
  });
  return applySupabaseCookies(response);
}
