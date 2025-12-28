import { ParsedEpd, ParsedImpact, EpdImpactStage, EpdSetType } from './types';

const impactStages: EpdImpactStage[] = ['A1', 'A2', 'A3', 'A1_A3', 'D'];

/**
 * pdf-parse output bevat soms rare “control glyphs” (zoals ￾) middenin woorden:
 * bijv: "Veri￾cateur" of "ge veri￾eerd". Die slopen je string matching.
 */
function cleanupPdfGlyphs(input: string): string {
  return input
    // veelvoorkomende “unknown glyph” uit pdf-parse in jouw PDF: ￾
    .replace(/\uFFFE|\uFFFF/g, '')
    .replace(/￾/g, '') // <- BELANGRIJK voor jouw case
    // sommige pdf’s geven “ﬁ” ligature of andere combining chars:
    .replace(/\uFB01/g, 'fi')
    .replace(/\uFB02/g, 'fl')
    // normaliseer whitespace
    .replace(/[ \t]+/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
}

function normalizePreserveLines(input: string): string {
  const cleaned = cleanupPdfGlyphs(input);

  return cleaned
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

function getLineValue(text: string, labelVariants: string[]): string | undefined {
  const lines = text.split('\n');

  // robuuster: strip punctuation en lowercase, zodat "Verificateur:" en "Verificateur" allebei matchen
  const normalizeLabel = (s: string) =>
    s
      .toLowerCase()
      .replace(/[:\s]+$/g, '')
      .replace(/[^a-z0-9]+/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const lowered = labelVariants.map(normalizeLabel);

  for (const line of lines) {
    const lineNorm = normalizeLabel(line);
    const idx = lowered.findIndex((lab) => lineNorm.startsWith(lab));
    if (idx >= 0) {
      // pak alles na ":" als die bestaat, anders na label
      const hasColon = line.includes(':');
      const raw = hasColon ? line.split(':').slice(1).join(':').trim() : line.slice(labelVariants[idx].length).trim();
      if (raw) return raw;
    }
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

// -------- Database normalisatie + split NMD/EcoInvent --------
function normalizeDatabases(raw: string | undefined): { canonical?: string; nmd?: string; ecoinvent?: string } {
  if (!raw) return {};

  // LET OP: raw kan een newline bevatten (zoals bij jouw "Ecoinvent\n3.6")
  const s = raw.replace(/[ \t]+/g, ' ').trim();

  const nmdV =
    s.match(/nationale\s+milieudatabase\s+v?\s*([0-9]+(?:\.[0-9]+)*)/i)?.[1] ||
    s.match(/\bnmd\b[\s\S]*?v?\s*([0-9]+(?:\.[0-9]+)*)/i)?.[1];

  // <-- FIX: laat hem over newlines matchen
  const ecoV =
    s.match(/\becoinvent\b[\s\S]{0,40}?v?\s*([0-9]+(?:\.[0-9]+)*)/i)?.[1];

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
  values: Record<EpdImpactStage, number>;
};

function parseImpactTableForSet(text: string, setType: EpdSetType): ParsedTableRow[] {
  const setLabel = setType === 'SBK_SET_2' ? 'SBK set 2' : 'SBK set 1';
  const lines = text.split('\n');

  const startIdx = lines.findIndex(
    (l) => l.toLowerCase().includes('resultaten') && l.toLowerCase().includes(setLabel.toLowerCase())
  );
  if (startIdx < 0) return [];

  const window = lines.slice(startIdx, startIdx + 220);

  const merged: string[] = [];
  for (let i = 0; i < window.length; i++) {
    const cur = window[i].trim();
    if (!cur) continue;

    const low = cur.toLowerCase();
    if (
      i > 10 &&
      (low.startsWith('gebruik van grondsto') ||
        low.startsWith('output stromen') ||
        low.startsWith('verklaring van vertrouwelijkheid') ||
        low.includes('ecochain technologies'))
    ) {
      break;
    }

    const hasNumber = /[\d]/.test(cur);
    if (!hasNumber && window[i + 1] && /[\d]/.test(window[i + 1])) {
      merged.push(`${cur} ${window[i + 1].trim()}`);
      i++;
      continue;
    }
    merged.push(cur);
  }

  const rows: ParsedTableRow[] = [];
  const knownIndicators = [
    'MKI','ADPE','ADPF','GWP','ODP','POCP','AP','EP','HTP','FAETP','MAETP','TETP',
    'PERE','PERM','PERT','PENRE','PENRM','PENRT','PET','SM','RSF','NRSF','FW',
    'HWD','NHWD','RWD','CRU','MFR','MER','EE','EET','EEE',
  ];

  for (const line of merged) {
    const firstToken = line.split(' ')[0]?.trim();
    if (!firstToken || !knownIndicators.includes(firstToken)) continue;

    const tokens = line.split(' ').filter(Boolean);
    const firstNumIdx = tokens.findIndex((t) => /[\d]/.test(t) && /[0-9]/.test(t));
    if (firstNumIdx < 0) continue;

    const indicator = tokens[0];
    const unit = tokens.slice(1, firstNumIdx).join(' ').replace(/\s+/g, ' ').trim();

    const numberTokens = tokens.slice(firstNumIdx);
    const nums: number[] = [];
    for (const t of numberTokens) {
      const n = parseNumberLoose(t);
      if (n !== undefined) nums.push(n);
      if (nums.length >= 5) break;
    }
    if (nums.length < 3) continue;

    const values: Record<EpdImpactStage, number> = {} as any;
    if (nums[0] !== undefined) values.A1 = nums[0];
    if (nums[1] !== undefined) values.A2 = nums[1];
    if (nums[2] !== undefined) values.A3 = nums[2];
    if (nums[3] !== undefined) values.A1_A3 = nums[3];
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

  parsed.productName =
    getLineValue(text, ['Productnaam', 'Product naam', 'Product name', 'Product']) ||
    firstMatch(text, [/^product\s*naam[:\s]*([^\n]{2,160})/im, /^product\s*name[:\s]*([^\n]{2,160})/im]);

  parsed.functionalUnit =
    getLineValue(text, ['Functionele eenheid', 'Functional unit', 'Eenheid']) ||
    firstMatch(text, [/^functionele\s*eenheid[:\s]*([^\n]{2,160})/im, /^functional\s*unit[:\s]*([^\n]{2,160})/im]);

  parsed.producerName =
    getLineValue(text, ['Producent', 'Producer']) ||
    firstMatch(text, [/^producent[:\s]*([^\n]{2,120})/im, /^producer[:\s]*([^\n]{2,120})/im]);

  const publicationRaw =
    getLineValue(text, ['Datum van publicatie', 'Publicatie datum', 'Publicatie']) ||
    firstMatch(text, [/datum\s+van\s+publicatie[:\s]*([^\n]+)/i, /publicatie[:\s]*datum[:\s]*([^\n]+)/i]);

  const expirationRaw =
    getLineValue(text, ['Einde geldigheid', 'Geldig tot', 'Expiration']) ||
    firstMatch(text, [/einde\s*geldigheid[:\s]*([^\n]+)/i]);

  parsed.publicationDate = dateFromText(publicationRaw || '') || dateFromText(text);
  parsed.expirationDate = dateFromText(expirationRaw || '');

  /**
   * ✅ FIX verifier:
   * - Door cleanupPdfGlyphs is "Veri￾cateur" al "Verificateur"
   * - Maar we houden regex ook tolerant voor toekomst (rommel / ligatures)
   */
  const verifier =
    getLineValue(text, ['Verificateur', 'Verificateur', 'Verifier', 'Toetser']) ||
    firstMatch(text, [
      /(?:verificateur|verificateur|verifier|toetser)\s*[:\-]\s*([^\n]{2,80})/i,
      /veri[\s\S]{0,6}cateu?r\s*[:\-]\s*([^\n]{2,80})/i, // tolerant voor splits/rommel
    ]);

  parsed.verifierName = verifier;

  const lcaRaw =
    getLineValue(text, ['LCA standaard', 'LCA-methode', 'Bepalingsmethode']) ||
    firstMatch(text, [/lca\s*standaard[:\s]*([^\n]+)/i, /bepalingsmethode[:\s]*([^\n]+)/i]);

  parsed.lcaMethod = normalizeLcaMethod(lcaRaw);

  const pcrLine =
    getLineValue(text, ['PCR', 'PCR:']) ||
    firstMatch(text, [/pcr[:\s]*([^\n]+)/i, /pcr[-\s]*asfalt\s*versie[:\s]*([^\n]+)/i]);

  parsed.pcrVersion = normalizePcr(pcrLine).canonical;

  /**
   * ✅ FIX database parsing:
   * - In jouw PDF staat EcoInvent versie op volgende regel ("Ecoinvent\n3.6") :contentReference[oaicite:2]{index=2}
   * - Daarom voegen we ook een multi-line extract toe als fallback.
   */
  const dbRaw =
    getLineValue(text, ['Standaard database', 'Database']) ||
    firstMatch(text, [/standaard\s*database[:\s]*([^\n]+(?:\n[^\n]+){0,2})/i, /database[:\s]*([^\n]+)/i]);

  const dbNorm = normalizeDatabases(dbRaw);
  parsed.databaseName = dbNorm.canonical;
  parsed.databaseNmdVersion = dbNorm.nmd;
  parsed.databaseEcoinventVersion = dbNorm.ecoinvent;

  parsed.standardSet = detectStandardSet(text);

  const impacts: ParsedImpact[] = [];
  const setsToTry: EpdSetType[] = ['SBK_SET_1', 'SBK_SET_2'];

  for (const setType of setsToTry) {
    const rows = parseImpactTableForSet(text, setType);
    for (const row of rows) {
      for (const stage of impactStages) {
        const v = row.values[stage];
        if (v === undefined) continue;
        impacts.push({
          indicator: row.indicator,
          setType: setType as any,
          stage,
          value: v,
          unit: row.unit || '',
        } as any);
      }
    }
  }

  parsed.impacts = impacts;

  const hasSet1 = parsed.impacts.some((i) => i.setType === 'SBK_SET_1');
  const hasSet2 = parsed.impacts.some((i) => i.setType === 'SBK_SET_2');
  if (hasSet1 && hasSet2) parsed.standardSet = 'SBK_BOTH';

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
