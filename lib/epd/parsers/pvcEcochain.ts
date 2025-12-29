import type { EpdNormalized, ModuleDeclaration } from '../../types';
import { normalizeLcaStandard, normalizePcrInfo } from '../normalize';
import { detectStandardSet } from '../standards';
import { dateFromText, firstMatch, getLineValue, normalizePreserveLines } from '../textUtils';
import { parseImpactTableDynamic } from '../impactTable';
import { extractDatabaseVersions } from '../utils';

function extractManufacturerWithAddress(text: string): { manufacturer?: string; address?: string } {
  const manufacturer =
    getLineValue(text, ['Manufacturer', 'Producent', 'Producer']) ||
    firstMatch(text, [/manufacturer[:\s]*([^\n]+)/i, /producent[:\s]*([^\n]+)/i]);

  const address = getLineValue(text, ['Address', 'Adres']) || firstMatch(text, [/address[:\s]*([^\n]+)/i]);

  const cleanManufacturer = manufacturer ? manufacturer.split(' - ')[0].trim() : undefined;
  return { manufacturer: cleanManufacturer || manufacturer, address };
}

function parseVerified(text: string): { verified?: boolean; verifier?: string } {
  const verifiedRaw =
    getLineValue(text, ['Verified', 'Verified by', 'Geverifieerd']) ||
    firstMatch(text, [/verified[:\s]*([^\n]+)/i]);

  const verifier =
    getLineValue(text, ['Verifier', 'Verificateur', 'Toetser']) ||
    firstMatch(text, [
      /verifier[:\s]*([^\n]+)/i,
      /verificateur[:\s]*([^\n]+)/i,
      /verifier[:\s]*\n\s*([^\n]+)/i,
      /veri\s*er[:\s]*([^\n]+)/i,
      /veri\s*er[:\s]*\n\s*([^\n]+)/i,
      /v\s*e\s*r\s*i\s*f\s*i\s*e\s*r[:\s]*([^\n]+)/i,
      /v\s*e\s*r\s*i\s*f\s*i\s*e\s*r[:\s]*\n\s*([^\n]+)/i,
    ]);

  if (!verifiedRaw) return { verifier };
  const normalized = verifiedRaw.toLowerCase();
  if (['yes', 'ja', 'true'].some((v) => normalized.includes(v))) return { verified: true, verifier };
  if (['no', 'nee', 'false'].some((v) => normalized.includes(v))) return { verified: false, verifier };
  return { verifier };
}

function extractValueAfterLabel(text: string, label: string): string | undefined {
  const lines = text.split('\n').map((line) => line.trim());
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.toLowerCase() === label.toLowerCase() || line.toLowerCase() === `${label.toLowerCase()}:`) {
      const next = lines[i + 1];
      if (next) return next;
    }
  }
  return undefined;
}

function normalizeDeclaredUnit(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const cleaned = raw.replace(/\s+/g, ' ').trim();
  const match = cleaned.match(/^(\d+(?:[.,]\d+)?)\s*(.*)$/);
  if (!match) return cleaned;
  const value = match[1].replace(',', '.');
  const unitRaw = match[2].toLowerCase();

  if (/(ton|tonne|tonnes|t\b)/i.test(unitRaw)) return `${value} ton`;
  if (/(stuk|stuks|piece|pieces|p\b|st\.\b)/i.test(unitRaw)) return `${value} stuk`;
  return cleaned;
}

function buildModules(modules: string[], mndModules: Set<string>): ModuleDeclaration[] {
  return modules.map((module) => ({
    module,
    declared: !mndModules.has(module),
    mnd: mndModules.has(module) || undefined,
  }));
}

function extractStandardDatabase(text: string): { database?: string; ecoinvent?: string } {
  const raw =
    getLineValue(text, ['Standard database', 'Standaard database', 'Database']) ||
    firstMatch(text, [/standard\s*database[:\s]*([^\n]+)/i, /database[:\s]*([^\n]+)/i]);

  const { ecoinvent } = extractDatabaseVersions(raw || text);
  if (ecoinvent) return { database: `EcoInvent v${ecoinvent}`, ecoinvent: `EcoInvent v${ecoinvent}` };
  return { database: raw };
}

