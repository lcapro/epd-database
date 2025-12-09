import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabaseClient';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get('page') || '1');
  const pageSize = Number(searchParams.get('pageSize') || '25');
  const q = searchParams.get('q');

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const admin = getAdminClient();

  let query = admin
    .from('epds')
    .select('id, product_name, producer_name, functional_unit, publication_date, expiration_date, standard_set', { count: 'exact' })
    .order('publication_date', { ascending: false })
    .range(from, to);

  if (q) {
    query = query.or(`product_name.ilike.%${q}%,producer_name.ilike.%${q}%`);
  }

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    items: data || [],
    total: count || 0,
    page,
    pageSize,
  });
}
