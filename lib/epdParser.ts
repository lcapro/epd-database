import { ParsedEpd, ParsedImpact, EpdImpactStage, EpdSetType } from './types';

const impactStages: EpdImpactStage[] = ['A1', 'A2', 'A3', 'A1-A3', 'D'];

/**
 * Normalisatie met behoud van regels (belangrijk voor tabellen),
 * maar wel opgeschoonde whitespace per regel.
 */
function normalizePreserveLines(input: string): string {
  return input
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => l.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function firstMatch(text: string, patterns: RegExp[]): string | undefined {
  for (const p of patterns) {
    const m = text.match(p);
    if (m?.[1]) return m[1].trim();
  }
  return undefined;
}

function getLineValue(text: string, labelVariants: string[]): string | undefined {
  const lines = text.split('\n');
  const lowered = labelVariants.map((l) => l.toLowerCase());

  for (const line of lines) {
    const idx = lowered.findIndex((lab) => line.toLowerCase().startsWith(lab.toLowerCase()));
    if (idx >= 0) {
      const raw = line.split(':').slice(1).join(':').trim();
      if (raw) return raw;
    }
  }
  return undefined;
}

function dateFromText(text: string): string | undefined {
  const matchIso = text.match(/(20\d{2}[-/](0?[1-9]|1[0-2])[-/](0?[1-9]|[12]\d|3[01]))/);
  if (matchIso?.[1]) return matchIso[1].replace(/\//g, '-');

  const matchNl = text.match(/(0?[1-9]|[12]\d|3[01])[-/](0?[1-9]|1[0-2])[-/](20\d{2})/);
  if (matchNl) {
    const day = matchNl[1].padStart(2, '0');
    const month = matchNl[2].padStart(2, '0');
    const year = matchNl[3];
    return `${year}-${month}-${day}`;
  }
  return undefined;
}

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
function detectStandardSet(text: string): EpdSetType {
  const t = text.toLowerCase();
  const has1 = t.includes('sbk set 1') || t.includes('en 15804+a1') || t.includes('en15804+a1');
  const has2 = t.includes('sbk set 2') || t.includes('en 15804+a2') || t.includes('en15804+a2');
  if (has1 && has2) return 'SBK_BOTH';
  if (has1) return 'SBK_SET_1';
  if (has2) return 'SBK_SET_2';
  return 'UNKNOWN';
}

// ---------------- IMPACT PARSING (ROBUST) ----------------

const knownIndicators = new Set([
  'MKI','ADPE','ADPF','GWP','ODP','POCP','AP','EP','HTP','FAETP','MAETP','TETP',
  'PERE','PERM','PERT','PENRE','PENRM','PENRT','PET','SM','RSF','NRSF','FW',
  'HWD','NHWD','RWD','CRU','MFR','MER','EE','EET','EEE',
]);
const orderedIndicators = Array.from(knownIndicators).sort((a, b) => b.length - a.length);

// matches scientific notation with comma/dot decimals: 3,655E+0 or 3.655E+0
// require whitespace/end after token to avoid unit strings like CO2 or 1,4-DB-eq
const NUM_RE = /[+-]?\d+(?:[.,]\d+)?(?:E[+-]?\d+)?(?=\s|$)/gi;
const FIRST_NUM_RE = /[+-]?\d+(?:[.,]\d+)?(?:E[+-]?\d+)?(?=\s|$)/i;

function parseNumberToken(tok: string): number | undefined {
  const t = tok.trim();
  if (!t) return undefined;

  // handle "000000" style
  if (/^0+$/.test(t)) return 0;

  const normalized = t.replace(',', '.');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Pak de “Resultaten -> Milieu-impact SBK set X ...” sectie als substring,
 * zodat we NIET per ongeluk de definities (EET=...) pakken.
 */
function sliceResultsSection(text: string, setNo: '1' | '2'): string | undefined {
  const startRe = new RegExp(`milieu-?impact\\s*sbk\\s*set\\s*${setNo}`, 'i');
  const startIdx = text.search(startRe);
  if (startIdx < 0) return undefined;

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
function parseImpactTableForSet(text: string, setType: EpdSetType): { indicator: string; unit: string; nums: number[] }[] {
  const setNo: '1' | '2' = setType === 'SBK_SET_2' ? '2' : '1';
  const section = sliceResultsSection(text, setNo);
  if (!section) return [];

  const lines = section.split('\n').map((l) => (l || '').trim()).filter(Boolean);

  const detectIndicator = (line: string): string | undefined => {
    const trimmed = line.trim();
    const upper = trimmed.toUpperCase();
    for (const indicator of orderedIndicators) {
      if (upper.startsWith(indicator)) return indicator;
    }
    return undefined;
  };

  const records: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // stop als volgende tabelkop niet meer relevant is
    const low = line.toLowerCase();
    if (low.startsWith('verklaring van vertrouwelijkheid')) break;

    const indicator = detectIndicator(line);
    if (indicator) {
      // start record
      let buf = line;

      // voeg vervolgregels toe zolang ze niet met een nieuwe indicator starten
      let j = i + 1;
      while (j < lines.length) {
        const next = lines[j];
        if (detectIndicator(next)) break;

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
    const indicator = detectIndicator(rec);
    if (!indicator) continue;

    const rest = rec.slice(indicator.length).trim();

    // maak unit+numbers één string, maar behoud spaties
    const compact = rest.replace(/\s*\n\s*/g, ' ').replace(/\s+/g, ' ').trim();

    const m = compact.match(FIRST_NUM_RE);
    if (!m || m.index === undefined) continue;

    const unitRaw = compact.slice(0, m.index).trim();
    const numsRaw = compact.slice(m.index).trim();

    // extract numbers (A1 A2 A3 A1-A3 D Totaal) -> we nemen eerste 5
    const tokens = numsRaw.match(NUM_RE) || [];
    const nums: number[] = [];
    for (const t of tokens) {
      const n = parseNumberToken(t);
      if (n === undefined) continue;
      nums.push(n);
      if (nums.length >= 5) break;
    }
    if (nums.length < 3) continue;

    out.push({ indicator, unit: unitRaw, nums });
  }

  return out;
}

// -------- MAIN --------
export function parseEpd(raw: string): ParsedEpd {
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
    standardSet: detectStandardSet(text),
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
  parsed.standardSet = detectStandardSet(text);

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
