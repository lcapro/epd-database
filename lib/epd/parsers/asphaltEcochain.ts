import type { EpdNormalized, ModuleDeclaration, ParsedEpd, ParsedImpact } from '../../types';
import { normalizeLcaStandard, normalizePcrInfo } from '../normalize';
import { detectStandardSet } from '../standards';
import { dateFromText, firstMatch, getLineValue, normalizePreserveLines } from '../textUtils';
import type { EpdImpactStage, EpdSetType } from '../../types';

const impactStages: EpdImpactStage[] = ['A1', 'A2', 'A3', 'A1-A3', 'D'];

// -------- PCR normalisatie --------
function normalizePcr(pcrRaw: string | undefined): { canonical?: string } {
  if (!pcrRaw) return {};
  const raw = pcrRaw.replace(/\s+/g, ' ').trim();
  const lowered = raw.toLowerCase();
  const v = raw.match(/(\d+(?:\.\d+){0,2})/)?.[1];

  let name: string | undefined;
  if (lowered.includes('nl-pcr') && lowered.includes('asfalt')) name = 'NL-PCR Asfalt';
  else if (lowered.includes('pcr') && lowered.includes('asfalt')) name = 'PCR Asfalt';
  else if (lowered.includes('asfalt')) name = 'Asfalt';
  else {
    name = raw
      .replace(/pcr[:\s]*/i, '')
      .replace(/versie/gi, '')
      .replace(/\d+(?:\.\d+){0,2}/g, '')
      .trim();
    if (!name) name = undefined;
  }

  const canonical = name && v ? `${name} ${v}` : name || (v ? `PCR ${v}` : undefined);
  return { canonical };
}

// -------- LCA normalisatie --------
function normalizeLcaMethod(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const s = raw.replace(/\s+/g, ' ').trim();

  const version =
    s.match(/bepalingsmethode[^0-9]*?(\d+(?:\.\d+){0,2})/i)?.[1] ||
    s.match(/versie\s*(\d+(?:\.\d+){0,2})/i)?.[1];

  if (version) return `NMD Bepalingsmethode ${version}`;
  if (/bepalingsmethode/i.test(s)) return 'NMD Bepalingsmethode';
  return s;
}

// -------- NMD/EcoInvent versies (robust, ook over newline) --------
function extractNmdVersionFromText(text: string): string | undefined {
  const m =
    text.match(/nationale\s+milieudatabase\s+v?\s*([0-9]+(?:\.[0-9]+)*)/i) ||
    text.match(/\bnmd\b[\s\S]{0,80}?v?\s*([0-9]+(?:\.[0-9]+)*)/i);
  return m?.[1];
}

function extractEcoinventVersionFromText(text: string): string | undefined {
  const m =
    text.match(/\becoinvent\b[\s\S]{0,60}?v?\s*([0-9]+(?:\.[0-9]+)*)/i) ||
    text.match(/\bobv\s*ecoinvent\b[\s\S]{0,60}?v?\s*([0-9]+(?:\.[0-9]+)*)/i);
  return m?.[1];
}

function normalizeDatabases(
  raw: string | undefined,
  fullText: string
): { canonical?: string; nmd?: string; ecoinvent?: string } {
  const s = (raw || '').replace(/\s+/g, ' ').trim();

  const nmdV = extractNmdVersionFromText(s) || extractNmdVersionFromText(fullText);
  const ecoV = extractEcoinventVersionFromText(s) || extractEcoinventVersionFromText(fullText);

  const nmd = nmdV ? `NMD v${nmdV}` : undefined;
  const ecoinvent = ecoV ? `EcoInvent v${ecoV}` : undefined;

  const parts = [nmd, ecoinvent].filter(Boolean);
  const canonical = parts.length ? parts.join(' | ') : (s || undefined);

  return { canonical, nmd, ecoinvent };
}

// -------- detect SBK set incl BOTH --------
function detectStandardSetLegacy(text: string): EpdSetType {
  return detectStandardSet(text);
}

