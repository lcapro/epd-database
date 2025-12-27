import { ParsedEpd, ParsedImpact, EpdImpactStage, EpdSetType } from './types';

/**
 * Stap 6 – Parser (volledig, aangepast)
 * Doelen:
 * - Metadata (product, FU, producent, publicatie/geldigheid, verifier, PCR/database) beter uit tekst halen
 * - Impacttabellen robuust uitlezen voor Ecochain/NMD-achtige formats (zoals jouw asfalt PDF)
 * - Alle impactcategorieën (MKI, GWP, ADPE, ADPF, ODP, POCP, AP, EP, HTP, FAETP, MAETP, TETP, + resources/waste)
 * - Unit per indicator meenemen (als jouw types/schema dit ondersteunen)
 *
 * Belangrijk:
 * - We behouden een "lineText" (met \n) zodat tabellen beter te herkennen zijn.
 * - Daarnaast maken we "flatText" (whitespace compact) voor metadata-regex.
 *
 * Vereist/aanbevolen:
 * - ParsedImpact.indicator: string (niet alleen 'MKI'|'CO2')
 * - ParsedImpact.unit?: string
 * - UI: niet hardcoden op MKI/CO2, maar dynamisch op parsed.impacts/DB (dat was stap 4/5).
 */

const impactStages: EpdImpactStage[] = ['A1', 'A2', 'A3', 'A1_A3', 'D'];

// In veel EPD teksten komt "A1-A3" voor. In jouw UI/DB noemen we dat A1_A3.
const STAGE_ORDER_FROM_TABLE: Array<{ label: string; stage: EpdImpactStage }> = [
  { label: 'A1', stage: 'A1' },
  { label: 'A2', stage: 'A2' },
  { label: 'A3', stage: 'A3' },
  { label: 'A1-A3', stage: 'A1_A3' },
  { label: 'D', stage: 'D' },
];

// Belangrijkste indicatoren om te scannen in tabellen.
// (Je kunt dit later uitbreiden. Het mooie: UI kan alles tonen wat binnenkomt.)
const INDICATORS_ORDERED: string[] = [
  // Core impact
  'MKI',
  'GWP',
  'ADPE',
  'ADPF',
  'ODP',
  'POCP',
  'AP',
  'EP',
  'HTP',
  'FAETP',
  'MAETP',
  'TETP',

  // Resource / energie / materialen (EN15804-achtig)
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

  // Waste / output flows
  'HWD',
  'NHWD',
  'RWD',
  'CRU',
  'MFR',
  'MER',
  'EE',
  'EET',
  'EEE',
];

// Variaties / aliassen die je in PDF-tekst ziet.
const INDICATOR_ALIASES: Record<string, string> = {
  // Soms staat CO2 of "CO2-tot" etc. In tabellen zie je vaak GWP.
  CO2: 'GWP',
  'CO2-tot': 'GWP',
  'GWP-tot': 'GWP',
  'GWP-total': 'GWP',
  'GWP tot': 'GWP',
};

