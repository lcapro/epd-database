import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabaseClient';
import { applyEpdListFilters, parseEpdListFilters } from '@/lib/epdFilters';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const filters = parseEpdListFilters(searchParams);
  const from = (filters.page - 1) * filters.pageSize;
  const to = from + filters.pageSize - 1;

  const admin = getAdminClient();

  let query = admin
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

  query = applyEpdListFilters(query, filters);

  const sortColumn = filters.sort ?? 'publication_date';
  query = query.order(sortColumn, { ascending: filters.order === 'asc' });

  const { data, error, count } = await query;

  if (error) {
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

  return NextResponse.json(
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
  );
}