// ---------------- IMPACT PARSING (ROBUST) ----------------

const knownIndicators = new Set([
  'MKI',
  'ADPE',
  'ADPF',
  'GWP',
  'ODP',
  'POCP',
  'AP',
  'EP',
  'HTP',
  'FAETP',
  'MAETP',
  'TETP',
  'PERE',
  'PERM',
  'PERT',
  'PENRE',
  'PENRM',
  'PENRT',
  'PET',
  'SM',
  'RSF',
  'NRSF',
  'FW',
  'HWD',
  'NHWD',
  'RWD',
  'CRU',
  'MFR',
  'MER',
  'EE',
  'EET',
  'EEE',
  'ECI',
  // SBK set 2 (+A2) indicatoren
  'GWP-TOTAL',
  'GWP-F',
  'GWP-B',
  'GWP-LULUC',
  'EP-FW',
  'EP-M',
  'EP-T',
  'ADP-MM',
  'ADP-F',
  'WDP',
  'PM',
  'IR',
  'ETP-FW',
  'HTP-C',
  'HTP-NC',
  'SQP',
]);
const orderedIndicators = Array.from(knownIndicators).sort((a, b) => b.length - a.length);

// matches scientific notation with comma/dot decimals: 3,655E+0 or 3.655E+0
const NUM_RE = /[+-]?\d+(?:[.,]\d+)?(?:E[+-]?\d+)?/gi;

function parseNumberToken(tok: string): number | undefined {
  const t = tok.trim();
  if (!t) return undefined;

  // handle "000000" style
  if (/^0+$/.test(t)) return 0;

  const normalized = t.replace(',', '.');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : undefined;
}

function isAlpha(ch: string | undefined): boolean {
  if (!ch) return false;
  return /[a-z]/i.test(ch);
}

function shouldAcceptToken(text: string, start: number, end: number): boolean {
  const prev = text[start - 1];
  const next = text[end];
  const next2 = text[end + 1];
  const prevNonSpace = text.slice(0, start).trimEnd().slice(-1);
  const nextNonSpace = text.slice(end).trimStart()[0];
  const nextNonSpace2 = text.slice(end).trimStart()[1];
  const token = text.slice(start, end);

  if (isAlpha(prev)) return false;
  if (isAlpha(prevNonSpace) && /^\d$/.test(text.slice(start, end)) && nextNonSpace === '-') return false;
  if (isAlpha(prevNonSpace) && /^\d$/.test(token)) return false;
  if (/^\d$/.test(token) && (nextNonSpace === '-' || nextNonSpace === '−')) return false;
  if (isAlpha(next)) return false;
  if (next === '-' && isAlpha(next2)) return false;
  if (nextNonSpace === '-' && isAlpha(nextNonSpace2)) return false;
  return true;
}

function shouldAcceptFirstToken(text: string, start: number, end: number, token: string): boolean {
  const prev = text[start - 1];
  const next = text[end];
  const next2 = text[end + 1];
  const prevNonSpace = text.slice(0, start).trimEnd().slice(-1);
  const nextNonSpace = text.slice(end).trimStart()[0];
  const nextNonSpace2 = text.slice(end).trimStart()[1];

  if (isAlpha(next)) return false;
  if (next === '-' && isAlpha(next2)) return false;
  if (nextNonSpace === '-' && isAlpha(nextNonSpace2)) return false;
  if (isAlpha(prev)) {
    return /e/i.test(token);
  }
  if (isAlpha(prevNonSpace) && /^\d$/.test(token)) return false;
  if (/^\d$/.test(token) && (nextNonSpace === '-' || nextNonSpace === '−')) return false;
  return true;
}

function extractNumberTokens(text: string): string[] {
  const tokens: string[] = [];
  const re = new RegExp(NUM_RE.source, 'gi');
  let match = re.exec(text);
  while (match) {
    const token = match[0];
    if (token) {
      const index = match.index ?? 0;
      const end = index + token.length;
      if (shouldAcceptToken(text, index, end)) {
        tokens.push(token);
      }
    }
    match = re.exec(text);
  }
  return tokens;
}