function normalizeLines(input: string): string {
  // Houd linebreaks intact (tabellen!)
  return input
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeFlat(input: string): string {
  // Compact voor metadata zoeken
  return input.replace(/\s+/g, ' ').trim();
}

function cleanUnit(unit: string): string {
  return unit
    .replace(/\s+/g, ' ')
    .replace(/\u00A0/g, ' ')
    .trim()
    .replace(/^\[|\]$/g, '');
}

/**
 * Getal parser:
 * - 3,655E+0
 * - 6,419E+0
 * - -1,664E+1
 * - 0 / 000000
 * - 12.34
 */
function parseNumberToken(token?: string | null): number | undefined {
  if (!token) return undefined;
  const t = token.trim();
  if (!t) return undefined;

  // Soms komt "000000" voor -> 0
  if (/^0+$/.test(t)) return 0;

  // Normaliseer decimal comma
  const normalized = t.replace(',', '.');

  // parseFloat pakt ook scientific notation
  const parsed = parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function dateFromTextLoose(text: string): string | undefined {
  // ondersteunt:
  // - 2024-11-28
  // - 28-11-2024
  // - 28/11/2024
  const t = text || '';
  const iso = t.match(/\b(20\d{2})[-/](0?[1-9]|1[0-2])[-/](0?[1-9]|[12]\d|3[01])\b/);
  if (iso) {
    const [_, y, m, d] = iso;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  const dmy = t.match(/\b(0?[1-9]|[12]\d|3[01])[-/](0?[1-9]|1[0-2])[-/](20\d{2})\b/);
  if (dmy) {
    const [_, d, m, y] = dmy;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return undefined;
}

function detectStandardSet(flatText: string): EpdSetType {
  const lowered = flatText.toLowerCase();
  // In jouw sample: "SBK set 1" staat expliciet
  if (lowered.includes('sbk set 1') || lowered.includes('en 15804+a1') || lowered.includes('en15804 +a1')) {
    return 'SBK_SET_1';
  }
  if (lowered.includes('sbk set 2') || lowered.includes('en 15804+a2') || lowered.includes('en15804 +a2')) {
    return 'SBK_SET_2';
  }
  return 'UNKNOWN';
}

/**
 * Vind secties in lineText op basis van header hints.
 * We knippen de tekst van header tot de volgende header.
 */
function sliceSection(lineText: string, headerRegex: RegExp): string | null {
  const m = headerRegex.exec(lineText);
  if (!m || m.index === undefined) return null;

  const start = m.index;
  const afterStart = lineText.slice(start);

  // Stop bij een volgende "Resultaten" of "Gebruik" of "Output" of einde doc.
  const stop = afterStart.search(
    /\n\s*(Resultaten\s+Milieu-impact|Gebruik\s+van\s+grondstof|Output\s+stromen|Verklaring\s+van\s+vertrouwelijkheid|Ecochain\s+Technologies)\b/i
  );

  if (stop === -1) return afterStart;
  return afterStart.slice(0, stop);
}

/**
 * Parse 1 tabelregel voor 1 indicator:
 * We verwachten:
 *   INDICATOR + unit + A1 + A2 + A3 + A1-A3 + D + (optioneel Totaal)
 *
 * Voorbeeld (uit jouw PDF):
 *   MKI Euro 3,655E+0 7,058E-1 1,520E+0 5,881E+0 -2,198E+0 3,683E+0
 *   GWP kg CO 2 -eq 2,840E+1 6,419E+0 2,131E+1 5,612E+1 -1,664E+1 3,948E+1
 */
function parseIndicatorRowFromSection(sectionFlat: string, indicator: string): { unit?: string; values: number[] } | null {
  // Nummer-token: 1) scientific  2) gewone float/int  3) 000000
  const num = String.raw`([-+]?\d+(?:[.,]\d+)?(?:E[-+]?\d+)?|0+)`;

  // Unit: alles tussen indicator en eerste number (maar niet te lang)
  // We beperken tot 60 chars om runaway te vermijden.
  const re = new RegExp(
    String.raw`(?:^|\s)${indicator}\s+(.{0,60}?)\s+${num}\s+${num}\s+${num}\s+${num}\s+${num}(?:\s+${num})?`,
    'i'
  );

  const m = sectionFlat.match(re);
  if (!m) return null;

  // m[1] = unit-ish
  // daarna volgen de numbers in match groups
  // Let op: afhankelijk van optional total kan group count variëren
  const unitRaw = m[1] || '';
  const nums = m.slice(2).filter((x) => typeof x === 'string' && x.length > 0) as string[];

  // We willen minimaal 5 waarden (A1..D)
  const values = nums.map((x) => parseNumberToken(x)).filter((v) => v !== undefined) as number[];
  if (values.length < 5) return null;

  return { unit: cleanUnit(unitRaw), values };
}

/**
 * Parse impacttabellen:
 * - zoekt "Resultaten Milieu-impact SBK set 1" en set 2
 * - pakt alle INDICATORS_ORDERED die gevonden worden
 */
function parseImpactTables(lineText: string): ParsedImpact[] {
  const impacts: ParsedImpact[] = [];

  // we maken ook een "sectionFlat" voor regex-matching in 1 regel.
  const sections: Array<{ setType: EpdSetType; text: string }> = [];

  const s1 = sliceSection(lineText, /Resultaten\s+Milieu-impact\s+SBK\s+set\s+1/i);
  if (s1) sections.push({ setType: 'SBK_SET_1', text: s1 });

  const s2 = sliceSection(lineText, /Resultaten\s+Milieu-impact\s+SBK\s+set\s+2/i);
  if (s2) sections.push({ setType: 'SBK_SET_2', text: s2 });

  // Soms staat er geen "set 2" sectie. Dan blijft het bij set 1.
  for (const section of sections) {
    const sectionFlat = normalizeFlat(section.text);

    for (const rawIndicator of INDICATORS_ORDERED) {
      const indicator = INDICATOR_ALIASES[rawIndicator] || rawIndicator;
      const row = parseIndicatorRowFromSection(sectionFlat, indicator);
      if (!row) continue;

      // row.values: meestal 6 (A1..D + totaal), maar we nemen de eerste 5 volgens STAGE_ORDER.
      const firstFive = row.values.slice(0, 5);

      // unit kan in rare gevallen leeg -> undefined
      const unit = row.unit && row.unit !== '-' ? row.unit : undefined;

      STAGE_ORDER_FROM_TABLE.forEach((st, idx) => {
        const v = firstFive[idx];
        if (v === undefined) return;

        // ParsedImpact type in jouw project:
        // - als je indicator al naar string hebt verruimd: OK
        // - zo niet: deze "as any" voorkomt TS gezeur
        impacts.push({
          indicator: indicator as any,
          setType: section.setType,
          stage: st.stage,
          value: v,
          // unit is optioneel; als jouw types dit nog niet heeft, dan is dit ook veilig via "as any"
          unit,
        } as any);
      });
    }
  }

  return impacts;
}

function computeA1A3IfMissing(impacts: ParsedImpact[], setType: EpdSetType, indicator: string): void {
  const hasA1A3 = impacts.some(
    (i: any) => i.setType === setType && i.indicator === indicator && i.stage === 'A1_A3'
  );
  if (hasA1A3) return;

  const a1 = impacts.find((i: any) => i.setType === setType && i.indicator === indicator && i.stage === 'A1');
  const a2 = impacts.find((i: any) => i.setType === setType && i.indicator === indicator && i.stage === 'A2');
  const a3 = impacts.find((i: any) => i.setType === setType && i.indicator === indicator && i.stage === 'A3');
  if (a1 && a2 && a3) {
    const unit = (a1 as any).unit || (a2 as any).unit || (a3 as any).unit;
    impacts.push({
      indicator: indicator as any,
      setType,
      stage: 'A1_A3',
      value: (a1 as any).value + (a2 as any).value + (a3 as any).value,
      unit,
    } as any);
  }
}

/**
 * Metadata extractors (robuster voor jouw tekst)
 */
function matchFirst(flatText: string, patterns: RegExp[]): string | undefined {
  for (const p of patterns) {
    const m = flatText.match(p);
    if (m?.[1]) return m[1].trim();
  }
  return undefined;
}

export function parseEpd(raw: string): ParsedEpd {
  const lineText = normalizeLines(raw);
  const flatText = normalizeFlat(raw);

  const parsed: ParsedEpd = {
    productName: undefined,
    functionalUnit: undefined,
    producerName: undefined,
    lcaMethod: undefined,
    pcrVersion: undefined,
    databaseName: undefined,
    publicationDate: undefined,
    expirationDate: undefined,
    verifierName: undefined,
    standardSet: 'UNKNOWN',
    impacts: [],
  };

  // --- Metadata: product / functional unit / producent ---
  parsed.productName = matchFirst(flatText, [
    /\bproduct\s*naam\s*[:\-]\s*([^|]+?)\s*(?:\bAdres:|\bContact:|\bPCR:|\bLCA\b|$)/i,
    /\bproduct\s*name\s*[:\-]\s*([^|]+?)\s*(?:\bAddress:|\bContact:|\bPCR:|\bLCA\b|$)/i,
  ]);

  parsed.functionalUnit = matchFirst(flatText, [
    /\bfunctionele\s*eenheid\s*[:\-]\s*([^|]+?)\s*(?:\bProducent:|\bProducer:|\bPCR:|\bLCA\b|$)/i,
    /\bfunctional\s*unit\s*[:\-]\s*([^|]+?)\s*(?:\bProducer:|\bPCR:|\bLCA\b|$)/i,
  ]);

  parsed.producerName = matchFirst(flatText, [
    /\bproducent\s*[:\-]\s*([^|]+?)\s*(?:\bAdres:|\bContact:|\bPCR:|\bLCA\b|$)/i,
    /\bproducer\s*[:\-]\s*([^|]+?)\s*(?:\bAddress:|\bContact:|\bPCR:|\bLCA\b|$)/i,
    // In jouw output zat "AsfaltNu Amsterdam" etc. Soms zit het in accountnaam; dit is een fallback.
    /\baccount\s+([A-Za-z0-9 _\-]+?)\s*\(20\d{2}\)/i,
  ]);

  parsed.lcaMethod = matchFirst(flatText, [
    /\bLCA\s*standaard\s*[:\-]\s*([^|]+?)\s*(?:\bPCR:|\bStandaard database:|$)/i,
    /\bBepalingsmethode\s*[:\-]\s*([^|]+?)\s*(?:\bPCR:|\bStandaard database:|$)/i,
  ]);

  parsed.pcrVersion = matchFirst(flatText, [
    /\bPCR\s*[:\-]\s*([^|]+?)\s*(?:\bStandaard database:|\bExtern|$)/i,
    /\bNL-PCR\s*Asfalt\s*([0-9.]+)/i,
  ]);

  parsed.databaseName = matchFirst(flatText, [
    /\bStandaard\s*database\s*[:\-]\s*([^|]+?)\s*(?:\bExtern|$)/i,
    /\bdatabase\s*[:\-]\s*([^|]+?)\s*(?:\bExtern|$)/i,
  ]);

  // publicatie / geldigheid
  // Jouw tekst heeft: "Datum van publicatie:28-11-2024 Einde geldigheid:28-11-2029"
  const pubCandidate =
    matchFirst(flatText, [/\bdatum\s+van\s+publicatie\s*[:\-]\s*([0-9]{1,2}[-/][0-9]{1,2}[-/][0-9]{4})/i]) ||
    matchFirst(flatText, [/\bpublicatie\s*[:\-]\s*datum\s*[:\-]\s*([0-9]{1,2}[-/][0-9]{1,2}[-/][0-9]{4})/i]) ||
    dateFromTextLoose(flatText);
  parsed.publicationDate = pubCandidate ? dateFromTextLoose(pubCandidate) : undefined;

  const expCandidate =
    matchFirst(flatText, [/\beinde\s+geldigheid\s*[:\-]\s*([0-9]{1,2}[-/][0-9]{1,2}[-/][0-9]{4})/i]) ||
    matchFirst(flatText, [/\bgeldigheid\s*[:\-]\s*([0-9]{1,2}[-/][0-9]{1,2}[-/][0-9]{4})/i]);
  parsed.expirationDate = expCandidate ? dateFromTextLoose(expCandidate) : undefined;

  parsed.verifierName = matchFirst(flatText, [
    /\bveri\s*ficateur\s*[:\-]\s*([^|]+?)\s*(?:“|\"|\bDe\b|$)/i, // in jouw output: "Veri cateur:Ruben van Gaalen"
    /\bverificateur\s*[:\-]\s*([^|]+?)\s*(?:“|\"|\bDe\b|$)/i,
    /\btoetser\s*[:\-]\s*([^|]+?)\s*(?:“|\"|\bDe\b|$)/i,
  ]);

  parsed.standardSet = detectStandardSet(flatText);

  // --- Impacts: parse tables ---
  const impacts = parseImpactTables(lineText);

  // Fallback: als table parsing niets oplevert, kun je later nog oude heuristics toevoegen.
  parsed.impacts = impacts;

  // A1_A3 aanvullen als ontbreekt voor elke indicator & set die A1/A2/A3 heeft.
  const indicatorsFound = Array.from(new Set((parsed.impacts as any[]).map((i) => i.indicator)));
  const setsFound = Array.from(new Set((parsed.impacts as any[]).map((i) => i.setType)));
  for (const setType of setsFound as EpdSetType[]) {
    for (const ind of indicatorsFound as string[]) {
      computeA1A3IfMissing(parsed.impacts, setType, ind);
    }
  }

  // Expiration fallback: +5 jaar
  if (!parsed.expirationDate && parsed.publicationDate) {
    const pub = new Date(parsed.publicationDate);
    const exp = new Date(pub);
    exp.setFullYear(exp.getFullYear() + 5);
    parsed.expirationDate = exp.toISOString().slice(0, 10);
  }

  return parsed;
}
