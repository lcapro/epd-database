import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabaseClient';
import { buildDatabaseExportRows, exportToCsv, exportToWorkbook } from '@/lib/epdExport';
import { applyEpdListFilters, parseEpdListFilters } from '@/lib/epdFilters';
import type { EpdRecord } from '@/lib/types';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format') || 'excel';
  const filters = parseEpdListFilters(searchParams);
  const admin = getAdminClient();

  let query = admin
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
      ].join(', '),
    )
    .returns<EpdRecord[]>();

  query = applyEpdListFilters(query, filters);

  const sortColumn = filters.sort ?? 'publication_date';
  query = query.order(sortColumn, { ascending: filters.order === 'asc' });

  const { data, error } = await query;

  if (error || !data) {
    return NextResponse.json({ error: error?.message || 'Geen data' }, { status: 500 });
  }

  const rows = buildDatabaseExportRows(data);

  if (format === 'csv') {
    const csv = exportToCsv(rows);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="epds.csv"',
      },
    });
  }

  const buffer = await exportToWorkbook(rows);
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="epds.xlsx"',
    },
  });
}