function insertConcatenatedSeparators(text: string): string {
  const withZeros = text.replace(/E([+-]?\d)(0{1,})(?=\d[.,])/gi, (_match, exp, zeros) => {
    const spacedZeros = Array(zeros.length).fill('0').join(' ');
    return `E${exp} ${spacedZeros} `;
  });
  return withZeros.replace(/E([+-]?\d)(?=\d[.,])/gi, 'E$1 ');
}

function expandLeadingZeroTokens(tokens: string[]): string[] {
  const expanded: string[] = [];
  for (const token of tokens) {
    const match = token.match(/^(0{2,})(\d[.,].*)$/);
    if (match) {
      const zeros = match[1].length;
      for (let i = 0; i < zeros; i += 1) {
        expanded.push('0');
      }
      expanded.push(match[2]);
      continue;
    }
    expanded.push(token);
  }
  return expanded;
}
/**
 * Pak de “Resultaten -> Milieu-impact SBK set X ...” sectie als substring,
 * zodat we NIET per ongeluk de definities (EET=...) pakken.
 */
function sliceResultsSection(text: string, setNo: '1' | '2'): string | undefined {
  const startRe = new RegExp(`milieu-?impact\\s*sbk[\\s_-]*set[\\s_-]*${setNo}`, 'i');
  let startIdx = text.search(startRe);
  if (startIdx < 0) {
    const fallbackRe = new RegExp(`sbk[\\s_-]*set[\\s_-]*${setNo}`, 'i');
    startIdx = text.search(fallbackRe);
    if (startIdx < 0) return undefined;
  }

  // eindigt meestal bij "Ecochain Technologies" footer
  const endIdxCandidates = [
    text.toLowerCase().indexOf('ecochain technologies', startIdx),
    text.toLowerCase().indexOf('h.j.e.', startIdx),
  ].filter((x) => x >= 0);

  const endIdx = endIdxCandidates.length ? Math.min(...endIdxCandidates) : Math.min(text.length, startIdx + 12000);
  return text.slice(startIdx, endIdx);
}

/**
 * Bouw “records” per indicator door regels te groeperen:
 * - soms staat indicator op eigen regel (GWP) en unit op volgende regels
 * - soms zit alles op 1 regel zonder spaties tussen unit en getallen (MKIEuro3,655E+0...)
 */
function findIndicatorInLine(line: string): { indicator: string; index: number } | undefined {
  let best: { indicator: string; index: number } | undefined;

  for (const indicator of orderedIndicators) {
    const upper = line.toUpperCase();
    if (upper.startsWith(indicator)) {
      const nextChar = line.slice(indicator.length, indicator.length + 1);
      if (nextChar === '-' && !indicator.includes('-')) continue;
      if (indicator === 'GWP' && /gwp-?luluc/i.test(line)) continue;
      return { indicator, index: 0 };
    }

    const regex = new RegExp(`\\b${indicator}\\b`, 'i');
    const match = regex.exec(line);
    if (!match) continue;
    const index = match.index ?? 0;
    const slice = line.slice(index);
    const nextChar = slice.slice(indicator.length, indicator.length + 1);
    if (nextChar === '-' && !indicator.includes('-')) continue;
    if (indicator === 'GWP' && /gwp-?luluc/i.test(slice)) continue;
    if (!best || index < best.index) {
      best = { indicator, index };
    }
  }

  return best;
}

