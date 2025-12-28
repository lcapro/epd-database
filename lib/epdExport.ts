import ExcelJS from 'exceljs';
import { EpdImpactRecord, EpdRecord } from './types';

export interface ExportEpdShape extends EpdRecord {
  impacts: EpdImpactRecord[];
}

const stages = ['A1', 'A2', 'A3', 'A1-A3', 'D'] as const;
const indicators = ['MKI', 'CO2'] as const;
const sets = ['SBK_SET_1', 'SBK_SET_2'] as const;

type RowValue = string | number | null;

function buildColumns() {
  const base = [
    'id',
    'product_name',
    'producer_name',
    'functional_unit',
    'lca_method',
    'pcr_version',
    'database_name',
    'publication_date',
    'expiration_date',
    'verifier_name',
    'standard_set',
  ];

  const impactColumns: string[] = [];
  indicators.forEach((indicator) => {
    sets.forEach((setType) => {
      stages.forEach((stage) => {
        impactColumns.push(`${indicator}_${setType}_${stage}`);
      });
    });
  });

  return [...base, ...impactColumns, 'custom_attributes_json'];
}

export function buildExportRows(epds: ExportEpdShape[]) {
  const columns = buildColumns();
  return epds.map((epd) => {
    const row: Record<string, RowValue> = {};
    columns.forEach((col) => { row[col] = null; });

    row.id = epd.id;
    row.product_name = epd.product_name;
    row.producer_name = epd.producer_name ?? '';
    row.functional_unit = epd.functional_unit;
    row.lca_method = epd.lca_method ?? '';
    row.pcr_version = epd.pcr_version ?? '';
    row.database_name = epd.database_name ?? '';
    row.publication_date = epd.publication_date ?? '';
    row.expiration_date = epd.expiration_date ?? '';
    row.verifier_name = epd.verifier_name ?? '';
    row.standard_set = epd.standard_set;

    epd.impacts.forEach((impact) => {
      const key = `${impact.indicator}_${impact.set_type}_${impact.stage}`;
      row[key] = impact.value ?? null;
    });

    row.custom_attributes_json = JSON.stringify(epd.custom_attributes || {});

    return row;
  });
}

export function exportToCsv(rows: Record<string, RowValue>[]): string {
  if (rows.length === 0) return '';
  const header = Object.keys(rows[0]);
  const lines = [header.join(';')];
  rows.forEach((row) => {
    const line = header
      .map((key) => {
        const value = row[key];
        if (value === null || value === undefined) return '';
        const stringVal = typeof value === 'string' ? value.replace(/"/g, '""') : value.toString();
        return /[;\n"]/.test(stringVal) ? `"${stringVal}"` : stringVal;
      })
      .join(';');
    lines.push(line);
  });
  return lines.join('\n');
}

export async function exportToWorkbook(
  rows: Record<string, RowValue>[]
): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('EPDs');

  if (rows.length > 0) {
    sheet.columns = Object.keys(rows[0]).map((key) => ({ header: key, key }));
    rows.forEach((row) => sheet.addRow(row));
  }

  // exceljs geeft al een ArrayBuffer terug, dat is precies wat NextResponse verwacht
  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return arrayBuffer;
}