export const pvcEcochainParser = {
  id: 'pvcEcochainV1',
  canParse: (input: { text: string }) => {
    const lower = input.text.toLowerCase();
    let score = 0;
    if (lower.includes('ecochain v3.')) score += 0.4;
    if (lower.includes('u3 pipe') || lower.includes('pvc')) score += 0.5;
    if (lower.includes('results') && lower.includes('environmental impact')) score += 0.1;
    return {
      score,
      reason: score ? 'Herken Ecochain PVC pijp layout' : 'Geen duidelijke PVC Ecochain signalen',
    };
  },
  parse: (input: { text: string }) => {
    const text = normalizePreserveLines(input.text);

    const productName =
      getLineValue(text, ['Product', 'Product:']) ||
      firstMatch(text, [/product[:\s]*([^\n]{2,200})/i]);

    const declaredUnit =
      getLineValue(text, ['Unit', 'Eenheid', 'Functional unit']) ||
      firstMatch(text, [/unit[:\s]*([^\n]+)/i, /functional\s*unit[:\s]*([^\n]+)/i]);

    const { manufacturer, address } = extractManufacturerWithAddress(text);

    const issueRaw =
      getLineValue(text, ['Issue date', 'Datum van publicatie', 'Publication date']) ||
      firstMatch(text, [/issue\s*date[:\s]*([^\n]+)/i, /publication\s*date[:\s]*([^\n]+)/i]);

    const validRaw =
      getLineValue(text, ['End of validity', 'Expiration date', 'Einde geldigheid']) ||
      firstMatch(text, [/end\s*of\s*validity[:\s]*([^\n]+)/i, /expiration\s*date[:\s]*([^\n]+)/i]);

    const lcaRaw =
      getLineValue(text, ['LCA standard', 'LCA-methode', 'Bepalingsmethode']) ||
      firstMatch(text, [/lca\s*standard[:\s]*([^\n]+)/i, /bepalingsmethode[:\s]*([^\n]+)/i]);

    const pcrRaw =
      getLineValue(text, ['PCR']) ||
      firstMatch(text, [/pcr[:\s]*([^\n]+)/i]);

    const standardSet = detectStandardSet(text);
    const hasSet2Indicators = /gwp-total|gwp-f|gwp-b|gwp-luluc|ep-fw|ep-m|ep-t|adp-mm|adp-f|wdp|pm|ir|etp-fw|htp-c|htp-nc|sqp/i.test(
      text
    );
    const derivedSet = standardSet === 'UNKNOWN' && hasSet2Indicators ? 'SBK_SET_2' : standardSet;
    const setType = derivedSet === 'SBK_SET_2' ? 'SBK_SET_2' : 'SBK_SET_1';

    let { results, modules, mndModules } = parseImpactTableDynamic(text, setType, {
      allowFallbackSection: standardSet === 'UNKNOWN' || derivedSet === 'SBK_SET_2',
    });

    const mkiRow = results.find((row) => row.indicator === 'MKI');
    const eciRow = results.find((row) => row.indicator === 'ECI');
    const rowHasValues = (row: typeof results[number] | undefined) =>
      !!row && Object.values(row.values).some((value) => value !== null && value !== undefined);
    if (eciRow && rowHasValues(eciRow)) {
      results = results.filter((row) => row.indicator !== 'MKI');
      results = [
        {
          ...eciRow,
          indicator: 'MKI',
        },
        ...results,
      ];
    } else if (mkiRow) {
      results = [
        {
          ...mkiRow,
          indicator: 'ECI',
        },
        ...results,
      ];
    }

    const { verified, verifier } = parseVerified(text);
    const verifierFallback =
      verifier ||
      extractValueAfterLabel(text, 'Verifier') ||
      extractValueAfterLabel(text, 'Veri er') ||
      extractValueAfterLabel(text, 'Verificateur');
    const { database, ecoinvent } = extractStandardDatabase(text);

    return {
      normalized: {
        productName,
        declaredUnit: normalizeDeclaredUnit(declaredUnit),
        manufacturer: manufacturer || address,
        issueDate: dateFromText(issueRaw || '') || dateFromText(text),
        validUntil: dateFromText(validRaw || ''),
        pcr: normalizePcrInfo(pcrRaw),
        lcaStandard: normalizeLcaStandard(lcaRaw),
        verified,
        verifier: verifierFallback,
        database,
        modulesDeclared: buildModules(modules, mndModules),
        results,
        impacts: [],
        standardSet: derivedSet,
        rawExtract: {
          address,
          databaseEcoinventVersion: ecoinvent,
        },
      },
    };
  },
};
