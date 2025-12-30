import ExcelJS from 'exceljs';
import { ALL_INDICATOR_CODES } from './impactIndicators';
import { EpdImpactRecord, EpdRecord } from './types';

export interface ExportEpdShape extends EpdRecord {
  impacts: EpdImpactRecord[];
}

const defaultStages = ['A1', 'A2', 'A3', 'A1-A3', 'D'] as const;
const defaultIndicators = ['MKI', 'CO2', ...ALL_INDICATOR_CODES.filter((code) => !['MKI', 'CO2'].includes(code))] as const;
const defaultSets = ['SBK_SET_1', 'SBK_SET_2'] as const;

type RowValue = string | number | null;

function mergeOrdered(defaults: readonly string[], extras: string[]) {
  const uniqueExtras = Array.from(new Set(extras))
    .filter((value) => value && !defaults.includes(value))
    .sort((a, b) => a.localeCompare(b));
  return [...defaults, ...uniqueExtras];
}

function collectImpactDimensions(epds: ExportEpdShape[]) {
  const indicators: string[] = [];
  const sets: string[] = [];
  const stages: string[] = [];

  epds.forEach((epd) => {
    epd.impacts.forEach((impact) => {
      if (impact.indicator) indicators.push(String(impact.indicator));
      if (impact.set_type) sets.push(String(impact.set_type));
      if (impact.stage) stages.push(String(impact.stage));
    });
  });

  return {
    indicators: mergeOrdered(defaultIndicators, indicators),
    sets: mergeOrdered(defaultSets, sets),
    stages: mergeOrdered(defaultStages, stages),
  };
}

function buildColumns(epds: ExportEpdShape[]) {
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

  const { indicators, sets, stages } = collectImpactDimensions(epds);
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
  const columns = buildColumns(epds);
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

  const data: unknown = await workbook.xlsx.writeBuffer();
  if (data instanceof ArrayBuffer) {
    return data;
  }
  if (ArrayBuffer.isView(data)) {
    return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  }
  return new Uint8Array(data as ArrayBufferLike).buffer;
}
