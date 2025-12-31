import type { PostgrestFilterBuilder } from '@supabase/supabase-js';

export type EpdListFilters = {
  page: number;
  pageSize: number;
  search?: string | null;
  determinationMethodVersion?: string | null;
  pcrVersion?: string | null;
  databaseVersion?: string | null;
  producerName?: string | null;
  productCategory?: string | null;
  sort?: string | null;
  order?: 'asc' | 'desc';
};

const ALLOWED_SORT_COLUMNS = new Set([
  'created_at',
  'product_name',
  'producer_name',
  'mki_a1a3',
  'mki_d',
  'co2_a1a3',
  'co2_d',
  'publication_date',
]);

const DEFAULT_PAGE_SIZE = 25;

function normalizeValue(value: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export function parseEpdListFilters(searchParams: URLSearchParams): EpdListFilters {
  const page = Number(searchParams.get('page') || '1');
  const pageSize = Number(searchParams.get('pageSize') || DEFAULT_PAGE_SIZE.toString());
  const order = searchParams.get('order') === 'asc' ? 'asc' : 'desc';
  const sort = normalizeValue(searchParams.get('sort'));

  return {
    page: Number.isFinite(page) && page > 0 ? page : 1,
    pageSize: Number.isFinite(pageSize) && pageSize > 0 ? pageSize : DEFAULT_PAGE_SIZE,
    search: normalizeValue(searchParams.get('q')),
    determinationMethodVersion: normalizeValue(searchParams.get('determinationMethodVersion')),
    pcrVersion: normalizeValue(searchParams.get('pcrVersion')),
    databaseVersion: normalizeValue(searchParams.get('databaseVersion')),
    producerName: normalizeValue(searchParams.get('producerName')),
    productCategory: normalizeValue(searchParams.get('productCategory')),
    sort: sort && ALLOWED_SORT_COLUMNS.has(sort) ? sort : null,
    order,
  };
}

export function applyEpdListFilters<T>(query: PostgrestFilterBuilder<T>, filters: EpdListFilters) {
  let nextQuery = query;

  if (filters.search) {
    nextQuery = nextQuery.or(`product_name.ilike.%${filters.search}%,producer_name.ilike.%${filters.search}%`);
  }
  if (filters.determinationMethodVersion) {
    nextQuery = nextQuery.eq('determination_method_version', filters.determinationMethodVersion);
  }
  if (filters.pcrVersion) {
    nextQuery = nextQuery.eq('pcr_version', filters.pcrVersion);
  }
  if (filters.databaseVersion) {
    nextQuery = nextQuery.eq('database_version', filters.databaseVersion);
  }
  if (filters.producerName) {
    nextQuery = nextQuery.eq('producer_name', filters.producerName);
  }
  if (filters.productCategory) {
    nextQuery = nextQuery.eq('product_category', filters.productCategory);
  }

  return nextQuery;
}
