import { ParsedEpd, ParsedImpact, EpdImpactStage, EpdSetType } from './types';

const impactStages: EpdImpactStage[] = ['A1', 'A2', 'A3', 'A1_A3', 'D'];

/**
 * Normalisatie met behoud van regels (belangrijk voor tabellen),
 * maar wel opgeschoonde whitespace per regel.
 */
function normalizeStage(stage: string): 'A1' | 'A2' | 'A3' | 'A1_A3' | 'D' | null {
  const s = stage.trim().toUpperCase();
  if (s === 'A1') return 'A1';
  if (s === 'A2') return 'A2';
  if (s === 'A3') return 'A3';
  if (s === 'A1-A3' || s === 'A1_A3') return 'A1_A3';
  if (s === 'D') return 'D';
  return null;
}

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
    const idx = lowered.findIndex((lab) => line.toLowerCase().startsWith(lab));
    if (idx >= 0) {
      const raw = line.split(':').slice(1).join(':').trim();
      if (raw) return raw;
    }
  }
  return undefined;
}

function parseNumberLoose(value?: string | null): number | undefined {
  if (!value) return undefined;
  const v = value.replace(/\s+/g, '');
  const normalized = v.replace(',', '.');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : undefined;
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
  // Kan zijn: "Ecoinvent\n3.6" of "Ecoinvent v3.6"
  const m =
    text.match(/\becoinvent\b[\s\S]{0,40}?v?\s*([0-9]+(?:\.[0-9]+)*)/i) ||
    text.match(/\bobv\s*ecoinvent\b[\s\S]{0,40}?v?\s*([0-9]+(?:\.[0-9]+)*)/i);
  return m?.[1];
}

function normalizeDatabases(raw: string | undefined, fullText: string): { canonical?: string; nmd?: string; ecoinvent?: string } {
  if (!raw) {
    // fallback: toch proberen uit hele tekst
    const nmdV = extractNmdVersionFromText(fullText);
    const ecoV = extractEcoinventVersionFromText(fullText);
    return {
      canonical: undefined,
      nmd: nmdV ? `NMD v${nmdV}` : undefined,
      ecoinvent: ecoV ? `EcoInvent v${ecoV}` : undefined,
    };
  }

  const s = raw.replace(/\s+/g, ' ').trim();

  const nmdV = extractNmdVersionFromText(s) || extractNmdVersionFromText(fullText);
  const ecoV = extractEcoinventVersionFromText(s) || extractEcoinventVersionFromText(fullText);

  const nmd = nmdV ? `NMD v${nmdV}` : undefined;
  const ecoinvent = ecoV ? `EcoInvent v${ecoV}` : undefined;

  const parts = [nmd, ecoinvent].filter(Boolean);
  const canonical = parts.length ? parts.join(' | ') : s;

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

// -------- impact parsing --------
type ParsedTableRow = {
  indicator: string;
  unit: string;
  values: Partial<Record<EpdImpactStage, number>>;
};

const knownIndicators = new Set([
  'MKI','ADPE','ADPF','GWP','ODP','POCP','AP','EP','HTP','FAETP','MAETP','TETP',
  'PERE','PERM','PERT','PENRE','PENRM','PENRT','PET','SM','RSF','NRSF','FW',
  'HWD','NHWD','RWD','CRU','MFR','MER','EE','EET','EEE',
]);

/**
 * Vindt de tabel op basis van de daadwerkelijke headerregel:
 * "Milieu-impact SBK set 1 ..." of "Milieu-impact SBK set 2 ..."
 *
 * In jouw PDF staat "Resultaten" vaak op een aparte regel, daarom niet daarop matchen.
 */
function parseImpactTableForSet(text: string, setType: EpdSetType): ParsedTableRow[] {
  const lines = text.split('\n');
  const setNo = setType === 'SBK_SET_2' ? '2' : '1';

  const headerIdx = lines.findIndex((l) => {
    const low = l.toLowerCase();
    return low.includes('milieu') && low.includes('impact') && low.includes('sbk') && low.includes(`set ${setNo}`);
  });

  if (headerIdx < 0) return [];

  // Neem een ruime window vanaf de header (inclusief mogelijke split lines)
  const window = lines.slice(headerIdx + 1, headerIdx + 280);

  // Merge regels: als een regel geen getal heeft maar de volgende wel, plak ze aan elkaar.
  const merged: string[] = [];
  for (let i = 0; i < window.length; i++) {
    const cur = (window[i] || '').trim();
    if (!cur) continue;

    const low = cur.toLowerCase();
    // Stop wanneer bedrijfsfooter begint
    if (low.includes('ecochain technologies') || low.startsWith('ecochain technologies')) break;

    const hasNumber = /[0-9]/.test(cur);
    const next = (window[i + 1] || '').trim();

    if (!hasNumber && next && /[0-9]/.test(next)) {
      merged.push(`${cur} ${next}`);
      i++;
      continue;
    }
    merged.push(cur);
  }

  const rows: ParsedTableRow[] = [];

  for (const line of merged) {
    const firstToken = line.split(' ')[0]?.trim();
    if (!firstToken || !knownIndicators.has(firstToken)) continue;

    const tokens = line.split(' ').filter(Boolean);

    // Zoek eerste token met cijfers
    const firstNumIdx = tokens.findIndex((t) => /[0-9]/.test(t));
    if (firstNumIdx < 0) continue;

    const indicator = tokens[0];

    // unit zit tussen indicator en eerste nummer (kan "kg CO2-eq" etc. zijn)
    const unit = tokens.slice(1, firstNumIdx).join(' ').replace(/\s+/g, ' ').trim();

    const numberTokens = tokens.slice(firstNumIdx);

    // In tabel: A1 A2 A3 A1-A3 D Totaal (we willen eerste 5; Totaal negeren)
    const nums: number[] = [];
    for (const t of numberTokens) {
      const n = parseNumberLoose(t);
      if (n !== undefined) nums.push(n);
      if (nums.length >= 5) break;
    }
    if (nums.length < 3) continue;

    const values: ParsedTableRow['values'] = {};
    if (nums[0] !== undefined) values.A1 = nums[0];
    if (nums[1] !== undefined) values.A2 = nums[1];
    if (nums[2] !== undefined) values.A3 = nums[2];
    if (nums[3] !== undefined) values['A1-A3'] = nums[3];
    if (nums[4] !== undefined) values.D = nums[4];

    rows.push({ indicator, unit: unit || '', values });
  }

  return rows;
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

  // ---- Verificateur (NIET slopen; tolerant voor pdf-parse splits) ----
  const verifier =
    getLineValue(text, ['Verificateur', 'Verifier', 'Toetser']) ||
    firstMatch(text, [
      /(?:verificateur|verifier|toetser)\s*[:\-]\s*([^\n]{2,120})/i,
      // "Veri cateur" / "Veri￾cateur" etc.
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

  // impacts uit tabellen
  const impacts: ParsedImpact[] = [];

  const setsToTry: EpdSetType[] = ['SBK_SET_1', 'SBK_SET_2'];
  for (const setType of setsToTry) {
    const rows = parseImpactTableForSet(text, setType);

    for (const row of rows) {
      for (const stage of impactStages) {
        const v = row.values[stage];
        if (v === undefined) continue;

      const normalizedStage = normalizeStage(stage);
      if (!normalizedStage) continue;
      
      impacts.push({
        indicator: row.indicator,
        setType: setType as any,
        stage: normalizedStage,
        value: v,
        unit: row.unit || '',
      });
      }
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