function parseImpactTableForSet(text: string, setType: EpdSetType): { indicator: string; unit: string; nums: number[] }[] {
  const setNo: '1' | '2' = setType === 'SBK_SET_2' ? '2' : '1';
  const section = sliceResultsSection(text, setNo);
  if (!section) return [];

  const lines = section.split('\n').map((l) => (l || '').trim()).filter(Boolean);

  const records: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // stop als volgende tabelkop niet meer relevant is
    const low = line.toLowerCase();
    if (low.startsWith('verklaring van vertrouwelijkheid')) break;

    const found = findIndicatorInLine(line);
    if (found) {
      // start record
      let buf = line.slice(found.index);

      // voeg vervolgregels toe zolang ze niet met een nieuwe indicator starten
      let j = i + 1;
      while (j < lines.length) {
        const next = lines[j];
        if (findIndicatorInLine(next)) break;

        // stop hard bij duidelijke footer
        if (next.toLowerCase().includes('ecochain technologies')) break;

        buf += '\n' + next;
        j++;
      }

      records.push(buf);
      i = j - 1;
    }
  }

  const out: { indicator: string; unit: string; nums: number[] }[] = [];

  for (const rec of records) {
    const found = findIndicatorInLine(rec);
    if (!found) continue;

    const rest = rec.slice(found.index + found.indicator.length).trim();

    // maak unit+numbers één string, maar behoud spaties
    const compact = rest.replace(/\s*\n\s*/g, ' ').replace(/\s+/g, ' ').trim();

    let firstIndex: number | undefined;
    const firstRe = new RegExp(NUM_RE.source, 'gi');
    let firstMatch = firstRe.exec(compact);
    while (firstMatch) {
      const token = firstMatch[0];
      if (token) {
        const index = firstMatch.index ?? 0;
        const end = index + token.length;
        if (shouldAcceptFirstToken(compact, index, end, token)) {
          firstIndex = index;
          break;
        }
      }
      firstMatch = firstRe.exec(compact);
    }
    if (firstIndex === undefined) continue;

    const unitRaw = compact.slice(0, firstIndex).trim();
    const numsRaw = insertConcatenatedSeparators(compact.slice(firstIndex).trim());

    // extract numbers (A1 A2 A3 A1-A3 D Totaal) -> we nemen eerste 5
    let tokens = extractNumberTokens(numsRaw);
    if (tokens.length < 3 && /^0+$/.test(numsRaw.replace(/\s+/g, ''))) {
      tokens = Array(5).fill('0');
    }
    tokens = expandLeadingZeroTokens(tokens);
    const nums: number[] = [];
    for (const t of tokens) {
      const n = parseNumberToken(t);
      if (n === undefined) continue;
      nums.push(n);
    }

    let normalizedNums = nums.slice(0, 5);
    if (normalizedNums.length === 2) {
      normalizedNums = [normalizedNums[0], 0, 0, normalizedNums[1], 0];
    } else if (normalizedNums.length === 3) {
      normalizedNums = [normalizedNums[0], 0, 0, normalizedNums[1], normalizedNums[2]];
    } else if (normalizedNums.length === 4) {
      normalizedNums = [normalizedNums[0], normalizedNums[1], normalizedNums[2], normalizedNums[3], 0];
    }
    if (normalizedNums.length < 1) continue;

    out.push({ indicator: found.indicator, unit: unitRaw, nums: normalizedNums });
  }

  return out;
}

