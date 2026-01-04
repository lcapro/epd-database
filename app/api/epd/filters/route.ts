import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getActiveOrgIdFromRequest } from '@/lib/organizations';

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
  supabase: ReturnType<typeof createSupabaseServerClient>,
  column: string,
  organizationId: string,
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
    return [];
  }
  return data.map((row) => row[column] ?? null);
}

export async function GET(request: Request) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 });
  }

  const activeOrgId = getActiveOrgIdFromRequest(request, cookies());
  if (!activeOrgId) {
    return NextResponse.json({ error: 'Geen actieve organisatie geselecteerd' }, { status: 400 });
  }

  const [
    determinationMethodVersions,
    pcrVersions,
    databaseVersions,
    producers,
    productCategories,
  ] = await Promise.all([
    fetchColumnValues(supabase, 'determination_method_version', activeOrgId),
    fetchColumnValues(supabase, 'pcr_version', activeOrgId),
    fetchColumnValues(supabase, 'database_version', activeOrgId),
    fetchColumnValues(supabase, 'producer_name', activeOrgId),
    fetchColumnValues(supabase, 'product_category', activeOrgId),
  ]);

  const payload: FilterOptions = {
    determinationMethodVersions: uniq(determinationMethodVersions),
    pcrVersions: uniq(pcrVersions),
    databaseVersions: uniq(databaseVersions),
    producers: uniq(producers),
    productCategories: uniq(productCategories),
  };

  return NextResponse.json(payload, {
    headers: {
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}
