import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabaseClient';
import { buildExportRows, exportToCsv, exportToWorkbook, ExportEpdShape } from '@/lib/epdExport';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format') || 'excel';
  const admin = getAdminClient();

  const { data, error } = await admin
    .from('epds')
    .select('*, epd_impacts(*)');

  if (error || !data) {
    return NextResponse.json({ error: error?.message || 'Geen data' }, { status: 500 });
  }

  const rows = buildExportRows(data as unknown as ExportEpdShape[]);

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