export function parseAsphaltEpd(raw: string): ParsedEpd {
  const text = normalizePreserveLines(raw);

  const parsed: ParsedEpd = {
    productName: undefined,
    functionalUnit: undefined,
    producerName: undefined,
    lcaMethod: undefined,
    pcrVersion: undefined,
    databaseName: undefined,
    databaseNmdVersion: undefined,
    databaseEcoinventVersion: undefined,
    publicationDate: undefined,
    expirationDate: undefined,
    verifierName: undefined,
    standardSet: detectStandardSetLegacy(text),
    impacts: [],
  };

  // basis
  parsed.productName =
    getLineValue(text, ['Product:', 'Productnaam', 'Product naam', 'Product name', 'Product']) ||
    firstMatch(text, [/^product\s*naam[:\s]*([^\n]{2,160})/im, /^product\s*name[:\s]*([^\n]{2,160})/im]);

  parsed.functionalUnit =
    getLineValue(text, ['Eenheid:', 'Functionele eenheid', 'Functional unit', 'Eenheid']) ||
    firstMatch(text, [/^functionele\s*eenheid[:\s]*([^\n]{2,160})/im, /^functional\s*unit[:\s]*([^\n]{2,160})/im]);

  parsed.producerName =
    getLineValue(text, ['Producent:', 'Producent', 'Producer']) ||
    firstMatch(text, [/^producent[:\s]*([^\n]{2,160})/im, /^producer[:\s]*([^\n]{2,160})/im]);

  // publicatie/geldigheid
  const publicationRaw =
    getLineValue(text, ['Datum van publicatie', 'Publicatie datum', 'Publicatie']) ||
    firstMatch(text, [/datum\s+van\s+publicatie[:\s]*([^\n]+)/i, /publicatie[:\s]*datum[:\s]*([^\n]+)/i]);

  const expirationRaw =
    getLineValue(text, ['Einde geldigheid', 'Geldig tot', 'Expiration']) ||
    firstMatch(text, [/einde\s*geldigheid[:\s]*([^\n]+)/i]);

  parsed.publicationDate = dateFromText(publicationRaw || '') || dateFromText(text);
  parsed.expirationDate = dateFromText(expirationRaw || '');

  // ---- Verificateur (houden zoals het werkte; tolerant voor split) ----
  const verifier =
    getLineValue(text, ['Verificateur', 'Verifier', 'Toetser']) ||
    firstMatch(text, [
      /(?:verificateur|verifier|toetser)\s*[:\-]\s*([^\n]{2,120})/i,
      /veri.{0,3}cateur\s*[:\-]\s*([^\n]{2,120})/i,
    ]);
  parsed.verifierName = verifier;

  // LCA methode normaliseren
  const lcaRaw =
    getLineValue(text, ['LCA standaard', 'LCA-methode', 'Bepalingsmethode']) ||
    firstMatch(text, [/lca\s*standaard[:\s]*([^\n]+)/i, /bepalingsmethode[:\s]*([^\n]+)/i]);
  parsed.lcaMethod = normalizeLcaMethod(lcaRaw);

  // PCR normaliseren
  const pcrRaw =
    getLineValue(text, ['PCR', 'PCR:']) ||
    firstMatch(text, [/^pcr[:\s]*([^\n]+)/im, /pcr[-\s]*asfalt\s*versie[:\s]*([^\n]+)/i]);
  parsed.pcrVersion = normalizePcr(pcrRaw).canonical;

  // Database: normaliseren + split NMD/EcoInvent
  const dbRaw =
    getLineValue(text, ['Standaard database', 'Database']) ||
    firstMatch(text, [/standaard\s*database[:\s]*([^\n]+)/i, /database[:\s]*([^\n]+)/i]);

  const dbNorm = normalizeDatabases(dbRaw, text);
  parsed.databaseName = dbNorm.canonical;
  parsed.databaseNmdVersion = dbNorm.nmd;
  parsed.databaseEcoinventVersion = dbNorm.ecoinvent;

  // sets
  parsed.standardSet = detectStandardSetLegacy(text);

  // impacts uit Resultaten-sectie (robust)
  const impacts: ParsedImpact[] = [];
  const setsToTry: EpdSetType[] = ['SBK_SET_1', 'SBK_SET_2'];

  for (const setType of setsToTry) {
    const rows = parseImpactTableForSet(text, setType);

    for (const r of rows) {
      const [a1, a2, a3, a1a3, d] = r.nums;

      if (a1 !== undefined) impacts.push({ indicator: r.indicator, setType, stage: 'A1', value: a1, unit: r.unit });
      if (a2 !== undefined) impacts.push({ indicator: r.indicator, setType, stage: 'A2', value: a2, unit: r.unit });
      if (a3 !== undefined) impacts.push({ indicator: r.indicator, setType, stage: 'A3', value: a3, unit: r.unit });
      if (a1a3 !== undefined) impacts.push({ indicator: r.indicator, setType, stage: 'A1-A3', value: a1a3, unit: r.unit });
      if (d !== undefined) impacts.push({ indicator: r.indicator, setType, stage: 'D', value: d, unit: r.unit });
    }
  }

  const hasMki = impacts.some((impact) => impact.indicator === 'MKI');
  const eciImpacts = impacts.filter((impact) => impact.indicator === 'ECI');
  if (!hasMki && eciImpacts.length > 0) {
    eciImpacts.forEach((impact) => {
      impacts.push({ ...impact, indicator: 'MKI' });
    });
  }

  parsed.impacts = impacts;

  // extra zekerheid: als we echt impacts voor beide sets hebben
  const hasSet1 = parsed.impacts.some((i) => i.setType === 'SBK_SET_1');
  const hasSet2 = parsed.impacts.some((i) => i.setType === 'SBK_SET_2');
  if (hasSet1 && hasSet2) parsed.standardSet = 'SBK_BOTH';

  // geldigheid fallback (5 jaar)
  if ((!parsed.expirationDate || parsed.expirationDate === '') && parsed.publicationDate) {
    const pubDate = new Date(parsed.publicationDate);
    if (!Number.isNaN(pubDate.getTime())) {
      const exp = new Date(pubDate);
      exp.setFullYear(exp.getFullYear() + 5);
      parsed.expirationDate = exp.toISOString().slice(0, 10);
    }
  }

  return parsed;
}

