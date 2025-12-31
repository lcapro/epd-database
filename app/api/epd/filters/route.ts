import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabaseClient';

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

async function fetchColumnValues(admin: ReturnType<typeof getAdminClient>, column: string) {
  const { data, error } = await admin
    .from('epds')
    .select(column)
    .not(column, 'is', null)
    .order(column, { ascending: true })
    .limit(500)
    .returns<Record<string, string | null>[]>();

  if (error) {
    return [];
  }
  return data.map((row) => row[column] ?? null);
}

export async function GET() {
  const admin = getAdminClient();

  const [
    determinationMethodVersions,
    pcrVersions,
    databaseVersions,
    producers,
    productCategories,
  ] = await Promise.all([
    fetchColumnValues(admin, 'determination_method_version'),
    fetchColumnValues(admin, 'pcr_version'),
    fetchColumnValues(admin, 'database_version'),
    fetchColumnValues(admin, 'producer_name'),
    fetchColumnValues(admin, 'product_category'),
  ]);

  const payload: FilterOptions = {
    determinationMethodVersions: uniq(determinationMethodVersions),
    pcrVersions: uniq(pcrVersions),
    databaseVersions: uniq(databaseVersions),
    producers: uniq(producers),
    productCategories: uniq(productCategories),
  };

  return NextResponse.json(payload);
}