function buildModulesFromImpacts(impacts: ParsedImpact[]): ModuleDeclaration[] {
  const modules = new Set<string>();
  impacts.forEach((impact) => modules.add(impact.stage));
  return Array.from(modules).map((module) => ({ module, declared: true }));
}

function buildResultsFromImpacts(impacts: ParsedImpact[]) {
  const grouped = new Map<string, { indicator: string; unit?: string; setType: EpdSetType; values: Record<string, number | null> }>();
  impacts.forEach((impact) => {
    const key = `${impact.indicator}|${impact.setType}`;
    const entry = grouped.get(key) || { indicator: String(impact.indicator), unit: impact.unit, setType: impact.setType, values: {} };
    entry.values[impact.stage] = impact.value;
    if (!entry.unit && impact.unit) entry.unit = impact.unit;
    grouped.set(key, entry);
  });
  return Array.from(grouped.values());
}

export function buildNormalizedFromLegacy(parsed: ParsedEpd): EpdNormalized {
  const pcrInfo = normalizePcrInfo(parsed.pcrVersion);
  return {
    productName: parsed.productName,
    declaredUnit: parsed.functionalUnit,
    manufacturer: parsed.producerName,
    issueDate: parsed.publicationDate,
    validUntil: parsed.expirationDate,
    pcr: pcrInfo,
    lcaStandard: normalizeLcaStandard(parsed.lcaMethod),
    verified: undefined,
    verifier: parsed.verifierName,
    database: parsed.databaseName,
    modulesDeclared: buildModulesFromImpacts(parsed.impacts),
    results: buildResultsFromImpacts(parsed.impacts),
    impacts: parsed.impacts,
    standardSet: parsed.standardSet,
    rawExtract: {
      parser: 'asphaltEcochain',
    },
  };
}

export const asphaltEcochainParser = {
  id: 'asphaltEcochainV1',
  canParse: (input: { text: string }) => {
    const lower = input.text.toLowerCase();
    let score = 0;
    if (lower.includes('asfalt')) score += 0.6;
    if (lower.includes('ecochain')) score += 0.2;
    if (lower.includes('pcr') && lower.includes('asfalt')) score += 0.2;
    return {
      score,
      reason: score ? 'Herken asfalt/Ecochain termen' : 'Geen duidelijke asfalt signalen',
    };
  },
  parse: (input: { text: string }) => {
    const legacy = parseAsphaltEpd(input.text);
    return {
      normalized: buildNormalizedFromLegacy(legacy),
      legacy,
    };
  },
};
